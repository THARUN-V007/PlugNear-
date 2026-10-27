import { APP_CURRENCY } from "@/lib/rules";
import type {
  CreateChargerInput,
  UpdateChargerInput,
  HostConnectionType,
} from "@/lib/validation/charger";
import type { ConnectorType } from "@/lib/validation/search";

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
