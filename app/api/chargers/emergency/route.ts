import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EmergencyQuerySchema } from "@/lib/validation/search";
import { searchChargers } from "@/lib/search/search-service";
import { buildEmergencySlot } from "@/lib/search/emergency-slot";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user authentication and driver role
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
            message: "Authentication required. Please sign in as a driver.",
          },
        },
        { status: 401 }
      );
    }

    // Role check: Only drivers may search for emergency chargers
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "driver") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN_ROLE",
            message: "Access restricted. Only EV Drivers can access Emergency Mode.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Extract and validate query parameters (supporting lat/lng/radius aliases)
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      latitude: searchParams.get("latitude") ?? searchParams.get("lat"),
      longitude: searchParams.get("longitude") ?? searchParams.get("lng"),
      radiusKm: searchParams.get("radiusKm") ?? searchParams.get("radius") ?? 25,
      limit: searchParams.get("limit") ?? 20,
    };

    const parsed = EmergencyQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_QUERY_PARAMS",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    // 3. Build emergency time slot using the authoritative SERVER clock
    const now = new Date();
    const slotResult = buildEmergencySlot(now);
    if (!slotResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: slotResult.error,
        },
        { status: 400 }
      );
    }

    const emergencySlot = slotResult.data;

    // 4. Call existing search service with no connector filter
    const searchResult = await searchChargers(
      {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        radiusKm: parsed.data.radiusKm,
        startAt: emergencySlot.startAt,
        endAt: emergencySlot.endAt,
        connectorType: undefined,
        limit: parsed.data.limit,
      },
      now
    );

    if (!searchResult.success) {
      const isClientError = [
        "PAST_SLOT",
        "INVALID_END_TIME",
        "DURATION_TOO_SHORT",
        "DURATION_TOO_LONG",
        "INVALID_STEP",
        "INVALID_DATE_FORMAT",
        "CANNOT_BOOK_ACROSS_MIDNIGHT",
      ].includes(searchResult.error.code);

      return NextResponse.json(
        {
          success: false,
          error: searchResult.error,
        },
        { status: isClientError ? 400 : 500 }
      );
    }

    // 5. Return results formatted with slot metadata (nearest first, approximate coordinates only)
    return NextResponse.json(
      {
        success: true,
        data: {
          chargers: searchResult.data.chargers,
          meta: searchResult.data.meta,
          slot: emergencySlot,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/chargers/emergency] Unhandled route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An unexpected server error occurred while processing Emergency Mode.",
        },
      },
      { status: 500 }
    );
  }
}
