import {
  APP_TIMEZONE,
  APP_TIMEZONE_OFFSET_MS,
  MIN_SLOT_DURATION_MINUTES,
  SLOT_STEP_MINUTES,
  toKolkataLocalDetails,
  timeStringToMinutes,
  type GeoPoint,
} from "@/lib/rules";

/**
 * Default Seed Map Center: Indiranagar, Bengaluru (Karnataka, India)
 * Used as initial center so first-time users immediately see seed chargers.
 */
export const DEFAULT_MAP_CENTER: GeoPoint = {
  latitude: 12.9719,
  longitude: 77.6412,
};

export const DEFAULT_MAP_ZOOM = 14;

export interface KolkataSlotInput {
  date: string; // YYYY-MM-DD in Asia/Kolkata
  startTime: string; // HH:MM in Asia/Kolkata
  durationMinutes: number; // In 30-min steps
}

export interface UtcSlotOutput {
  startAt: string; // ISO 8601 UTC
  endAt: string; // ISO 8601 UTC
}

/**
 * Converts Asia/Kolkata local date, start time, and duration into UTC instants.
 *
 * Formula:
 * localEpochMs = Date.UTC(year, month - 1, day, hours, minutes)
 * utcStartMs = localEpochMs - APP_TIMEZONE_OFFSET_MS (+05:30)
 * utcEndMs = utcStartMs + (durationMinutes * 60 * 1000)
 */
export function kolkataInputsToUtcSlot(input: KolkataSlotInput): UtcSlotOutput {
  const { date, startTime, durationMinutes } = input;

  const dateParts = date.trim().split("-");
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`);
  }

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  const startMinutes = timeStringToMinutes(startTime);
  const hours = Math.floor(startMinutes / 60);
  const minutes = startMinutes % 60;

  // Compute UTC milliseconds by subtracting the +05:30 offset
  const localEpoch = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const utcStartMs = localEpoch - APP_TIMEZONE_OFFSET_MS;
  const utcEndMs = utcStartMs + durationMinutes * 60 * 1000;

  return {
    startAt: new Date(utcStartMs).toISOString(),
    endAt: new Date(utcEndMs).toISOString(),
  };
}

/**
 * Generates sensible default date and time values in Asia/Kolkata:
 * Start at next half-hour boundary that is at least 30 minutes in the future.
 */
export function getDefaultSearchDateTime(now: Date = new Date()): {
  date: string;
  startTime: string;
  durationMinutes: number;
} {
  // Convert current instant to Asia/Kolkata
  const kolkataNow = toKolkataLocalDetails(now);

  // Add 30 minutes buffer, then round up to next 30-minute step
  const minFutureMinutes = kolkataNow.minutesFromMidnight + 30;
  let nextSlotMinutes = Math.ceil(minFutureMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;

  let slotDate = kolkataNow.calendarDate;

  // If slot pushes past midnight, roll into tomorrow morning 08:00
  if (nextSlotMinutes >= 24 * 60) {
    const tomorrowMs = now.getTime() + 24 * 60 * 60 * 1000;
    slotDate = toKolkataLocalDetails(new Date(tomorrowMs)).calendarDate;
    nextSlotMinutes = 8 * 60; // 08:00 AM
  }

  const hours = Math.floor(nextSlotMinutes / 60);
  const minutes = nextSlotMinutes % 60;
  const startTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return {
    date: slotDate,
    startTime,
    durationMinutes: 60, // Default 1 hour
  };
}

/**
 * Produces helpful, human-readable empty state messages based on metadata.
 */
export function getEmptyStateMessage(
  meta: { totalInRadius: number; availableCount: number },
  radiusKm: number
): { title: string; hint: string } {
  if (meta.totalInRadius === 0) {
    return {
      title: `No chargers found within ${radiusKm} km.`,
      hint: "Try expanding your search radius to 25 km or selecting a different search location.",
    };
  }

  return {
    title: `${meta.totalInRadius} charger${meta.totalInRadius > 1 ? "s" : ""} nearby, but none are free for this time slot.`,
    hint: "All nearby chargers are either occupied by confirmed bookings or closed during these hours. Try adjusting your start time or choosing another day.",
  };
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

export function formatPrice(pricePerHour: number): string {
  return `₹${pricePerHour.toFixed(2)}/hr`;
}
