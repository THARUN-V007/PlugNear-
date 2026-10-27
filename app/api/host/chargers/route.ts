import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateChargerSchema } from "@/lib/validation/charger";
import {
  buildChargerInsertRecord,
  mapChargerError,
} from "@/lib/chargers/host-chargers-helpers";

export async function POST(request: Request) {
  try {
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
            message: "You must be signed in as a host to list a charging point.",
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
            message: "Only verified hosts can create charging point listings.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Parse & Validate request body
    const body = await request.json();
    const parseResult = CreateChargerSchema.safeParse(body);

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

    // 3. Build insert record strictly enforcing session host ID
    const insertData = buildChargerInsertRecord(parseResult.data, user.id);

    const adminClient = createAdminClient();
    const { data: insertedCharger, error: insertError } = await adminClient
      .from("chargers")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/host/chargers] Insert error:", insertError);

      if (insertError.message?.includes("electricity_permission_acknowledged")) {
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
            message: "Could not create charging point listing. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          charger: insertedCharger,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/host/chargers] Unexpected error:", err);
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
