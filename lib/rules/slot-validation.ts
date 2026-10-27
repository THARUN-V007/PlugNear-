import {
  ERROR_CODES,
  MIN_SLOT_DURATION_MINUTES,
  MAX_SLOT_DURATION_MINUTES,
  SLOT_STEP_MINUTES,
} from "./constants";
import { ok, err, type Result, type TimeSlot } from "./types";

export interface ValidatedSlotDetails {
  durationMinutes: number;
  durationHours: number;
  start: Date;
  end: Date;
}

/**
 * Validates a requested booking slot.
 *
 * Rules:
 * 1. Start time must be in the future relative to the supplied `now`.
 * 2. End time must be strictly after start time.
 * 3. Duration must be between 30 minutes and 8 hours (480 minutes) inclusive.
 * 4. Duration must be in exact 30-minute steps.
 */
export function validateSlot(
  slot: TimeSlot,
  now: Date | string
): Result<ValidatedSlotDetails> {
  const startDate = typeof slot.startAt === "string" ? new Date(slot.startAt) : slot.startAt;
  const endDate = typeof slot.endAt === "string" ? new Date(slot.endAt) : slot.endAt;
  const nowDate = typeof now === "string" ? new Date(now) : now;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(nowDate.getTime())) {
    return err(
      ERROR_CODES.INVALID_DATE_FORMAT,
      "One or more provided dates have an invalid format."
    );
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const nowMs = nowDate.getTime();

  // 1. Must be in the future relative to now
  if (startMs <= nowMs) {
    return err(
      ERROR_CODES.PAST_SLOT,
      "Booking start time must be in the future."
    );
  }

  // 2. End must be after start
  if (endMs <= startMs) {
    return err(
      ERROR_CODES.INVALID_END_TIME,
      "Booking end time must be after start time."
    );
  }

  const durationMs = endMs - startMs;
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000;

  // All three checks work in exact milliseconds. Rounding to minutes first would
  // let a 29.5-minute slot read as 30 and slip past the 30-minute step rule.
  if (durationMs < MIN_SLOT_DURATION_MINUTES * 60 * 1000) {
    return err(
      ERROR_CODES.DURATION_TOO_SHORT,
      `Booking duration must be at least ${MIN_SLOT_DURATION_MINUTES} minutes.`
    );
  }

  if (durationMs > MAX_SLOT_DURATION_MINUTES * 60 * 1000) {
    return err(
      ERROR_CODES.DURATION_TOO_LONG,
      `Booking duration cannot exceed ${MAX_SLOT_DURATION_MINUTES / 60} hours.`
    );
  }

  // Duration must land on a whole number of 30-minute steps.
  if (durationMs % stepMs !== 0) {
    return err(
      ERROR_CODES.INVALID_STEP,
      `Booking duration must be in increments of ${SLOT_STEP_MINUTES} minutes.`
    );
  }

  const durationMinutes = durationMs / (60 * 1000);

  return ok({
    durationMinutes,
    durationHours: durationMinutes / 60,
    start: startDate,
    end: endDate,
  });
}
