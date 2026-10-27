import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionBooking, type BookingRecord } from "@/lib/rules";
import { mapCancellationError } from "@/lib/bookings/driver-bookings-helpers";

interface CancelRouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, props: CancelRouteParams) {
  try {
    const { id } = await props.params;

    // 1. Authenticate user from session and verify driver role
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
            message: "You must be signed in to cancel a booking.",
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
            message: "Only EV drivers may cancel driver bookings.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch booking by id
    const adminClient = createAdminClient();
    const { data: rawBooking, error: fetchError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, decided_at")
      .eq("id", id)
      .maybeSingle();

    // Return 404 "Booking not found" both when booking doesn't exist AND when it belongs to another driver
    if (fetchError || !rawBooking || rawBooking.driver_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: mapCancellationError("BOOKING_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    // 3. Fetch charger to get host_id for state machine transition
    const { data: charger, error: chargerError } = await adminClient
      .from("chargers")
      .select("id, host_id")
      .eq("id", rawBooking.charger_id)
      .maybeSingle();

    if (chargerError || !charger) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHARGER_NOT_FOUND",
            message: "Associated charging point could not be found.",
          },
        },
        { status: 404 }
      );
    }

    const bookingRecord: BookingRecord = {
      id: rawBooking.id,
      chargerId: rawBooking.charger_id,
      driverId: rawBooking.driver_id,
      startAt: new Date(rawBooking.start_at),
      endAt: new Date(rawBooking.end_at),
      status: rawBooking.status,
      totalCost: Number(rawBooking.total_cost),
      decidedAt: rawBooking.decided_at ? new Date(rawBooking.decided_at) : null,
    };

    // 4. State Machine check: Decide transition via lib/rules
    const now = new Date();
    const transitionResult = transitionBooking({
      booking: bookingRecord,
      newStatus: "cancelled",
      actor: { role: "driver", userId: user.id },
      hostId: charger.host_id,
      now,
    });

    if (!transitionResult.success) {
      const mappedMsg = mapCancellationError(
        transitionResult.error.code,
        transitionResult.error.message
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: transitionResult.error.code,
            message: mappedMsg,
          },
        },
        { status: 400 }
      );
    }

    // 5. Conditional Update: Must still match current status to prevent race conditions
    const currentStatus = rawBooking.status;
    const decidedAtIso = transitionResult.data.decidedAt
      ? transitionResult.data.decidedAt.toISOString()
      : now.toISOString();

    const { data: updatedRows, error: updateError } = await adminClient
      .from("bookings")
      .update({
        status: "cancelled",
        decided_at: decidedAtIso,
      })
      .eq("id", id)
      .eq("status", currentStatus)
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, decided_at");

    if (updateError) {
      console.error("[POST /api/bookings/[id]/cancel] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to cancel booking. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // If zero rows updated, another concurrent update already changed the status
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONCURRENT_UPDATE",
            message: mapCancellationError("CONCURRENT_UPDATE"),
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          booking: updatedRows[0],
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/bookings/[id]/cancel] Unexpected error:", err);
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
