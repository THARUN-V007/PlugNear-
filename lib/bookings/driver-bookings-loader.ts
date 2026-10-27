import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshBookingStatuses,
  canViewExactLocation,
  getApproximateCoordinates,
  type BookingRecord,
  type Actor,
  type Result,
  ok,
  err,
} from "@/lib/rules";
import {
  type DriverBookingItem,
  getGoogleMapsDirectionsUrl,
} from "./driver-bookings-helpers";

export interface LoadDriverBookingsResult {
  bookings: DriverBookingItem[];
}

/**
 * Loads bookings for the signed-in driver with strict 2-step privacy isolation
 * and persistent lazy status refresh.
 *
 * Guarantees:
 * 1. Bookings are queried via the authenticated driver client, strictly enforcing RLS.
 * 2. Driver ID is taken from the session, never accepted from URL or request body.
 * 3. Lazy refresh updates status in memory immediately and persists changes conditionally.
 * 4. Step 1 charger query loads safe columns only (title, connector, power, price, coords for approx hash).
 * 5. Step 2 exact address query runs ONLY for charger IDs of confirmed bookings after canViewExactLocation approves.
 * 6. Non-confirmed bookings NEVER have address_text or exact coordinates in memory or returned payload.
 */
export async function loadDriverBookings(): Promise<Result<LoadDriverBookingsResult>> {
  try {
    const supabase = await createClient();

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err("UNAUTHORIZED", "You must be signed in to view your bookings.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "driver") {
      return err("FORBIDDEN", "Only EV drivers can access this bookings portal.");
    }

    // 2. Fetch driver's bookings via driver client (exercising RLS)
    const { data: rawBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, created_at, decided_at")
      .order("created_at", { ascending: false });

    if (bookingsError) {
      console.error("[loadDriverBookings] Failed to query bookings:", bookingsError);
      return err("DATABASE_ERROR", "Could not load your charging reservations.");
    }

    if (!rawBookings || rawBookings.length === 0) {
      return ok({ bookings: [] });
    }

    // 3. Extract verified driver booking IDs from RLS read
    const driverBookingIds = new Set(rawBookings.map((b) => b.id));

    // Convert to BookingRecord for rules engine
    const bookingRecords: BookingRecord[] = rawBookings.map((b) => ({
      id: b.id,
      chargerId: b.charger_id,
      driverId: b.driver_id,
      startAt: new Date(b.start_at),
      endAt: new Date(b.end_at),
      status: b.status,
      totalCost: Number(b.total_cost),
      decidedAt: b.decided_at ? new Date(b.decided_at) : null,
    }));

    // 4. Run Lazy Status Refresh
    const now = new Date();
    const { expiredIds, completedIds, updates } = refreshBookingStatuses(bookingRecords, now);

    // Update in-memory representation immediately for this page render
    const statusMap = new Map<string, string>();
    for (const u of updates) {
      statusMap.set(u.id, u.newStatus);
    }

    // Persist status updates asynchronously / conditionally using verified driver booking IDs only
    if (updates.length > 0) {
      const adminClient = createAdminClient();
      try {
        const safeExpiredIds = expiredIds.filter((id) => driverBookingIds.has(id));
        const safeCompletedIds = completedIds.filter((id) => driverBookingIds.has(id));

        if (safeExpiredIds.length > 0) {
          await adminClient
            .from("bookings")
            .update({ status: "expired" })
            .in("id", safeExpiredIds)
            .eq("status", "requested");
        }

        if (safeCompletedIds.length > 0) {
          await adminClient
            .from("bookings")
            .update({ status: "completed" })
            .in("id", safeCompletedIds)
            .eq("status", "confirmed");
        }
      } catch (persistErr) {
        // Non-blocking: If save fails, log warning; page still renders with refreshed values
        console.warn("[loadDriverBookings] Lazy refresh persist failed:", persistErr);
      }
    }

    // 5. Query 1: Safe Columns Only for All Related Chargers
    const uniqueChargerIds = Array.from(new Set(rawBookings.map((b) => b.charger_id)));
    const adminClient = createAdminClient();

    const { data: safeChargers, error: chargersError } = await adminClient
      .from("chargers")
      .select("id, host_id, title, connector_type, power_kw, price_per_hour, latitude, longitude")
      .in("id", uniqueChargerIds);

    if (chargersError || !safeChargers) {
      console.error("[loadDriverBookings] Safe chargers query error:", chargersError);
      return err("DATABASE_ERROR", "Could not load charging point specifications.");
    }

    const safeChargerMap = new Map<string, any>();
    for (const c of safeChargers) {
      safeChargerMap.set(c.id, c);
    }

    // 6. Privacy Decision & Query 2: Exact Fields ONLY for Confirmed Bookings
    const viewer: Actor = { role: "driver", userId: user.id };
    const confirmedChargerIds = new Set<string>();

    for (const b of bookingRecords) {
      const currentStatus = (statusMap.get(b.id) || b.status) as any;
      const charger = safeChargerMap.get(b.chargerId);
      if (!charger) continue;

      const evalBooking: BookingRecord = {
        ...b,
        status: currentStatus,
      };

      if (canViewExactLocation(viewer, { hostId: charger.host_id }, [evalBooking])) {
        confirmedChargerIds.add(b.chargerId);
      }
    }

    // Query 2: Fetch exact address_text and coordinates ONLY for confirmed chargers
    const exactAddressMap = new Map<string, { address_text: string; latitude: number; longitude: number }>();

    if (confirmedChargerIds.size > 0) {
      const { data: exactRows, error: exactError } = await adminClient
        .from("chargers")
        .select("id, address_text, latitude, longitude")
        .in("id", Array.from(confirmedChargerIds));

      if (!exactError && exactRows) {
        for (const row of exactRows) {
          exactAddressMap.set(row.id, {
            address_text: row.address_text,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          });
        }
      }
    }

    // 7. Assemble final sanitized DriverBookingItem records
    const finalBookings: DriverBookingItem[] = rawBookings.map((raw) => {
      const effectiveStatus = (statusMap.get(raw.id) || raw.status) as any;
      const ch = safeChargerMap.get(raw.charger_id);

      const approxLocation = ch
        ? getApproximateCoordinates(ch.id, {
            latitude: Number(ch.latitude),
            longitude: Number(ch.longitude),
          })
        : { latitude: 0, longitude: 0 };

      // Exact location attached strictly if confirmedChargerIds contains this charger
      // and this specific booking is confirmed
      const isConfirmed = effectiveStatus === "confirmed";
      const exactData = isConfirmed ? exactAddressMap.get(raw.charger_id) : null;

      return {
        id: raw.id,
        chargerId: raw.charger_id,
        driverId: raw.driver_id,
        startAt: raw.start_at,
        endAt: raw.end_at,
        status: effectiveStatus,
        totalCost: Number(raw.total_cost),
        decidedAt: raw.decided_at,
        createdAt: raw.created_at,

        chargerTitle: ch?.title || "Charging Point",
        connectorType: ch?.connector_type || "Standard",
        powerKw: Number(ch?.power_kw || 0),
        pricePerHour: Number(ch?.price_per_hour || 0),
        hostId: ch?.host_id || "",

        approximateLocation: approxLocation,
        exactAddress: exactData ? exactData.address_text : null,
        exactLocation: exactData
          ? { latitude: exactData.latitude, longitude: exactData.longitude }
          : null,
        directionsUrl: exactData
          ? getGoogleMapsDirectionsUrl(exactData.latitude, exactData.longitude)
          : null,
      };
    });

    return ok({ bookings: finalBookings });
  } catch (err: any) {
    console.error("[loadDriverBookings] Unexpected failure:", err);
    return err("INTERNAL_ERROR", "An unexpected error occurred while loading bookings.");
  }
}
