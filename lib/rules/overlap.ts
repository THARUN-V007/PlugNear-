import { ERROR_CODES } from "./constants";
import { ok, err, type Result, type TimeSlot, type BookingRecord } from "./types";

/**
 * Checks if two half-open time ranges [start, end) overlap.
 *
 * Formula: a.start < b.end AND a.end > b.start
 * Back-to-back intervals ([10:00, 11:00) and [11:00, 12:00)) return false.
 */
export function doRangesOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = typeof a.startAt === "string" ? new Date(a.startAt).getTime() : a.startAt.getTime();
  const aEnd = typeof a.endAt === "string" ? new Date(a.endAt).getTime() : a.endAt.getTime();
  const bStart = typeof b.startAt === "string" ? new Date(b.startAt).getTime() : b.startAt.getTime();
  const bEnd = typeof b.endAt === "string" ? new Date(b.endAt).getTime() : b.endAt.getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Checks whether a requested slot overlaps with any confirmed booking on the charger.
 * Only confirmed bookings block slots; pending ('requested') bookings do NOT block.
 */
export function checkSlotOverlap(
  slot: TimeSlot,
  existingBookings: BookingRecord[],
  chargerId?: string
): Result<{ overlappingBookingId?: string }> {
  const conflicting = existingBookings.find((b) => {
    // If chargerId specified, only compare bookings on the same charger
    if (chargerId && b.chargerId !== chargerId) {
      return false;
    }

    // Only confirmed bookings block a slot
    if (b.status !== "confirmed") {
      return false;
    }

    return doRangesOverlap(slot, b);
  });

  if (conflicting) {
    return err(
      ERROR_CODES.SLOT_BLOCKED,
      "The requested slot conflicts with an existing confirmed booking."
    );
  }

  return ok({});
}

/**
 * Auto-decline helper:
 * When a booking is confirmed by a host, finds all other pending ('requested') bookings
 * on the same charger that overlap with the newly confirmed slot and must be auto-declined.
 */
export function findConflictingPendingBookings(
  confirmedBooking: BookingRecord,
  allBookingsOnCharger: BookingRecord[]
): BookingRecord[] {
  return allBookingsOnCharger.filter((b) => {
    if (b.id === confirmedBooking.id) {
      return false;
    }
    if (b.status !== "requested") {
      return false;
    }
    if (b.chargerId !== confirmedBooking.chargerId) {
      return false;
    }

    return doRangesOverlap(confirmedBooking, b);
  });
}
