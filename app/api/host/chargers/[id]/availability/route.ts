import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateAvailabilitySchema } from "@/lib/validation/availability";
import {
  validateWeeklyEditorSchedule,
  databaseRowsToEditorSchedule,
} from "@/lib/availability/availability-helpers";
import { replaceChargerAvailabilityWindows } from "@/lib/chargers/availability-windows";
import { mapChargerError } from "@/lib/chargers/host-chargers-helpers";

interface AvailabilityRouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/host/chargers/[id]/availability
 * Reads the charger's availability windows and upcoming confirmed bookings.
 * Restricted strictly to the authenticated host who owns the charger.
 */
export async function GET(request: Request, props: AvailabilityRouteParams) {
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
            message: "You must be signed in as a host to view availability.",
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
            message: "Only verified hosts can access charger availability.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch existing charger to verify ownership
    const adminClient = createAdminClient();
    const { data: charger, error: chargerError } = await adminClient
      .from("chargers")
      .select("id, host_id, title, is_active")
      .eq("id", id)
      .maybeSingle();

    if (chargerError || !charger || charger.host_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHARGER_NOT_FOUND",
            message: mapChargerError("CHARGER_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    // 3. Query existing availability windows
    const { data: windows, error: windowsError } = await adminClient
      .from("availability_windows")
      .select("id, charger_id, day_of_week, start_time, end_time")
      .eq("charger_id", id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (windowsError) {
      console.error("[GET /api/host/chargers/[id]/availability] Windows error:", windowsError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Could not load availability windows.",
          },
        },
        { status: 500 }
      );
    }

    // 4. Query upcoming confirmed bookings on this charger
    const nowIso = new Date().toISOString();
    const { data: bookings, error: bookingsError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status")
      .eq("charger_id", id)
      .eq("status", "confirmed")
      .gt("end_at", nowIso)
      .order("start_at", { ascending: true });

    if (bookingsError) {
      console.error("[GET /api/host/chargers/[id]/availability] Bookings error:", bookingsError);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          charger: {
            id: charger.id,
            title: charger.title,
            isActive: charger.is_active,
          },
          windows: windows || [],
          upcomingConfirmedBookings: bookings || [],
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[GET /api/host/chargers/[id]/availability] Unexpected error:", err);
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

/**
 * PUT /api/host/chargers/[id]/availability
 * Atomically replaces all availability windows for a charger.
 * Restricted strictly to the authenticated host who owns the charger.
 */
export async function PUT(request: Request, props: AvailabilityRouteParams) {
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
            message: "You must be signed in as a host to update availability.",
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
            message: "Only verified hosts can update availability.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch existing charger to verify ownership
    const adminClient = createAdminClient();
    const { data: charger, error: chargerError } = await adminClient
      .from("chargers")
      .select("id, host_id")
      .eq("id", id)
      .maybeSingle();

    // 404 both when charger does not exist AND when it belongs to another host (never leak)
    if (chargerError || !charger || charger.host_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHARGER_NOT_FOUND",
            message: mapChargerError("CHARGER_NOT_FOUND"),
          },
        },
        { status: 404 }
      );
    }

    // 3. Parse & Validate request body with Zod schema
    const body = await request.json();
    const parseResult = updateAvailabilitySchema.safeParse(body);

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue.message,
            field: firstIssue.path.join("."),
          },
        },
        { status: 400 }
      );
    }

    // 4. Validate with domain rules using pure validator
    const editorSchedule = databaseRowsToEditorSchedule(parseResult.data.windows);
    const domainValidation = validateWeeklyEditorSchedule(editorSchedule);

    if (!domainValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SCHEDULE",
            message: domainValidation.allErrors[0] || "Invalid availability schedule.",
            errorsByDay: domainValidation.errorsByDay,
            allErrors: domainValidation.allErrors,
          },
        },
        { status: 400 }
      );
    }

    // 5. Atomically replace availability windows using the database function
    const replaceResult = await replaceChargerAvailabilityWindows(
      adminClient,
      id,
      parseResult.data.windows,
      user.id
    );

    if (!replaceResult.success) {
      const status = replaceResult.error.code === "MIGRATION_MISSING" ? 500 : 400;
      return NextResponse.json(
        {
          success: false,
          error: replaceResult.error,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          windowsSaved: replaceResult.data,
          isEmpty: domainValidation.isEmpty,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[PUT /api/host/chargers/[id]/availability] Unexpected error:", err);
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
