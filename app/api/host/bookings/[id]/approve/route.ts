import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transitionBooking, type BookingRecord } from "@/lib/rules";
import { mapHostActionError } from "@/lib/bookings/host-bookings-helpers";

interface ApproveRouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, props: ApproveRouteParams) {
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
            message: "You must be signed in as a host to approve bookings.",
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
            message: "Only charging point hosts can approve bookings.",
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

    // 4. Run rules engine validation first for friendly rule-based messages
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
      newStatus: "confirmed",
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

    // 5. Invoke atomic approval and auto-decline SQL function
    // Strict requirement: No TypeScript fallback. Must run only through host_approve_booking_atomic.
    const { data: rpcData, error: rpcError } = await adminClient.rpc(
      "host_approve_booking_atomic",
      {
        p_booking_id: id,
        p_host_id: user.id,
        p_now: now.toISOString(),
      }
    );

    if (rpcError) {
      console.error("[POST /api/host/bookings/[id]/approve] Atomic function error:", rpcError);

      // Check if migration has not been applied yet
      const isMissingFunction =
        rpcError.code === "PGRST202" ||
        rpcError.code === "42883" ||
        rpcError.message?.toLowerCase().includes("host_approve_booking_atomic") ||
        rpcError.message?.toLowerCase().includes("does not exist");

      if (isMissingFunction) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "MIGRATION_MISSING",
              message: mapHostActionError("MIGRATION_MISSING"),
            },
          },
          { status: 500 }
        );
      }

      // If function raised BOOKING_NOT_FOUND (e.g. concurrent deletion)
      if (rpcError.message?.includes("BOOKING_NOT_FOUND")) {
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

      // Map ANY other failure (exclusion violation 23P01, deadlock 40P01, lock timeout, concurrency)
      // to friendly message, technical details logged on server only.
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message:
              "This booking was just updated or another booking for this time was confirmed. Please refresh and try again.",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: rpcData,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/host/bookings/[id]/approve] Unexpected error:", err);
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
