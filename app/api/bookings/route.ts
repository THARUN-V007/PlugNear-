import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingRequestSchema } from "@/lib/validation/booking";
import {
  validateSlot,
  checkAvailability,
  checkSlotOverlap,
  type TimeSlot,
  type BookingRecord,
  type AvailabilityWindow,
} from "@/lib/rules";
import {
  buildBookingRecord,
  checkForDuplicateBooking,
  mapBookingRuleError,
} from "@/lib/bookings/booking-helpers";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user and verify driver role
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: mapBookingRuleError("UNAUTHORIZED"),
          },
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "driver") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: mapBookingRuleError("FORBIDDEN"),
          },
        },
        { status: 403 }
      );
    }

    // 2. Validate request body with Zod
    const rawBody = await request.json().catch(() => null);
    const parsed = BookingRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid booking payload";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: firstIssue,
          },
        },
        { status: 400 }
      );
    }

    const { chargerId, startAt, endAt } = parsed.data;
    const slot: TimeSlot = { startAt, endAt };
    const now = new Date();

    // 3. Check 1: Slot validation from rules engine (future check, 30m steps, duration)
    const slotValidation = validateSlot(slot, now);
    if (!slotValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: slotValidation.error.code,
            message: mapBookingRuleError(
              slotValidation.error.code,
              slotValidation.error.message
            ),
          },
        },
        { status: 400 }
      );
    }

    // 4. Fetch charger details using admin client
    const adminClient = createAdminClient();
    const { data: charger, error: chargerError } = await adminClient
      .from("chargers")
      .select("id, host_id, price_per_hour, is_active")
      .eq("id", chargerId)
      .maybeSingle();

    if (chargerError || !charger) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHARGER_NOT_FOUND",
            message: mapBookingRuleError("CHARGER_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    if (!charger.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHARGER_INACTIVE",
            message: mapBookingRuleError("CHARGER_INACTIVE"),
          },
        },
        { status: 400 }
      );
    }

    // 5. Fetch availability windows
    const { data: rawWindows, error: windowsError } = await adminClient
      .from("availability_windows")
      .select("id, charger_id, day_of_week, start_time, end_time")
      .eq("charger_id", chargerId);

    if (windowsError) {
      console.error("[POST /api/bookings] Windows error:", windowsError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Could not retrieve charger availability schedule.",
          },
        },
        { status: 500 }
      );
    }

    const windows: AvailabilityWindow[] = (rawWindows || []).map((w) => ({
      id: w.id,
      chargerId: w.charger_id,
      dayOfWeek: w.day_of_week,
      startTime: w.start_time,
      endTime: w.end_time,
    }));

    // Check 2: Availability check
    const availValidation = checkAvailability(slot, {
      isActive: charger.is_active,
      windows,
    });

    if (!availValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: availValidation.error.code,
            message: mapBookingRuleError(
              availValidation.error.code,
              availValidation.error.message
            ),
          },
        },
        { status: 400 }
      );
    }

    // 6. Fetch existing intersecting bookings on this charger
    const { data: rawBookings, error: bookingsError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status")
      .eq("charger_id", chargerId)
      .lt("start_at", slot.endAt)
      .gt("end_at", slot.startAt);

    if (bookingsError) {
      console.error("[POST /api/bookings] Bookings query error:", bookingsError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Could not verify existing bookings on this charger.",
          },
        },
        { status: 500 }
      );
    }

    const existingBookings: BookingRecord[] = (rawBookings || []).map((b) => ({
      id: b.id,
      chargerId: b.charger_id,
      driverId: b.driver_id,
      startAt: new Date(b.start_at),
      endAt: new Date(b.end_at),
      status: b.status,
    }));

    // Check 3: Overlap check against CONFIRMED bookings
    const overlapValidation = checkSlotOverlap(slot, existingBookings, charger.id);
    if (!overlapValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: overlapValidation.error.code,
            message: mapBookingRuleError(
              overlapValidation.error.code,
              overlapValidation.error.message
            ),
          },
        },
        { status: 409 }
      );
    }

    // Check 4: Duplicate check for the current driver
    const duplicateValidation = checkForDuplicateBooking(
      user.id,
      slot,
      existingBookings
    );
    if (duplicateValidation.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_BOOKING",
            message: duplicateValidation.message || mapBookingRuleError("DUPLICATE_BOOKING"),
          },
        },
        { status: 409 }
      );
    }

    // 7. Compute cost server-side and build booking record
    const builtRecordResult = buildBookingRecord({
      driverId: user.id, // Strictly from session, never from body
      chargerId: charger.id,
      slot,
      pricePerHour: Number(charger.price_per_hour),
    });

    if (!builtRecordResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: builtRecordResult.error.code,
            message: mapBookingRuleError(
              builtRecordResult.error.code,
              builtRecordResult.error.message
            ),
          },
        },
        { status: 400 }
      );
    }

    const built = builtRecordResult.data;

    // 8. Insert booking using the authenticated driver's client
    // Ensures RLS "Drivers can insert booking requests" is exercised
    const { data: newBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        charger_id: built.charger_id,
        driver_id: built.driver_id,
        start_at: built.start_at,
        end_at: built.end_at,
        status: built.status,
        total_cost: built.total_cost,
      })
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, created_at")
      .single();

    if (insertError) {
      // Postgres error 23P01 = exclusion_violation
      if (insertError.code === "23P01" || insertError.message?.includes("no_overlapping_confirmed_bookings")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SLOT_BLOCKED",
              message: "This slot is no longer available.",
            },
          },
          { status: 409 }
        );
      }

      console.error("[POST /api/bookings] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to record booking request. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // 9. Return consistent success shape
    return NextResponse.json(
      {
        success: true,
        data: {
          booking: newBooking,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/bookings] Unexpected exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected server error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
