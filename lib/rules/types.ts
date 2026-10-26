/**
 * Standard Result pattern used across all PlugNear business rules.
 * Functions return a Result instead of throwing exceptions on business rule violations.
 */
export interface RuleError {
  code: string;
  message: string;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: RuleError };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<T = never>(code: string, message: string): Result<T> {
  return { success: false, error: { code, message } };
}

export interface TimeSlot {
  startAt: Date | string;
  endAt: Date | string;
}

export interface AvailabilityWindow {
  id?: string;
  chargerId?: string;
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  dayOfWeek: number;
  /** Format "HH:MM" or "HH:MM:SS" */
  startTime: string;
  /** Format "HH:MM" or "HH:MM:SS" */
  endTime: string;
}

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired"
  | "completed";

export interface BookingRecord {
  id: string;
  chargerId: string;
  driverId: string;
  startAt: Date | string;
  endAt: Date | string;
  status: BookingStatus;
  totalCost?: number;
  decidedAt?: Date | string | null;
}

export type UserRole = "driver" | "host";

export interface Actor {
  userId: string;
  role: UserRole | "system";
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}
