import {
  doRangesOverlap,
  calculateBookingCost,
  ERROR_CODES,
  type BookingRecord,
  type TimeSlot,
  type Result,
  ok,
  err,
} from "@/lib/rules";

/**
 * Maps domain and rules engine error codes to user-friendly plain-English messages.
 */
export function mapBookingRuleError(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "PAST_SLOT":
      return "The requested start time has already passed. Please select a future time slot.";
    case "INVALID_END_TIME":
      return "The booking end time must be after the start time.";
    case "DURATION_TOO_SHORT":
      return "Booking duration must be at least 30 minutes.";
    case "DURATION_TOO_LONG":
      return "Booking duration cannot exceed 8 hours.";
    case "INVALID_STEP":
      return "Booking duration must be in 30-minute increments.";
    case "INVALID_DATE_FORMAT":
      return "Invalid date or time format provided.";
    case "CHARGER_NOT_FOUND":
      return "The requested charging point could not be found.";
    case "CHARGER_INACTIVE":
      return "This charging point is currently inactive and cannot accept bookings.";
    case "CROSSES_MIDNIGHT":
      return "Bookings cannot cross midnight. Please book within a single calendar day.";
    case "OUTSIDE_AVAILABILITY":
      return "The requested slot is outside the host's operating schedule for this day.";
    case "SLOT_BLOCKED":
      return "This slot is no longer available as another booking was confirmed.";
    case "DUPLICATE_BOOKING":
      return "You already have an active booking or pending request for this charging point during this time slot.";
    case "DRIVER_SLOT_CONFLICT":
      return "You already have another confirmed booking at this time. A driver cannot charge at two places at once - cancel one of them first.";
    case "CANNOT_BOOK_ACROSS_MIDNIGHT":
      return "Emergency charging cannot be booked across local midnight. Less than 30 minutes remain in today's charging schedule.";
    case "UNAUTHORIZED":
      return "You must be signed in as an EV driver to request a booking.";
    case "FORBIDDEN":
      return "Only EV drivers may submit booking requests.";
    default:
      return fallbackMessage || "An unexpected error occurred while processing your booking request.";
  }
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  conflictingStatus?: "requested" | "confirmed";
  message?: string;
}

/**
 * Evaluates whether a driver already holds an active booking (requested or confirmed)
 * on the same charger that overlaps with the proposed slot.
 *
 * Rules:
 * - A request is a duplicate when the same driver holds a 'requested' or 'confirmed'
 *   booking on the same charger overlapping the new slot.
 * - Declined, cancelled, expired, and completed bookings do NOT count as duplicates.
 * - Other drivers' bookings NEVER count as duplicates for this driver.
 */
export function checkForDuplicateBooking(
  driverId: string,
  newSlot: TimeSlot,
  existingBookings: BookingRecord[]
): DuplicateCheckResult {
  const newStart = new Date(newSlot.startAt).getTime();
  const newEnd = new Date(newSlot.endAt).getTime();

  for (const b of existingBookings) {
    // Only check bookings created by the same driver
    if (b.driverId !== driverId) {
      continue;
    }

    // Only active statuses ('requested' or 'confirmed') block a duplicate request
    if (b.status !== "requested" && b.status !== "confirmed") {
      continue;
    }

    const bStart = new Date(b.startAt).getTime();
    const bEnd = new Date(b.endAt).getTime();

    // Half-open interval overlap check: start1 < end2 AND end1 > start2
    if (newStart < bEnd && newEnd > bStart) {
      const msg =
        b.status === "requested"
          ? "You already have a pending booking request for this charging point during this time slot."
          : "You already hold a confirmed booking for this charging point during this time slot.";

      return {
        isDuplicate: true,
        conflictingStatus: b.status,
        message: msg,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * A driver physically cannot charge at two places at once, but the database
 * exclusion constraint is per-charger, so nothing stopped a driver holding two
 * confirmed bookings on different chargers for the same time.
 *
 * `confirmedBookings` should be this driver's confirmed bookings that intersect
 * the proposed slot, regardless of charger.
 */
export function checkDriverCalendarConflict(
  driverId: string,
  newSlot: TimeSlot,
  confirmedBookings: BookingRecord[]
): Result<{ chargerId: string; bookingId: string }> {
  const newStart = new Date(newSlot.startAt).getTime();
  const newEnd = new Date(newSlot.endAt).getTime();

  for (const b of confirmedBookings) {
    if (b.driverId !== driverId) continue;
    if (b.status !== "confirmed") continue;

    const bStart = new Date(b.startAt).getTime();
    const bEnd = new Date(b.endAt).getTime();

    if (newStart < bEnd && newEnd > bStart) {
      return err<{ chargerId: string; bookingId: string }>(
        ERROR_CODES.DRIVER_SLOT_CONFLICT,
        "You already have a confirmed booking at this time on another charger. Cancel it before booking here."
      );
    }
  }

  return ok({ chargerId: "", bookingId: "" });
}

export interface BuildBookingParams {
  driverId: string;
  chargerId: string;
  slot: TimeSlot;
  pricePerHour: number;
}

export interface BuiltBookingRecord {
  charger_id: string;
  driver_id: string;
  start_at: string;
  end_at: string;
  status: "requested";
  total_cost: number;
  duration_minutes: number;
}

/**
 * Builds a sanitized booking insert payload from validated inputs.
 *
 * Guarantees:
 * - Driver ID is taken from the session argument, never from request body.
 * - Initial status is strictly 'requested'.
 * - Total cost is calculated server-side from pricePerHour using the rules engine.
 */
export function buildBookingRecord(params: BuildBookingParams): Result<BuiltBookingRecord> {
  const startDate = new Date(params.slot.startAt);
  const endDate = new Date(params.slot.endAt);
  const durationMs = endDate.getTime() - startDate.getTime();

  if (isNaN(durationMs) || durationMs <= 0) {
    return err("INVALID_END_TIME", "Booking end time must be after start time.");
  }

  const durationMinutes = Math.round(durationMs / (60 * 1000));
  const costResult = calculateBookingCost(durationMinutes, params.pricePerHour);

  if (!costResult.success) {
    return err(costResult.error.code, costResult.error.message);
  }

  return ok({
    charger_id: params.chargerId,
    driver_id: params.driverId,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    status: "requested",
    total_cost: costResult.data.totalCost,
    duration_minutes: durationMinutes,
  });
}
