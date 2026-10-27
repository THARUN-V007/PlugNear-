import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Result, ok, err, type BookingRecord } from "@/lib/rules";
import type { DatabaseAvailabilityRow } from "./availability-helpers";

export interface LoadAvailabilityDataResult {
  charger: {
    id: string;
    title: string;
    isActive: boolean;
  };
  windows: DatabaseAvailabilityRow[];
  upcomingConfirmedBookings: BookingRecord[];
}

/**
 * Server-only loader that retrieves charger info, existing availability windows,
 * and upcoming confirmed bookings for the weekly availability editor.
 *
 * Privacy & Security:
 * - Host role required.
 * - Verifies host_id === session user.id.
 * - Returns 404 CHARGER_NOT_FOUND if charger belongs to another host (never leaks).
 */
export async function loadAvailabilityData(
  chargerId: string
): Promise<Result<LoadAvailabilityDataResult>> {
  try {
    const supabase = await createClient();

    // 1. Authenticate host from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return err("UNAUTHORIZED", "You must be signed in to manage charger availability.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "host") {
      return err("FORBIDDEN", "Only charging point hosts can edit availability.");
    }

    // 2. Query charger verifying ownership
    const adminClient = createAdminClient();
    const { data: charger, error: chargerError } = await adminClient
      .from("chargers")
      .select("id, host_id, title, is_active")
      .eq("id", chargerId)
      .maybeSingle();

    if (chargerError || !charger || charger.host_id !== user.id) {
      return err("CHARGER_NOT_FOUND", "Charger not found.");
    }

    // 3. Query existing windows
    const { data: windowRows, error: windowsError } = await adminClient
      .from("availability_windows")
      .select("id, charger_id, day_of_week, start_time, end_time")
      .eq("charger_id", chargerId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (windowsError) {
      console.error("[loadAvailabilityData] Windows query error:", windowsError);
      return err("DATABASE_ERROR", "Could not load current availability windows.");
    }

    const windows: DatabaseAvailabilityRow[] = (windowRows || []).map((w) => ({
      id: w.id,
      charger_id: w.charger_id,
      day_of_week: Number(w.day_of_week),
      start_time: String(w.start_time),
      end_time: String(w.end_time),
    }));

    // 4. Query upcoming confirmed bookings
    const nowIso = new Date().toISOString();
    const { data: bookingRows, error: bookingsError } = await adminClient
      .from("bookings")
      .select("id, charger_id, driver_id, start_at, end_at, status")
      .eq("charger_id", chargerId)
      .eq("status", "confirmed")
      .gt("end_at", nowIso)
      .order("start_at", { ascending: true });

    if (bookingsError) {
      console.error("[loadAvailabilityData] Bookings query error:", bookingsError);
    }

    const upcomingConfirmedBookings: BookingRecord[] = (bookingRows || []).map((b) => ({
      id: b.id,
      chargerId: b.charger_id,
      driverId: b.driver_id,
      startAt: new Date(b.start_at),
      endAt: new Date(b.end_at),
      status: b.status,
    }));

    return ok({
      charger: {
        id: charger.id,
        title: charger.title,
        isActive: Boolean(charger.is_active),
      },
      windows,
      upcomingConfirmedBookings,
    });
  } catch (err: any) {
    console.error("[loadAvailabilityData] Unexpected error:", err);
    return err("INTERNAL_ERROR", "An unexpected server error occurred.");
  }
}
