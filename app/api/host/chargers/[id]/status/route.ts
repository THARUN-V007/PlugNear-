import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ToggleChargerStatusSchema } from "@/lib/validation/charger";
import { mapChargerError } from "@/lib/chargers/host-chargers-helpers";

interface StatusRouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, props: StatusRouteParams) {
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
            message: "You must be signed in as a host to modify charger status.",
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
            message: "Only verified hosts can modify charging point status.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch existing charger to verify ownership
    const adminClient = createAdminClient();
    const { data: existingCharger, error: fetchError } = await adminClient
      .from("chargers")
      .select("id, host_id, is_active")
      .eq("id", id)
      .maybeSingle();

    // 404 both when charger does not exist AND when it belongs to another host (never 403)
    if (fetchError || !existingCharger || existingCharger.host_id !== user.id) {
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

    // 3. Parse & Validate request body
    const body = await request.json();
    const parseResult = ToggleChargerStatusSchema.safeParse(body);

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

    const { is_active, electricity_permission_acknowledged } = parseResult.data;

    // 4. Query upcoming confirmed bookings count
    const nowIso = new Date().toISOString();
    const { count: upcomingCount } = await adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("charger_id", id)
      .eq("status", "confirmed")
      .gt("start_at", nowIso);

    // 5. Update status
    const updatePayload: Record<string, any> = {
      is_active,
    };
    if (is_active && electricity_permission_acknowledged) {
      updatePayload.electricity_permission_acknowledged = true;
    }

    const { data: updatedCharger, error: updateError } = await adminClient
      .from("chargers")
      .update(updatePayload)
      .eq("id", id)
      .eq("host_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/host/chargers/[id]/status] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to update charger status. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          charger: updatedCharger,
          upcomingConfirmedCount: upcomingCount || 0,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[PATCH /api/host/chargers/[id]/status] Unexpected error:", err);
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
