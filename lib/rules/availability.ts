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

  // 2. Reject slots crossing local midnight
  if (startDetails.calendarDate !== endDetails.calendarDate) {
    return err(
      ERROR_CODES.CROSSES_MIDNIGHT,
      "Booking slots that cross local midnight are not allowed."
    );
  }

  const slotDay = startDetails.dayOfWeek;
  const slotStartMins = startDetails.minutesFromMidnight;
  const slotEndMins = endDetails.minutesFromMidnight;

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
