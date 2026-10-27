import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshBookingStatuses,
  type BookingRecord,
  type Result,
  ok,
  err,
} from "@/lib/rules";
import { type HostBookingItem } from "./host-bookings-helpers";

export interface LoadHostBookingsResult {
  bookings: HostBookingItem[];
}

/**
 * Loads all bookings for chargers owned by the signed-in host with strict privacy,
 * persistent lazy status refresh, and driver name resolution.
 *
 * Guarantees:
 * 1. Host role is strictly verified via user profile.
 * 2. Reads only chargers where host_id = user.id.
 * 3. Lazy refresh marks expired/completed bookings in memory and conditionally persists updates.
 * 4. Driver privacy: selects ONLY id and name from profiles. Never selects phone or email.
 * 5. Returns HostBookingItem array ready for section grouping and presentation.
 */
export async function loadHostBookings(): Promise<Result<LoadHostBookingsResult>> {
  try {
    const supabase = await createClient();

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err("UNAUTHORIZED", "You must be signed in to view your host dashboard.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "host") {
      return err("FORBIDDEN", "Only charging point hosts can access this dashboard.");
    }

    // 2. Fetch all chargers owned by this host
    const { data: hostChargers, error: chargersError } = await supabase
      .from("chargers")
      .select("id, title, connector_type, power_kw, price_per_hour, is_active")
      .eq("host_id", user.id);

    if (chargersError) {
      console.error("[loadHostBookings] Failed to query host chargers:", chargersError);
      return err("DATABASE_ERROR", "Could not load your charging points.");
    }

    if (!hostChargers || hostChargers.length === 0) {
      return ok({ bookings: [] });
    }

    const hostChargerIds = hostChargers.map((c) => c.id);
    const hostChargerMap = new Map<string, (typeof hostChargers)[0]>();
    for (const c of hostChargers) {
      hostChargerMap.set(c.id, c);
    }

    // 3. Fetch all bookings for the host's chargers
    const { data: rawBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status, total_cost, created_at, decided_at")
      .in("charger_id", hostChargerIds)
      .order("start_at", { ascending: true });

    if (bookingsError) {
      console.error("[loadHostBookings] Failed to query bookings for chargers:", bookingsError);
      return err("DATABASE_ERROR", "Could not load booking requests.");
    }

    if (!rawBookings || rawBookings.length === 0) {
      return ok({ bookings: [] });
    }

    // 4. Run Lazy Status Refresh
    const hostBookingIds = new Set(rawBookings.map((b) => b.id));
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

    const now = new Date();
    const { expiredIds, completedIds, updates } = refreshBookingStatuses(bookingRecords, now);

    const statusMap = new Map<string, string>();
    for (const u of updates) {
      statusMap.set(u.id, u.newStatus);
    }

    // Persist status updates asynchronously / conditionally using verified host booking IDs only
    if (updates.length > 0) {
      const adminClient = createAdminClient();
      try {
        const safeExpiredIds = expiredIds.filter((id) => hostBookingIds.has(id));
        const safeCompletedIds = completedIds.filter((id) => hostBookingIds.has(id));

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
        console.warn("[loadHostBookings] Lazy refresh persist failed:", persistErr);
      }
    }

    // 5. Driver names query: Select ONLY id and name from profiles (Never phone or email)
    const uniqueDriverIds = Array.from(new Set(rawBookings.map((b) => b.driver_id)));
    const driverNameMap = new Map<string, string>();

    if (uniqueDriverIds.length > 0) {
      const adminClient = createAdminClient();
      const { data: driverProfiles, error: driverProfilesError } = await adminClient
        .from("profiles")
        .select("id, name")
        .in("id", uniqueDriverIds);

      if (driverProfilesError) {
        console.warn("[loadHostBookings] Could not load driver profiles:", driverProfilesError);
      } else if (driverProfiles) {
        for (const p of driverProfiles) {
          driverNameMap.set(p.id, p.name || "Driver");
        }
      }
    }

    // 6. Assemble final HostBookingItem list
    const finalBookings: HostBookingItem[] = rawBookings.map((raw) => {
      const effectiveStatus = (statusMap.get(raw.id) || raw.status) as any;
      const ch = hostChargerMap.get(raw.charger_id);
      const driverName = driverNameMap.get(raw.driver_id) || "Driver";

      return {
        id: raw.id,
        chargerId: raw.charger_id,
        driverId: raw.driver_id,
        driverName,
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
      };
    });

    return ok({ bookings: finalBookings });
  } catch (err: any) {
    console.error("[loadHostBookings] Unexpected failure:", err);
    return err("INTERNAL_ERROR", "An unexpected error occurred while loading host bookings.");
  }
}
