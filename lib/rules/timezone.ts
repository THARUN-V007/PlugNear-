import { APP_TIMEZONE, APP_TIMEZONE_OFFSET_MS } from "./constants";

export interface LocalTimeDetails {
  /** Day of week in Asia/Kolkata: 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  dayOfWeek: number;
  /** YYYY-MM-DD calendar date in Asia/Kolkata */
  calendarDate: string;
  /** Minutes from midnight in Asia/Kolkata (0 to 1439) */
  minutesFromMidnight: number;
  /** Formatted "HH:MM" */
  timeString: string;
}

/**
 * Converts a UTC Date or ISO string into its corresponding Asia/Kolkata local details.
 */
export function toKolkataLocalDetails(utcDateOrIso: Date | string): LocalTimeDetails {
  const utcDate = typeof utcDateOrIso === "string" ? new Date(utcDateOrIso) : utcDateOrIso;

  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid date provided to toKolkataLocalDetails: ${utcDateOrIso}`);
  }

  // Shift UTC timestamp by +05:30 (19,800,000 ms) to read local wall-clock values via UTC methods
  const shifted = new Date(utcDate.getTime() + APP_TIMEZONE_OFFSET_MS);

  const dayOfWeek = shifted.getUTCDay();
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const date = String(shifted.getUTCDate()).padStart(2, "0");
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();

  const calendarDate = `${year}-${month}-${date}`;
  const minutesFromMidnight = hours * 60 + minutes;
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return {
    dayOfWeek,
    calendarDate,
    minutesFromMidnight,
    timeString,
  };
}

/**
 * Converts "HH:MM" or "HH:MM:SS" time string into minutes from midnight (0 to 1440).
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) {
    throw new Error(`Invalid time string format: ${timeStr}. Expected HH:MM or HH:MM:SS`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes >= 60) {
    throw new Error(`Invalid time components in: ${timeStr}`);
  }

  return hours * 60 + minutes;
}
