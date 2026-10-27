import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Result, ok, err } from "@/lib/rules";
import { toFormTime, type HostChargerListItem, type StoredAvailabilityWindow } from "./host-chargers-helpers";

export interface LoadHostChargersResult {
  chargers: HostChargerListItem[];
}

/**
 * Loads all chargers owned by the signed-in host with joined counts for
 * availability windows and upcoming confirmed bookings.
 *
 * Privacy Guarantees:
 * - Operates under host role authentication.
 * - Reads only chargers where host_id = user.id.
 * - Drivers cannot call or access this loader.
 */
export async function loadHostChargers(): Promise<Result<LoadHostChargersResult>> {
  try {
    const supabase = await createClient();

    // 1. Authenticate user from session and verify host role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err("UNAUTHORIZED", "You must be signed in to view your charging points.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "host") {
      return err("FORBIDDEN", "Only charging point hosts can access this portal.");
    }

    // 2. Fetch all chargers owned by this host
    let { data: rawChargers, error: chargersError } = await supabase
      .from("chargers")
      .select(`
        id,
        host_id,
        title,
        address_text,
        latitude,
        longitude,
        connector_type,
        power_kw,
        price_per_hour,
        notes,
        host_connection_type,
        is_active,
        electricity_permission_acknowledged,
        created_at
      `)
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    // Fallback if migration 20261027000004 has not yet been applied
    if (chargersError && (chargersError.message?.includes("electricity_permission_acknowledged") || chargersError.code === "42703")) {
      const fallback = await supabase
        .from("chargers")
        .select(`
          id,
          host_id,
          title,
          address_text,
          latitude,
          longitude,
          connector_type,
          power_kw,
          price_per_hour,
          notes,
          host_connection_type,
          is_active,
          created_at
        `)
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });

      if (!fallback.error && fallback.data) {
        rawChargers = fallback.data.map((c) => ({
          ...c,
          electricity_permission_acknowledged: true,
        }));
        chargersError = null;
      }
    }

    if (chargersError) {
      console.error("[loadHostChargers] Chargers query error:", chargersError);
      return err("DATABASE_ERROR", "Could not load your charging points.");
    }

    if (!rawChargers || rawChargers.length === 0) {
      return ok({ chargers: [] });
    }

    const chargerIds = rawChargers.map((c) => c.id);
    const adminClient = createAdminClient();

    // 3. Fetch the weekly availability schedule for every charger in one query
    const { data: windowsData, error: windowsError } = await adminClient
      .from("availability_windows")
      .select("charger_id, day_of_week, start_time, end_time")
      .in("charger_id", chargerIds)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    const windowsMap = new Map<string, StoredAvailabilityWindow[]>();
    if (!windowsError && windowsData) {
      for (const w of windowsData) {
        const list = windowsMap.get(w.charger_id) || [];
        list.push({
          day_of_week: Number(w.day_of_week),
          start_time: toFormTime(w.start_time),
          end_time: toFormTime(w.end_time),
        });
        windowsMap.set(w.charger_id, list);
      }
    } else if (windowsError) {
      console.error("[loadHostChargers] Windows query error:", windowsError);
    }

    // 4. Fetch count of upcoming confirmed bookings per charger (start_at > now)
    const nowIso = new Date().toISOString();
    const { data: bookingsData, error: bookingsError } = await adminClient
      .from("bookings")
      .select("charger_id")
      .in("charger_id", chargerIds)
      .eq("status", "confirmed")
      .gt("start_at", nowIso);

    const upcomingBookingsCountMap = new Map<string, number>();
    if (!bookingsError && bookingsData) {
      for (const b of bookingsData) {
        upcomingBookingsCountMap.set(
          b.charger_id,
          (upcomingBookingsCountMap.get(b.charger_id) || 0) + 1
        );
      }
    }

    // 5. Assemble final HostChargerListItem records
    const list: HostChargerListItem[] = rawChargers.map((c) => ({
      id: c.id,
      hostId: c.host_id,
      title: c.title,
      addressText: c.address_text,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      connectorType: c.connector_type,
      powerKw: Number(c.power_kw),
      pricePerHour: Number(c.price_per_hour),
      notes: c.notes,
      hostConnectionType: c.host_connection_type,
      isActive: Boolean(c.is_active),
      electricityPermissionAcknowledged: Boolean(c.electricity_permission_acknowledged),
      createdAt: c.created_at,
      windows: windowsMap.get(c.id) || [],
      availabilityWindowsCount: (windowsMap.get(c.id) || []).length,
      upcomingConfirmedBookingsCount: upcomingBookingsCountMap.get(c.id) || 0,
    }));

    return ok({ chargers: list });
  } catch (err: any) {
    console.error("[loadHostChargers] Unexpected error:", err);
    return err("INTERNAL_ERROR", "An unexpected error occurred while loading chargers.");
  }
}

/**
 * Loads a single charger by ID for the host edit form.
 * Returns 404 CHARGER_NOT_FOUND both when the charger does not exist
 * and when it belongs to another host (never 403).
 */
export async function loadHostChargerById(chargerId: string): Promise<Result<HostChargerListItem>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err("UNAUTHORIZED", "You must be signed in to view this charger.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "host") {
      return err("FORBIDDEN", "Only charging point hosts can view this charger.");
    }

    let { data: charger, error: chargerError } = await supabase
      .from("chargers")
      .select(`
        id,
        host_id,
        title,
        address_text,
        latitude,
        longitude,
        connector_type,
        power_kw,
        price_per_hour,
        notes,
        host_connection_type,
        is_active,
        electricity_permission_acknowledged,
        created_at
      `)
      .eq("id", chargerId)
      .eq("host_id", user.id)
      .maybeSingle();

    if (chargerError && (chargerError.message?.includes("electricity_permission_acknowledged") || chargerError.code === "42703")) {
      const fallback = await supabase
        .from("chargers")
        .select(`
          id,
          host_id,
          title,
          address_text,
          latitude,
          longitude,
          connector_type,
          power_kw,
          price_per_hour,
          notes,
          host_connection_type,
          is_active,
          created_at
        `)
        .eq("id", chargerId)
        .eq("host_id", user.id)
        .maybeSingle();

      if (!fallback.error && fallback.data) {
        charger = {
          ...fallback.data,
          electricity_permission_acknowledged: true,
        };
        chargerError = null;
      }
    }

    if (chargerError || !charger) {
      return err("CHARGER_NOT_FOUND", "Charger not found.");
    }

    const adminClient = createAdminClient();

    // Weekly schedule, ready to drop back into the listing form
    const { data: windowRows, error: windowRowsError } = await adminClient
      .from("availability_windows")
      .select("day_of_week, start_time, end_time")
      .eq("charger_id", charger.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (windowRowsError) {
      console.error("[loadHostChargerById] Windows query error:", windowRowsError);
    }

    const windows: StoredAvailabilityWindow[] = (windowRows || []).map((w) => ({
      day_of_week: Number(w.day_of_week),
      start_time: toFormTime(w.start_time),
      end_time: toFormTime(w.end_time),
    }));

    // Upcoming confirmed bookings count
    const nowIso = new Date().toISOString();
    const { count: upcomingCount } = await adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("charger_id", charger.id)
      .eq("status", "confirmed")
      .gt("start_at", nowIso);

    const item: HostChargerListItem = {
      id: charger.id,
      hostId: charger.host_id,
      title: charger.title,
      addressText: charger.address_text,
      latitude: Number(charger.latitude),
      longitude: Number(charger.longitude),
      connectorType: charger.connector_type,
      powerKw: Number(charger.power_kw),
      pricePerHour: Number(charger.price_per_hour),
      notes: charger.notes,
      hostConnectionType: charger.host_connection_type,
      isActive: Boolean(charger.is_active),
      electricityPermissionAcknowledged: Boolean(charger.electricity_permission_acknowledged),
      createdAt: charger.created_at,
      windows,
      availabilityWindowsCount: windows.length,
      upcomingConfirmedBookingsCount: upcomingCount || 0,
    };

    return ok(item);
  } catch (err: any) {
    console.error("[loadHostChargerById] Unexpected error:", err);
    return err("INTERNAL_ERROR", "An unexpected error occurred while loading charger.");
  }
}
