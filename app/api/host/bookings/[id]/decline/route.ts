import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionBooking, type BookingRecord } from "@/lib/rules";
import { mapHostActionError } from "@/lib/bookings/host-bookings-helpers";

interface DeclineRouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, props: DeclineRouteParams) {
  try {
    const { id } = await props.params;

    // 1. Authenticate user from session and verify host role
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
            message: "You must be signed in as a host to decline bookings.",
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

    if (profileError || !profile || profile.role !== "host") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only charging point hosts can decline bookings.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch target booking
    const adminClient = createAdminClient();
    const { data: rawBooking, error: fetchBookingError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, decided_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchBookingError || !rawBooking) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: mapHostActionError("BOOKING_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    // 3. Fetch charger to verify host ownership
    const { data: charger, error: fetchChargerError } = await adminClient
      .from("chargers")
      .select("id, host_id")
      .eq("id", rawBooking.charger_id)
      .maybeSingle();

    // 404 both when charger doesn't exist AND when it belongs to another host
    if (fetchChargerError || !charger || charger.host_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: mapHostActionError("BOOKING_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    // 4. Run rules engine validation
    const now = new Date();
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

    const transitionResult = transitionBooking({
      booking: bookingRecord,
      newStatus: "declined",
      actor: { role: "host", userId: user.id },
      hostId: charger.host_id,
      now,
    });

    if (!transitionResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: transitionResult.error.code,
            message: transitionResult.error.message,
          },
        },
        { status: 400 }
      );
    }

    // 5. Conditional Update: Must still match 'requested' status
    const { data: updatedRows, error: updateError } = await adminClient
      .from("bookings")
      .update({
        status: "declined",
        decided_at: now.toISOString(),
      })
      .eq("id", id)
      .eq("status", "requested")
      .select("id, status, decided_at");

    if (updateError) {
      console.error("[POST /api/host/bookings/[id]/decline] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to decline booking. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONCURRENT_UPDATE",
            message: mapHostActionError("CONCURRENT_UPDATE"),
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedRows[0],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/host/bookings/[id]/decline] Unexpected error:", err);
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
