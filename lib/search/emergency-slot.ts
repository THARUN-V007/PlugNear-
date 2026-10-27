import {
  toKolkataLocalDetails,
  validateSlot,
  ok,
  err,
  type Result,
  type TimeSlot,
} from "@/lib/rules";

/**
 * 10-minute buffer for emergency charging:
 * Gives a stranded driver realistic time to review the nearest result,
 * inspect details, and confirm the booking without the start time falling into the past.
 */
export const EMERGENCY_START_BUFFER_MINUTES = 10;

/**
 * Default duration for emergency charging: 1 hour (60 minutes).
 */
export const EMERGENCY_DEFAULT_DURATION_MINUTES = 60;

export interface EmergencySlotDetails {
  startAt: string; // ISO 8601 UTC
  endAt: string; // ISO 8601 UTC
  durationMinutes: number; // 60 or 30 (if clamped before midnight)
}

/**
 * Builds an emergency booking slot based on an injected or current server time.
 *
 * Rules:
 * 1. Start time is `now + EMERGENCY_START_BUFFER_MINUTES` (10 minutes).
 * 2. Target duration is 1 hour (60 minutes).
 * 3. Near midnight in Asia/Kolkata:
 *    - The slot must not cross local midnight (per domain availability rules).
 *    - If 60 minutes crosses midnight, clamp duration to 30 minutes if that remains
 *      on the same calendar day before midnight.
 *    - If even a 30-minute slot crosses midnight (less than 30 minutes remain today),
 *      return a clear error instructing the driver to use standard search for tomorrow.
 * 4. Must pass `validateSlot(slot, now)` from the rules engine.
 */
export function buildEmergencySlot(
  now: Date = new Date()
): Result<EmergencySlotDetails> {
  const startMs = now.getTime() + EMERGENCY_START_BUFFER_MINUTES * 60 * 1000;
  const startDate = new Date(startMs);
  const startKolkata = toKolkataLocalDetails(startDate);

  // Attempt 1: Full 60-minute duration
  let durationMinutes = EMERGENCY_DEFAULT_DURATION_MINUTES;
  let endMs = startMs + durationMinutes * 60 * 1000;
  let endDate = new Date(endMs);
  let endKolkata = toKolkataLocalDetails(endDate);

  // If 60 minutes crosses local midnight, clamp to 30 minutes
  if (endKolkata.calendarDate !== startKolkata.calendarDate) {
    durationMinutes = 30;
    endMs = startMs + durationMinutes * 60 * 1000;
    endDate = new Date(endMs);
    endKolkata = toKolkataLocalDetails(endDate);
  }

  // If even a 30-minute duration crosses midnight, less than 30 min remain today
  if (endKolkata.calendarDate !== startKolkata.calendarDate) {
    return err(
      "CANNOT_BOOK_ACROSS_MIDNIGHT",
      "Emergency charging cannot be booked across local midnight. Less than 30 minutes remain in today's charging schedule. Please use normal search to schedule a booking for tomorrow."
    );
  }

  const slot: TimeSlot = {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
  };

  // Verify against domain rules engine validateSlot
  const validation = validateSlot(slot, now);
  if (!validation.success) {
    return err(validation.error.code, validation.error.message);
  }

  return ok({
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    durationMinutes,
  });
}
