import { APP_CURRENCY } from "@/lib/rules";
import type {
  CreateChargerInput,
  UpdateChargerInput,
  HostConnectionType,
} from "@/lib/validation/charger";
import type { ConnectorType } from "@/lib/validation/search";

export interface StoredAvailabilityWindow {
  day_of_week: number;
  /** "HH:MM" or "HH:MM:SS" as stored by Postgres */
  start_time: string;
  /** "HH:MM" or "HH:MM:SS" as stored by Postgres */
  end_time: string;
}

export interface HostChargerListItem {
  id: string;
  hostId: string;
  title: string;
  addressText: string;
  latitude: number;
  longitude: number;
  connectorType: ConnectorType;
  powerKw: number;
  pricePerHour: number;
  notes: string | null;
  hostConnectionType: HostConnectionType;
  isActive: boolean;
  electricityPermissionAcknowledged: boolean;
  createdAt: string;

  // Metadata from joins
  windows: StoredAvailabilityWindow[];
  availabilityWindowsCount: number;
  upcomingConfirmedBookingsCount: number;
}

/**
 * Pure record builder for inserting a new charger into public.chargers.
 * Enforces that hostId comes exclusively from the verified session.
 */
export function buildChargerInsertRecord(input: CreateChargerInput, hostId: string) {
  return {
    host_id: hostId,
    title: input.title,
    address_text: input.address_text,
    latitude: input.latitude,
    longitude: input.longitude,
    connector_type: input.connector_type,
    power_kw: input.power_kw,
    price_per_hour: input.price_per_hour,
    notes: input.notes ?? null,
    host_connection_type: input.host_connection_type,
    electricity_permission_acknowledged: input.electricity_permission_acknowledged,
    is_active: true,
  };
}

/**
 * Pure record builder for updating an existing charger.
 * Explicit allow-list of editable fields: host_id and created_at can NEVER be updated.
 */
export function buildChargerUpdateRecord(input: UpdateChargerInput) {
  return {
    title: input.title,
    address_text: input.address_text,
    latitude: input.latitude,
    longitude: input.longitude,
    connector_type: input.connector_type,
    power_kw: input.power_kw,
    price_per_hour: input.price_per_hour,
    notes: input.notes ?? null,
    host_connection_type: input.host_connection_type,
    electricity_permission_acknowledged: input.electricity_permission_acknowledged,
  };
}

/**
 * Postgres returns a `time` as "06:00:00"; the listing form and our validation
 * both expect "HH:MM".
 */
export function toFormTime(value: string): string {
  const raw = String(value ?? "");
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

/**
 * Compact weekly schedule for a host's charger card.
 * Days sharing the same set of ranges collapse into one line ("Mon-Fri"),
 * so a normal week reads as two or three lines instead of seven.
 */
export interface ScheduleSummaryLine {
  days: string;
  ranges: string;
}

const DAY_SHORT_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function summarizeWeeklySchedule(
  windows: StoredAvailabilityWindow[]
): ScheduleSummaryLine[] {
  if (windows.length === 0) return [];

  const rangesByDay: string[][] = Array.from({ length: 7 }, () => []);
  for (const w of windows) {
    if (w.day_of_week < 0 || w.day_of_week > 6) continue;
    rangesByDay[w.day_of_week].push(`${w.start_time}-${w.end_time}`);
  }

  // Group consecutive days whose range lists are identical.
  const groups: Array<{ days: number[]; ranges: string }> = [];
  for (let day = 0; day < 7; day++) {
    const ranges = [...rangesByDay[day]].sort().join(", ");
    if (ranges === "") continue;

    const last = groups[groups.length - 1];
    if (last && last.ranges === ranges && last.days[last.days.length - 1] === day - 1) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], ranges });
    }
  }

  return groups.map((group) => ({
    days:
      group.days.length === 1
        ? DAY_SHORT_LABELS[group.days[0]]
        : `${DAY_SHORT_LABELS[group.days[0]]}-${DAY_SHORT_LABELS[group.days[group.days.length - 1]]}`,
    ranges: group.ranges,
  }));
}

/**
 * Formats charger price per hour with the app currency.
 */
export function formatChargerPrice(pricePerHour: number): string {
  const symbol = APP_CURRENCY === "INR" ? "₹" : `${APP_CURRENCY} `;
  return `${symbol}${pricePerHour.toFixed(2)}/hr`;
}

/**
 * Maps charger operation error codes to clear user-facing messages.
 */
export function mapChargerError(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "CHARGER_NOT_FOUND":
      return "Charger not found.";
    case "FORBIDDEN":
    case "UNAUTHORIZED_HOST":
      return "You are not authorized to manage this charger.";
    case "MIGRATION_MISSING":
      return "Database migration missing: Please apply supabase/migrations/20261027000004_add_charger_acknowledgement.sql in your Supabase SQL Editor.";
    case "DATABASE_ERROR":
      return "A database error occurred while saving the charger.";
    default:
      return fallbackMessage || "An unexpected error occurred. Please try again.";
  }
}
