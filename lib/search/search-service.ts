import { createAdminClient } from "@/lib/supabase/admin";
import { validateSlot, ok, err, type Result } from "@/lib/rules";
import type { SearchQueryParams } from "@/lib/validation/search";
import {
  assembleSearchResults,
  type RawCandidateCharger,
  type SearchResponsePayload,
} from "./search-assembly";

/**
 * Server-only search service that executes spatial proximity queries against Supabase
 * and evaluates candidate chargers against domain availability and overlap rules.
 *
 * Can be reused directly by Emergency Mode (Step 4) or other server actions.
 */
export async function searchChargers(
  params: SearchQueryParams,
  now?: Date | string
): Promise<Result<SearchResponsePayload>> {
  const currentInstant = now ?? new Date();

  // 1. Validate requested slot using the rules engine before touching the database
  const slot = {
    startAt: params.startAt,
    endAt: params.endAt,
  };
  const slotValidation = validateSlot(slot, currentInstant);
  if (!slotValidation.success) {
    return err(slotValidation.error.code, slotValidation.error.message);
  }

  try {
    const adminClient = createAdminClient();

    // 2. Query PostGIS proximity search function
    // Uses ST_DWithin and GIST spatial index
    const radiusMeters = params.radiusKm * 1000;
    const { data: rawNearby, error: rpcError } = await adminClient.rpc(
      "search_chargers_nearby",
      {
        p_latitude: params.latitude,
        p_longitude: params.longitude,
        p_radius_meters: radiusMeters,
        p_connector_type: params.connectorType ?? null,
      }
    );

    if (rpcError) {
      console.error("[searchChargers] PostGIS RPC error:", rpcError);
      return err(
        "DATABASE_ERROR",
        "An unexpected error occurred while searching nearby chargers."
      );
    }

    const nearbyList = (rawNearby as any[]) || [];
    if (nearbyList.length === 0) {
      return ok({
        chargers: [],
        meta: {
          totalInRadius: 0,
          availableCount: 0,
        },
      });
    }

    const chargerIds = nearbyList.map((c) => c.id);

    // 3. Fetch availability windows for candidate chargers
    const { data: rawWindows, error: windowsError } = await adminClient
      .from("availability_windows")
      .select("id, charger_id, day_of_week, start_time, end_time")
      .in("charger_id", chargerIds);

    if (windowsError) {
      console.error("[searchChargers] Windows query error:", windowsError);
      return err(
        "DATABASE_ERROR",
        "Could not retrieve charger availability schedules."
      );
    }

    // 4. Fetch intersecting confirmed bookings on candidate chargers
    // Half-open overlap condition: start_at < slot.end AND end_at > slot.start
    const { data: rawBookings, error: bookingsError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status")
      .in("charger_id", chargerIds)
      .eq("status", "confirmed")
      .lt("start_at", params.endAt)
      .gt("end_at", params.startAt);

    if (bookingsError) {
      console.error("[searchChargers] Bookings query error:", bookingsError);
      return err(
        "DATABASE_ERROR",
        "Could not verify existing charger reservations."
      );
    }

    // Map windows and bookings by charger_id
    const windowsByCharger = new Map<string, any[]>();
    for (const w of rawWindows || []) {
      const list = windowsByCharger.get(w.charger_id) || [];
      list.push({
        id: w.id,
        chargerId: w.charger_id,
        dayOfWeek: w.day_of_week,
        startTime: w.start_time,
        endTime: w.end_time,
      });
      windowsByCharger.set(w.charger_id, list);
    }

    const bookingsByCharger = new Map<string, any[]>();
    for (const b of rawBookings || []) {
      const list = bookingsByCharger.get(b.charger_id) || [];
      list.push({
        id: b.id,
        chargerId: b.charger_id,
        driverId: b.driver_id,
        startAt: new Date(b.start_at),
        endAt: new Date(b.end_at),
        status: b.status,
      });
      bookingsByCharger.set(b.charger_id, list);
    }

    // Transform into RawCandidateCharger records
    const candidates: RawCandidateCharger[] = nearbyList.map((c) => ({
      id: c.id,
      hostId: c.host_id,
      title: c.title,
      connectorType: c.connector_type,
      powerKw: Number(c.power_kw),
      pricePerHour: Number(c.price_per_hour),
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      distanceMeters: Number(c.distance_meters),
      isActive: Boolean(c.is_active),
      notes: c.notes,
      hostConnectionType: c.host_connection_type,
      windows: windowsByCharger.get(c.id) || [],
      bookings: bookingsByCharger.get(c.id) || [],
    }));

    // 5. Run pure domain rules assembly, filtering, ranking, and privacy masking
    const payload = assembleSearchResults({
      candidates,
      origin: { latitude: params.latitude, longitude: params.longitude },
      slot,
      validatedSlot: slotValidation.data,
      limit: params.limit,
      connectorFilter: params.connectorType,
    });

    return ok(payload);
  } catch (error) {
    console.error("[searchChargers] Unexpected exception:", error);
    return err(
      "SERVER_ERROR",
      "An unexpected server error occurred while processing your search."
    );
  }
}
