import {
  type BookingRecord,
  type BookingStatus,
} from "@/lib/rules";

export interface HostBookingItem {
  id: string;
  chargerId: string;
  driverId: string;
  driverName: string; // Driver display name only (never phone or email)
  startAt: string; // ISO 8601 UTC
  endAt: string; // ISO 8601 UTC
  status: BookingStatus;
  totalCost: number;
  decidedAt?: string | null;
  createdAt: string;

  // Charger details
  chargerTitle: string;
  connectorType: string;
  powerKw: number;
  pricePerHour: number;
}

export interface GroupedHostBookings {
  pending: HostBookingItem[];
  upcomingConfirmed: HostBookingItem[];
  past: HostBookingItem[];
  pendingCount: number;
}

/**
 * Groups host bookings into 3 distinct operational sections:
 * 1. Pending Requests ('requested'): sorted by startAt ascending (nearest start first).
 * 2. Upcoming Confirmed ('confirmed'): sorted by startAt ascending (nearest start first).
 * 3. Past ('declined', 'cancelled', 'expired', 'completed'): sorted by endAt descending (newest end first).
 */
export function groupHostBookings(bookings: HostBookingItem[]): GroupedHostBookings {
  const pending: HostBookingItem[] = [];
  const upcomingConfirmed: HostBookingItem[] = [];
  const past: HostBookingItem[] = [];

  for (const b of bookings) {
    if (b.status === "requested") {
      pending.push(b);
    } else if (b.status === "confirmed") {
      upcomingConfirmed.push(b);
    } else {
      past.push(b);
    }
  }

  // Pending: nearest start time first (ascending)
  pending.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Upcoming confirmed: nearest start time first (ascending)
  upcomingConfirmed.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Past: newest end time first (descending)
  past.sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );

  return {
    pending,
    upcomingConfirmed,
    past,
    pendingCount: pending.length,
  };
}

/**
 * Action permissions for the host:
 *
 * 1. Approve: Only 'requested' bookings, strictly before slot start time.
 */
export function canHostApprove(
  booking: Pick<BookingRecord, "status" | "startAt">,
  now: Date | string = new Date()
): boolean {
  if (booking.status !== "requested") {
    return false;
  }
  const nowDate = typeof now === "string" ? new Date(now) : now;
  const startDate = typeof booking.startAt === "string" ? new Date(booking.startAt) : booking.startAt;
  return nowDate.getTime() < startDate.getTime();
}

/**
 * 2. Decline: Only 'requested' bookings.
 */
export function canHostDecline(
  booking: Pick<BookingRecord, "status">
): boolean {
  return booking.status === "requested";
}

/**
 * 3. Cancel: Only 'confirmed' bookings, strictly before slot start time.
 */
export function canHostCancel(
  booking: Pick<BookingRecord, "status" | "startAt">,
  now: Date | string = new Date()
): boolean {
  if (booking.status !== "confirmed") {
    return false;
  }
  const nowDate = typeof now === "string" ? new Date(now) : now;
  const startDate = typeof booking.startAt === "string" ? new Date(booking.startAt) : booking.startAt;
  return nowDate.getTime() < startDate.getTime();
}

export interface HostStatusBadgeDetails {
  label: string;
  badgeStyle: string;
  helpText: string;
}

/**
 * Returns plain-English user-friendly badge styling and explanatory text for hosts.
 */
export function getHostStatusBadgeDetails(status: BookingStatus): HostStatusBadgeDetails {
  switch (status) {
    case "requested":
      return {
        label: "Pending Review",
        badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        helpText: "Action required: Review and either approve or decline this driver request.",
      };
    case "confirmed":
      return {
        label: "Confirmed",
        badgeStyle: "bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30 shadow-[0_0_12px_rgba(57,255,20,0.15)]",
        helpText: "Booking confirmed. You can cancel strictly before the scheduled start time.",
      };
    case "declined":
      return {
        label: "Declined",
        badgeStyle: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        helpText: "You declined this booking request (or it was auto-declined on approval of a conflicting slot).",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeStyle: "bg-[#242933] text-slate-400 border-[#2C303B]",
        helpText: "This booking was cancelled prior to the scheduled start.",
      };
    case "expired":
      return {
        label: "Expired",
        badgeStyle: "bg-[#242933] text-slate-500 border-[#2C303B]",
        helpText: "Expired without decision before the scheduled slot start time.",
      };
    case "completed":
      return {
        label: "Completed",
        badgeStyle: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        helpText: "Charging session slot has concluded.",
      };
    default:
      return {
        label: status,
        badgeStyle: "bg-[#242933] text-slate-400 border-[#2C303B]",
        helpText: "",
      };
  }
}

/**
 * Formats a duration in minutes into a friendly string (e.g. "1 hr", "2 hrs 30 mins").
 */
export function formatDurationMinutes(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} mins`;
  }
  if (minutes === 0) {
    return hours === 1 ? "1 hr" : `${hours} hrs`;
  }
  return `${hours === 1 ? "1 hr" : `${hours} hrs`} ${minutes} mins`;
}

/**
 * Maps host operation error codes to clear, friendly user-facing messages.
 */
export function mapHostActionError(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "BOOKING_NOT_FOUND":
      return "Booking not found.";
    case "SLOT_BLOCKED":
    case "CONCURRENT_UPDATE":
    case "CONFLICT":
      return "This booking was just updated or another booking for this time was confirmed. Please refresh and try again.";
    case "CANNOT_CANCEL_STARTED":
      return "A confirmed booking cannot be cancelled once its scheduled start time has arrived.";
    case "UNAUTHORIZED_ACTOR":
      return "You are not authorized to manage bookings on this charger.";
    case "DRIVER_SLOT_CONFLICT":
      return "This driver already has a confirmed booking at another charger for that time, so it cannot be approved.";
    case "CHARGER_INACTIVE":
      return "This charging point is no longer active. Reactivate it or decline the request.";
    case "INVALID_TRANSITION":
      return "This action is no longer possible for this booking. Please refresh the page.";
    case "TERMINAL_STATE":
      return "This booking is in a final status and can no longer be modified.";
    case "MIGRATION_MISSING":
      return "Database migration missing: apply supabase/migrations/20261027000003_host_approval_atomicity.sql and supabase/migrations/20261028000003_booking_edge_integrity.sql in your Supabase SQL Editor.";
    default:
      return fallbackMessage || "An unexpected error occurred. Please try again.";
  }
}
