import {
  toKolkataLocalDetails,
  timeStringToMinutes,
  type BookingRecord,
} from "@/lib/rules";

export interface EditorWindowItem {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

/**
 * 7-day schedule map where key is day_of_week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export type WeeklyEditorSchedule = Record<number, EditorWindowItem[]>;

export interface DatabaseAvailabilityRow {
  id?: string;
  charger_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** 30-minute time step options from 00:00 to 23:00 for start, and 00:30 to 23:30 for end */
export const START_TIME_OPTIONS: string[] = [];
export const END_TIME_OPTIONS: string[] = [];

for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  START_TIME_OPTIONS.push(`${hh}:00`);
  if (h < 23 || (h === 23)) {
    START_TIME_OPTIONS.push(`${hh}:30`);
  }
}

for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  if (h > 0 || true) {
    END_TIME_OPTIONS.push(`${hh}:30`);
  }
  if (h < 23) {
    const nextH = String(h + 1).padStart(2, "0");
    END_TIME_OPTIONS.push(`${nextH}:00`);
  }
}
// Clean deduped sorted options:
// Start: 00:00 to 23:00
// End: 00:30 to 23:30
export const VALID_START_TIMES = Array.from(
  new Set(
    Array.from({ length: 47 }, (_, i) => {
      const mins = i * 30;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    })
  )
);

export const VALID_END_TIMES = Array.from(
  new Set(
    Array.from({ length: 47 }, (_, i) => {
      const mins = (i + 1) * 30;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    })
  )
);

/**
 * Creates an empty 7-day schedule.
 */
export function createEmptySchedule(): WeeklyEditorSchedule {
  return {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
}

/**
 * Normalizes time string from Postgres ("06:00:00") or inputs ("6:00") into "HH:MM".
 */
export function normalizeTimeString(timeStr: string): string {
  const trimmed = String(timeStr ?? "").trim();
  const parts = trimmed.split(":");
  if (parts.length < 2) return trimmed;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Checks whether a time string is on a clean 30-minute step (:00 or :30).
 */
export function isThirtyMinuteStep(timeStr: string): boolean {
  const parts = normalizeTimeString(timeStr).split(":");
  if (parts.length !== 2) return false;
  const mins = parseInt(parts[1], 10);
  return mins === 0 || mins === 30;
}

export interface ScheduleValidationResult {
  valid: boolean;
  isEmpty: boolean;
  totalWindows: number;
  errorsByDay: Record<number, string[]>;
  allErrors: string[];
}

/**
 * Validates a weekly schedule from the editor or API payload.
 *
 * Enforces:
 * 1. 30-minute interval alignment.
 * 2. End time strictly after start time.
 * 3. Minimum duration: 30 minutes.
 * 4. No window crossing midnight (latest end is 23:30).
 * 5. No overlapping windows on the same day.
 * 6. No touching windows on the same day (e.g. 09:00-12:00 and 12:00-15:00 should be merged).
 */
export function validateWeeklyEditorSchedule(
  schedule: WeeklyEditorSchedule
): ScheduleValidationResult {
  const errorsByDay: Record<number, string[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };
  const allErrors: string[] = [];
  let totalWindows = 0;

  for (let day = 0; day <= 6; day++) {
    const windows = schedule[day] || [];
    totalWindows += windows.length;
    const dayLabel = DAY_NAMES[day];

    const parsedWindows: Array<{ startMins: number; endMins: number; index: number }> = [];

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const startNorm = normalizeTimeString(w.startTime);
      const endNorm = normalizeTimeString(w.endTime);

      // 1. Time format & 30-minute step check
      let startMins = 0;
      let endMins = 0;
      try {
        startMins = timeStringToMinutes(startNorm);
        endMins = timeStringToMinutes(endNorm);
      } catch {
        const msg = `${dayLabel}: Invalid time format. Times must be HH:MM.`;
        errorsByDay[day].push(msg);
        allErrors.push(msg);
        continue;
      }

      if (!isThirtyMinuteStep(startNorm) || !isThirtyMinuteStep(endNorm)) {
        const msg = `${dayLabel} window ${i + 1}: Times must be chosen in 30-minute steps.`;
        errorsByDay[day].push(msg);
        allErrors.push(msg);
      }

      // 2. End time after start time & midnight boundary
      if (endMins <= startMins) {
        const msg = `${dayLabel} window ${i + 1} (${startNorm} – ${endNorm}): End time must be strictly after start time and cannot cross midnight.`;
        errorsByDay[day].push(msg);
        allErrors.push(msg);
        continue;
      }

      // 3. Minimum duration of 30 minutes
      if (endMins - startMins < 30) {
        const msg = `${dayLabel} window ${i + 1}: Window duration must be at least 30 minutes.`;
        errorsByDay[day].push(msg);
        allErrors.push(msg);
      }

      // 4. Latest end time check (23:30)
      if (endMins > 23 * 60 + 30) {
        const msg = `${dayLabel} window ${i + 1}: Latest allowed end time is 23:30 (11:30 PM).`;
        errorsByDay[day].push(msg);
        allErrors.push(msg);
      }

      parsedWindows.push({ startMins, endMins, index: i });
    }

    // 5 & 6. Overlap and Touching check on the same day
    for (let a = 0; a < parsedWindows.length; a++) {
      for (let b = a + 1; b < parsedWindows.length; b++) {
        const w1 = parsedWindows[a];
        const w2 = parsedWindows[b];

        // Overlapping: w1.start < w2.end && w1.end > w2.start
        if (w1.startMins < w2.endMins && w1.endMins > w2.startMins) {
          const msg = `${dayLabel}: Windows ${w1.index + 1} and ${w2.index + 1} overlap. Please adjust or merge them.`;
          errorsByDay[day].push(msg);
          allErrors.push(msg);
        } else if (w1.endMins === w2.startMins || w2.endMins === w1.startMins) {
          // Touching: contiguous boundary
          const msg = `${dayLabel}: Windows ${w1.index + 1} and ${w2.index + 1} touch back-to-back. Please merge them into a single continuous window.`;
          errorsByDay[day].push(msg);
          allErrors.push(msg);
        }
      }
    }
  }

  const valid = allErrors.length === 0;
  return {
    valid,
    isEmpty: totalWindows === 0,
    totalWindows,
    errorsByDay,
    allErrors,
  };
}

/**
 * Converts WeeklyEditorSchedule to database row drafts.
 */
export function editorScheduleToDatabaseRows(
  schedule: WeeklyEditorSchedule,
  chargerId?: string
): DatabaseAvailabilityRow[] {
  const rows: DatabaseAvailabilityRow[] = [];

  for (let day = 0; day <= 6; day++) {
    const windows = schedule[day] || [];
    for (const w of windows) {
      rows.push({
        charger_id: chargerId,
        day_of_week: day,
        start_time: normalizeTimeString(w.startTime),
        end_time: normalizeTimeString(w.endTime),
      });
    }
  }

  // Sort by day asc, then start_time asc
  rows.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.start_time.localeCompare(b.start_time);
  });

  return rows;
}

/**
 * Converts stored database rows into WeeklyEditorSchedule.
 */
export function databaseRowsToEditorSchedule(
  rows: DatabaseAvailabilityRow[]
): WeeklyEditorSchedule {
  const schedule = createEmptySchedule();

  for (const r of rows) {
    if (r.day_of_week >= 0 && r.day_of_week <= 6) {
      schedule[r.day_of_week].push({
        id: r.id || `${r.day_of_week}-${schedule[r.day_of_week].length}-${Date.now()}`,
        startTime: normalizeTimeString(r.start_time),
        endTime: normalizeTimeString(r.end_time),
      });
    }
  }

  // Sort each day's windows ascending
  for (let day = 0; day <= 6; day++) {
    schedule[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return schedule;
}

/**
 * Generates a human-friendly plain text summary of the weekly schedule.
 * Example: "Mon-Fri 09:00 - 17:00, Sat 10:00 - 14:00" or "No availability schedule set"
 */
export function summarizeSchedule(schedule: WeeklyEditorSchedule): string {
  const rows = editorScheduleToDatabaseRows(schedule);
  if (rows.length === 0) return "No availability schedule set";

  const rangesByDay: string[][] = Array.from({ length: 7 }, () => []);
  for (const r of rows) {
    rangesByDay[r.day_of_week].push(`${r.start_time} - ${r.end_time}`);
  }

  const groups: Array<{ days: number[]; ranges: string }> = [];
  for (let day = 0; day < 7; day++) {
    const ranges = rangesByDay[day].join(", ");
    if (!ranges) continue;

    const last = groups[groups.length - 1];
    if (last && last.ranges === ranges && last.days[last.days.length - 1] === day - 1) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], ranges });
    }
  }

  if (groups.length === 0) return "No availability schedule set";

  return groups
    .map((g) => {
      const daysStr =
        g.days.length === 1
          ? DAY_SHORT_NAMES[g.days[0]]
          : `${DAY_SHORT_NAMES[g.days[0]]}-${DAY_SHORT_NAMES[g.days[g.days.length - 1]]}`;
      return `${daysStr}: ${g.ranges}`;
    })
    .join(" | ");
}

export interface ConflictingBookingNotice {
  bookingId: string;
  startAt: string;
  endAt: string;
  localDate: string;
  localTime: string;
  dayName: string;
}

/**
 * Identifies upcoming confirmed bookings on this charger that will fall outside
 * the newly proposed weekly schedule.
 */
export function findConfirmedBookingsOutsideNewSchedule(
  bookings: BookingRecord[],
  newSchedule: WeeklyEditorSchedule,
  chargerId: string
): ConflictingBookingNotice[] {
  const conflicting: ConflictingBookingNotice[] = [];

  for (const b of bookings) {
    // Only inspect confirmed bookings for this specific charger
    if (b.status !== "confirmed" || b.chargerId !== chargerId) {
      continue;
    }

    const startDetails = toKolkataLocalDetails(b.startAt);
    const endDetails = toKolkataLocalDetails(b.endAt);

    const slotDay = startDetails.dayOfWeek;
    const slotStartMins = startDetails.minutesFromMidnight;
    const slotEndMins = endDetails.minutesFromMidnight;

    // Retrieve the proposed windows for this day
    const dayWindows = newSchedule[slotDay] || [];

    // Check if the booking slot fits entirely inside ONE of the proposed windows
    const fitsInOneWindow = dayWindows.some((w) => {
      try {
        const wStartMins = timeStringToMinutes(normalizeTimeString(w.startTime));
        const wEndMins = timeStringToMinutes(normalizeTimeString(w.endTime));
        return wStartMins <= slotStartMins && slotEndMins <= wEndMins;
      } catch {
        return false;
      }
    });

    if (!fitsInOneWindow) {
      conflicting.push({
        bookingId: b.id,
        startAt: typeof b.startAt === "string" ? b.startAt : b.startAt.toISOString(),
        endAt: typeof b.endAt === "string" ? b.endAt : b.endAt.toISOString(),
        localDate: startDetails.calendarDate,
        localTime: `${startDetails.timeString} – ${endDetails.timeString}`,
        dayName: DAY_NAMES[slotDay],
      });
    }
  }

  return conflicting;
}

/**
 * Schedule Presets & Shortcut Transformers
 */
export function applyMondayToWeekdays(schedule: WeeklyEditorSchedule): WeeklyEditorSchedule {
  const mondayWindows = schedule[1] || [];
  const updated = { ...schedule };

  // Apply to Tuesday (2), Wednesday (3), Thursday (4), Friday (5)
  for (let day = 2; day <= 5; day++) {
    updated[day] = mondayWindows.map((w, idx) => ({
      id: `${day}-${idx}-${Date.now()}`,
      startTime: w.startTime,
      endTime: w.endTime,
    }));
  }
  return updated;
}

export function applyDayToAllDays(
  schedule: WeeklyEditorSchedule,
  sourceDay: number
): WeeklyEditorSchedule {
  const sourceWindows = schedule[sourceDay] || [];
  const updated = { ...schedule };

  for (let day = 0; day <= 6; day++) {
    if (day === sourceDay) continue;
    updated[day] = sourceWindows.map((w, idx) => ({
      id: `${day}-${idx}-${Date.now()}`,
      startTime: w.startTime,
      endTime: w.endTime,
    }));
  }
  return updated;
}

export function getPresetSchedule(
  preset: "weekdays_9_to_5" | "all_week_daytime" | "all_week_extended"
): WeeklyEditorSchedule {
  const schedule = createEmptySchedule();

  switch (preset) {
    case "weekdays_9_to_5":
      // Mon-Fri 09:00 - 17:00
      for (let day = 1; day <= 5; day++) {
        schedule[day] = [{ id: `${day}-0`, startTime: "09:00", endTime: "17:00" }];
      }
      break;

    case "all_week_daytime":
      // Sun-Sat 06:00 - 22:00
      for (let day = 0; day <= 6; day++) {
        schedule[day] = [{ id: `${day}-0`, startTime: "06:00", endTime: "22:00" }];
      }
      break;

    case "all_week_extended":
      // Sun-Sat 06:00 - 23:30 (Max allowed before midnight)
      for (let day = 0; day <= 6; day++) {
        schedule[day] = [{ id: `${day}-0`, startTime: "06:00", endTime: "23:30" }];
      }
      break;
  }

  return schedule;
}
