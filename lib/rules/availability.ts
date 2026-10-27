import { ERROR_CODES } from "./constants";
import { toKolkataLocalDetails, timeStringToMinutes } from "./timezone";
import { ok, err, type Result, type TimeSlot, type AvailabilityWindow } from "./types";

export interface ChargerAvailabilityInfo {
  isActive: boolean;
  windows: AvailabilityWindow[];
}

/**
 * Checks whether a requested slot falls within the charger's availability windows.
 *
 * Rules:
 * 1. An inactive charger is never bookable (CHARGER_INACTIVE).
 * 2. Slot must not cross local midnight in Asia/Kolkata (CROSSES_MIDNIGHT).
 * 3. Slot must fit entirely inside ONE availability window on that local day (OUTSIDE_AVAILABILITY).
 */
export function checkAvailability(
  slot: TimeSlot,
  charger: ChargerAvailabilityInfo
): Result<AvailabilityWindow> {
  // 1. Active check
  if (!charger.isActive) {
    return err(
      ERROR_CODES.CHARGER_INACTIVE,
      "This charger is currently inactive and cannot be booked."
    );
  }

  const startDetails = toKolkataLocalDetails(slot.startAt);
  const endDetails = toKolkataLocalDetails(slot.endAt);

  const startMs = new Date(slot.startAt).getTime();
  const endMs = new Date(slot.endAt).getTime();
  const durationMs = endMs - startMs;

  // 2. A slot may end exactly at local midnight - 23:30 to 00:00 inside a window
  // that runs to the end of the day is legal, and "24:00" is a valid window end.
  // Anything that lands at midnight a day or more later is genuinely crossing it.
  const endsAtMidnight =
    endDetails.minutesFromMidnight === 0 &&
    endDetails.calendarDate !== startDetails.calendarDate &&
    durationMs > 0 &&
    durationMs <= 24 * 60 * 60 * 1000;

  if (startDetails.calendarDate !== endDetails.calendarDate && !endsAtMidnight) {
    return err(
      ERROR_CODES.CROSSES_MIDNIGHT,
      "Booking slots that cross local midnight are not allowed."
    );
  }

  const slotDay = startDetails.dayOfWeek;
  const slotStartMins = startDetails.minutesFromMidnight;
  // Midnight is minute 1440 of the starting day, which is how a "24:00" window end reads.
  const slotEndMins = endsAtMidnight ? 1440 : endDetails.minutesFromMidnight;

  // Filter windows matching the local day of week
  const dayWindows = charger.windows.filter((w) => w.dayOfWeek === slotDay);

  if (dayWindows.length === 0) {
    return err(
      ERROR_CODES.OUTSIDE_AVAILABILITY,
      "The charger has no availability windows scheduled for this day."
    );
  }

  // 3. Find a single window that entirely encloses the slot:
  // window.start <= slot.start AND slot.end <= window.end
  const matchingWindow = dayWindows.find((window) => {
    try {
      const windowStartMins = timeStringToMinutes(window.startTime);
      const windowEndMins = timeStringToMinutes(window.endTime);

      return windowStartMins <= slotStartMins && slotEndMins <= windowEndMins;
    } catch {
      return false;
    }
  });

  if (!matchingWindow) {
    return err(
      ERROR_CODES.OUTSIDE_AVAILABILITY,
      "The requested slot falls outside the charger's availability windows."
    );
  }

  return ok(matchingWindow);
}

/**
 * A weekly availability window exactly as a host drafts it in the listing form.
 * Times are local wall-clock strings in the app timezone (Asia/Kolkata).
 */
export interface WindowDraft {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const WINDOW_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates a host's whole weekly availability pattern.
 *
 * Mirrors the two database guards on public.availability_windows so a form
 * submission is rejected with a readable message instead of a Postgres error:
 * 1. check_window_end_after_start - end_time must be strictly after start_time.
 * 2. tr_check_window_overlap - no two windows may overlap on the same day.
 *
 * Windows are compared per day and must all lie within 0..6 / 00:00..23:59.
 */
export function validateWeeklyWindows(
  windows: WindowDraft[]
): Result<{ minutes: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> }> {
  if (!Array.isArray(windows) || windows.length === 0) {
    return err(
      ERROR_CODES.WINDOWS_REQUIRED,
      "Add at least one weekly availability window so drivers can find your charger."
    );
  }

  const normalized: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> = [];

  for (const window of windows) {
    if (
      !Number.isInteger(window.dayOfWeek) ||
      window.dayOfWeek < 0 ||
      window.dayOfWeek > 6
    ) {
      return err(
        ERROR_CODES.INVALID_WINDOW_DAY,
        "Every availability window must belong to a weekday between Sunday (0) and Saturday (6)."
      );
    }

    if (
      !WINDOW_TIME_PATTERN.test(window.startTime) ||
      !WINDOW_TIME_PATTERN.test(window.endTime)
    ) {
      return err(
        ERROR_CODES.INVALID_WINDOW_TIME,
        'Availability times must be 24-hour "HH:MM" values, for example 06:30.'
      );
    }

    const startMinutes = timeStringToMinutes(window.startTime);
    const endMinutes = timeStringToMinutes(window.endTime);

    if (endMinutes <= startMinutes) {
      return err(
        ERROR_CODES.WINDOW_END_BEFORE_START,
        `The ${DAY_LABELS[window.dayOfWeek]} window ends at ${window.endTime} but starts at ${window.startTime}. A window cannot end before it starts, and it may not cross midnight.`
      );
    }

    normalized.push({ dayOfWeek: window.dayOfWeek, startMinutes, endMinutes });
  }

  // Half-open comparison: 06:00-10:00 and 10:00-14:00 on the same day are fine,
  // which keeps a host's back-to-back windows consistent with booking overlap rules.
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;

      if (a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes) {
        return err(
          ERROR_CODES.WINDOW_OVERLAP,
          `Your ${DAY_LABELS[a.dayOfWeek]} windows overlap. Merge them or leave a gap between them.`
        );
      }
    }
  }

  return ok({ minutes: normalized });
}

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
