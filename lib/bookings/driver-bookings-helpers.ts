import {
  type BookingRecord,
  type BookingStatus,
  type Actor,
  canViewExactLocation,
  toKolkataLocalDetails,
} from "@/lib/rules";

export interface DriverBookingItem {
  id: string;
  chargerId: string;
  driverId: string;
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
  hostId: string;

  // Location details (Strictly guarded by canViewExactLocation)
  approximateLocation: { latitude: number; longitude: number };
  exactAddress: string | null; // Non-null ONLY for confirmed bookings
  exactLocation: { latitude: number; longitude: number } | null; // Non-null ONLY for confirmed bookings
  directionsUrl: string | null; // Non-null ONLY for confirmed bookings
}

export interface GroupedBookings {
  upcoming: DriverBookingItem[];
  past: DriverBookingItem[];
}

/**
 * Groups driver bookings into Upcoming and Past categories:
 * - Upcoming: 'requested', 'confirmed' (sorted nearest start time first, ascending)
 * - Past: 'declined', 'cancelled', 'expired', 'completed' (sorted newest end time first, descending)
 */
export function groupDriverBookings(bookings: DriverBookingItem[]): GroupedBookings {
  const upcoming: DriverBookingItem[] = [];
  const past: DriverBookingItem[] = [];

  for (const b of bookings) {
    if (b.status === "requested" || b.status === "confirmed") {
      upcoming.push(b);
    } else {
      past.push(b);
    }
  }

  // Upcoming: nearest start time first (ascending)
  upcoming.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Past: newest end time first (descending)
  past.sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );

  return { upcoming, past };
}

export interface StatusBadgeDetails {
  label: string;
  badgeStyle: string;
  helpText: string;
}

/**
 * Returns plain-English user-friendly badge styling and explanatory text for every status.
 */
export function getStatusBadgeDetails(status: BookingStatus): StatusBadgeDetails {
  switch (status) {
    case "requested":
      return {
        label: "Requested",
        badgeStyle: "bg-amber-100 text-amber-900 border-amber-300",
        helpText: "Waiting for the host to review and approve your booking request.",
      };
    case "confirmed":
      return {
        label: "Confirmed",
        badgeStyle: "bg-emerald-100 text-emerald-900 border-emerald-300",
        helpText: "Confirmed! The host accepted your booking. Exact address and driving directions unlocked.",
      };
    case "declined":
      return {
        label: "Declined",
        badgeStyle: "bg-rose-100 text-rose-900 border-rose-300",
        helpText: "The host declined this booking request.",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
        helpText: "This booking was cancelled.",
      };
    case "expired":
      return {
        label: "Expired",
        badgeStyle: "bg-slate-100 text-slate-600 border-slate-300",
        helpText: "Expired: the host did not respond in time before the scheduled slot arrived.",
      };
    case "completed":
      return {
        label: "Completed",
        badgeStyle: "bg-blue-100 text-blue-900 border-blue-300",
        helpText: "Charging session completed.",
      };
    default:
      return {
        label: status,
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
        helpText: "",
      };
  }
}

/**
 * Determines whether a driver is allowed to cancel a booking right now.
 *
 * Rules:
 * - 'requested': Always cancellable by the driver.
 * - 'confirmed': Cancellable ONLY while the slot has not started (now < startAt).
 * - 'declined', 'cancelled', 'expired', 'completed': Final statuses, never cancellable.
 */
export function canCancelBooking(
  booking: Pick<BookingRecord, "status" | "startAt">,
  now: Date | string = new Date()
): boolean {
  if (booking.status === "requested") {
    return true;
  }

  if (booking.status === "confirmed") {
    const nowDate = typeof now === "string" ? new Date(now) : now;
    const startDate = typeof booking.startAt === "string" ? new Date(booking.startAt) : booking.startAt;
    return nowDate.getTime() < startDate.getTime();
  }

  return false;
}

/**
 * Builds a Google Maps turn-by-turn directions URL for a confirmed charger.
 */
export function getGoogleMapsDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/**
 * Maps cancellation error codes to user-friendly plain-English messages.
 */
export function mapCancellationError(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "BOOKING_NOT_FOUND":
      return "Booking not found.";
    case "TERMINAL_STATE":
      return "This booking is in a final status and can no longer be cancelled.";
    case "CANNOT_CANCEL_STARTED":
      return "This confirmed booking cannot be cancelled because its scheduled charging time has already started.";
    case "UNAUTHORIZED_ACTOR":
      return "You are not authorized to cancel this booking.";
    case "INVALID_TRANSITION":
      return "This booking cannot be cancelled in its current state.";
    case "CONCURRENT_UPDATE":
      return "This booking was just updated. Please refresh and try again.";
    default:
      return fallbackMessage || "An unexpected error occurred while cancelling your booking.";
  }
}
