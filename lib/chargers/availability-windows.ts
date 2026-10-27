import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, err, type Result } from "@/lib/rules";
import type { AvailabilityWindowInput } from "@/lib/validation/charger";

/**
 * Weekly windows in the shape stored by public.availability_windows.
 * Sorted by day then start time so the stored order is stable and the host's
 * schedule reads the same way in the edit form.
 */
export function toWindowRows(windows: AvailabilityWindowInput[]) {
  return [...windows]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((w) => ({
      day_of_week: w.day_of_week,
      start_time: w.start_time,
      end_time: w.end_time,
    }));
}

/**
 * Replaces a charger's whole weekly schedule in one atomic database call.
 *
 * The RPC is service-role only, and it rolls back as a unit: if the new set is
 * rejected, the previous schedule is still in place instead of the charger being
 * left with zero windows (which would silently remove it from every search).
 */
export async function replaceChargerAvailabilityWindows(
  adminClient: SupabaseClient,
  chargerId: string,
  windows: AvailabilityWindowInput[]
): Promise<Result<number>> {
  const rows = toWindowRows(windows);

  const { data, error } = await adminClient.rpc("replace_charger_availability_windows", {
    p_charger_id: chargerId,
    p_windows: rows,
  });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("cannot overlap")) {
      return err(
        "WINDOW_OVERLAP",
        "Your weekly windows overlap on the same day. Merge them or leave a gap between them."
      );
    }

    if (message.includes("CHARGER_NOT_FOUND")) {
      return err("CHARGER_NOT_FOUND", "Charger not found.");
    }

    if (
      error.code === "PGRST202" ||
      error.code === "42883" ||
      message.toLowerCase().includes("replace_charger_availability_windows")
    ) {
      return err(
        "MIGRATION_MISSING",
        "Database migration missing: apply supabase/migrations/20261028000001_replace_availability_windows.sql in your Supabase SQL Editor."
      );
    }

    console.error("[replaceChargerAvailabilityWindows] RPC error:", error);
    return err(
      "WINDOW_WRITE_FAILED",
      "Could not save the weekly availability schedule. Your previous schedule is unchanged."
    );
  }

  return ok(Number(data ?? 0));
}
