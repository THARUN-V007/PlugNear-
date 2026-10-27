import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpdateChargerSchema } from "@/lib/validation/charger";
import {
  buildChargerUpdateRecord,
  mapChargerError,
} from "@/lib/chargers/host-chargers-helpers";
import { replaceChargerAvailabilityWindows } from "@/lib/chargers/availability-windows";

interface ChargerRouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, props: ChargerRouteParams) {
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
            message: "You must be signed in as a host to edit this charger.",
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
            message: "Only verified hosts can edit charging points.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Fetch existing charger to verify ownership
    const adminClient = createAdminClient();
    const { data: existingCharger, error: fetchError } = await adminClient
      .from("chargers")
      .select("id, host_id")
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
    const parseResult = UpdateChargerSchema.safeParse(body);

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

    // 4. Build update record from explicit allow-list
    const updateData = buildChargerUpdateRecord(parseResult.data);

    const { data: updatedRows, error: updateError } = await adminClient
      .from("chargers")
      .update(updateData)
      .eq("id", id)
      .eq("host_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/host/chargers/[id]] Update error:", updateError);

      if (updateError.message?.includes("electricity_permission_acknowledged")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "MIGRATION_MISSING",
              message: mapChargerError("MIGRATION_MISSING"),
            },
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Failed to update charging point. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // 5. Replace the weekly availability schedule (atomic; rolls back on rejection)
    const windowsResult = await replaceChargerAvailabilityWindows(
      adminClient,
      id,
      parseResult.data.windows
    );

    if (!windowsResult.success) {
      const status = windowsResult.error.code === "MIGRATION_MISSING" ? 500 : 400;
      return NextResponse.json({ success: false, error: windowsResult.error }, { status });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          charger: updatedRows,
          windowsSaved: windowsResult.data,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[PUT /api/host/chargers/[id]] Unexpected error:", err);
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
