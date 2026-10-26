import { describe, it, expect } from "vitest";
import { toKolkataLocalDetails, timeStringToMinutes } from "../timezone";
import { APP_TIMEZONE, APP_TIMEZONE_OFFSET_MS } from "../constants";

describe("Timezone Utilities (Asia/Kolkata UTC+05:30)", () => {
  it("keeps constant timezone name and fixed +05:30 offset in one place", () => {
    expect(APP_TIMEZONE).toBe("Asia/Kolkata");
    expect(APP_TIMEZONE_OFFSET_MS).toBe(19800000); // 5.5 * 3600 * 1000
  });

  it("correctly converts a slot that falls on Sunday in UTC but on Monday in Asia/Kolkata", () => {
    // 2026-11-01 is Sunday.
    // At 20:00 UTC on Sunday, in Asia/Kolkata (+05:30) it is 01:30 AM on Monday, Nov 2!
    const utcDate = new Date("2026-11-01T20:00:00Z");

    // In UTC:
    expect(utcDate.getUTCDay()).toBe(0); // Sunday
    expect(utcDate.toISOString().slice(0, 10)).toBe("2026-11-01");

    // In Asia/Kolkata:
    const kolkata = toKolkataLocalDetails(utcDate);
    expect(kolkata.dayOfWeek).toBe(1); // Monday!
    expect(kolkata.calendarDate).toBe("2026-11-02"); // Next calendar day!
    expect(kolkata.timeString).toBe("01:30");
    expect(kolkata.minutesFromMidnight).toBe(90); // 1 hr 30 mins = 90 mins
  });

  it("correctly converts a slot that falls on the same calendar day in both UTC and Asia/Kolkata", () => {
    // 2026-11-01 at 06:00 UTC = 11:30 AM IST on the same day (Sunday)
    const utcDate = new Date("2026-11-01T06:00:00Z");
    const kolkata = toKolkataLocalDetails(utcDate);

    expect(kolkata.dayOfWeek).toBe(0); // Sunday
    expect(kolkata.calendarDate).toBe("2026-11-01");
    expect(kolkata.timeString).toBe("11:30");
    expect(kolkata.minutesFromMidnight).toBe(690); // 11 * 60 + 30
  });

  it("correctly parses time strings into minutes from midnight", () => {
    expect(timeStringToMinutes("00:00")).toBe(0);
    expect(timeStringToMinutes("08:30")).toBe(510);
    expect(timeStringToMinutes("22:00:00")).toBe(1320);
    expect(timeStringToMinutes("23:59")).toBe(1439);
  });
});
