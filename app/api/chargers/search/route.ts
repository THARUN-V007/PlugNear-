import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SearchQuerySchema } from "@/lib/validation/search";
import { searchChargers } from "@/lib/search/search-service";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user authentication and role
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

    // Role check: Only drivers may search chargers
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
            message: "Access restricted. Only EV Drivers can search for chargers.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Extract and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      latitude: searchParams.get("latitude") ?? searchParams.get("lat"),
      longitude: searchParams.get("longitude") ?? searchParams.get("lng"),
      radiusKm: searchParams.get("radiusKm") ?? searchParams.get("radius") ?? 10,
      startAt: searchParams.get("startAt") ?? searchParams.get("start"),
      endAt: searchParams.get("endAt") ?? searchParams.get("end"),
      connectorType: searchParams.get("connectorType") ?? searchParams.get("connector") ?? undefined,
      limit: searchParams.get("limit") ?? 20,
    };

    const parsed = SearchQuerySchema.safeParse(rawParams);
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

    // 3. Execute search service
    const searchResult = await searchChargers(parsed.data);

    if (!searchResult.success) {
      // Map domain rule violations to HTTP 400
      const isClientError = [
        "PAST_SLOT",
        "INVALID_END_TIME",
        "DURATION_TOO_SHORT",
        "DURATION_TOO_LONG",
        "INVALID_STEP",
        "INVALID_DATE_FORMAT",
      ].includes(searchResult.error.code);

      return NextResponse.json(
        {
          success: false,
          error: searchResult.error,
        },
        { status: isClientError ? 400 : 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: searchResult.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/chargers/search] Unhandled route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An unexpected server error occurred while processing your search.",
        },
      },
      { status: 500 }
    );
  }
}
