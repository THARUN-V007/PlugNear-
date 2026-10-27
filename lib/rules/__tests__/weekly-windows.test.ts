import { describe, it, expect } from "vitest";
import { validateWeeklyWindows, ERROR_CODES } from "@/lib/rules";

const DAY = 1; // Monday

function windowOverride(overrides: Partial<{ dayOfWeek: number; startTime: string; endTime: string }> = {}) {
  return {
    dayOfWeek: DAY,
    startTime: "06:00",
    endTime: "22:00",
    ...overrides,
  };
}

describe("Rule 2b: Weekly Availability Window Definitions", () => {
  it("accepts a clean set of windows", () => {
    const result = validateWeeklyWindows([
      windowOverride(),
      windowOverride({ dayOfWeek: 2, startTime: "09:00", endTime: "18:00" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("requires at least one window, otherwise the charger is invisible to search", () => {
    const result = validateWeeklyWindows([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.WINDOWS_REQUIRED);
    }
  });

  it("rejects days outside the 0..6 range", () => {
    expect(validateWeeklyWindows([windowOverride({ dayOfWeek: 7 })]).success).toBe(false);
    expect(validateWeeklyWindows([windowOverride({ dayOfWeek: -1 })]).success).toBe(false);
    expect(validateWeeklyWindows([windowOverride({ dayOfWeek: 1.5 })]).success).toBe(false);
  });

  it("rejects malformed or 12-hour time strings", () => {
    for (const startTime of ["6:00", "06:00:00", "24:00", "90:00", "06:75", "morning"]) {
      const result = validateWeeklyWindows([windowOverride({ startTime })]);
      expect(result.success, `expected ${startTime} to be rejected`).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.INVALID_WINDOW_TIME);
      }
    }
  });

  it("rejects a window that ends before or exactly at its start", () => {
    for (const endTime of ["06:00", "05:00"]) {
      const result = validateWeeklyWindows([windowOverride({ endTime })]);
      expect(result.success, `expected end ${endTime} to be rejected`).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.WINDOW_END_BEFORE_START);
      }
    }
  });

  it("never allows a window to cross midnight", () => {
    const result = validateWeeklyWindows([
      windowOverride({ startTime: "22:00", endTime: "02:00" }),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.WINDOW_END_BEFORE_START);
    }
  });

  it("rejects two windows overlapping on the same day", () => {
    const result = validateWeeklyWindows([
      windowOverride({ startTime: "06:00", endTime: "12:00" }),
      windowOverride({ startTime: "10:00", endTime: "14:00" }),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.WINDOW_OVERLAP);
      expect(result.error.message).toContain("Monday");
    }
  });

  it("allows back-to-back windows on the same day", () => {
    // Half-open comparison, consistent with the booking overlap rule.
    const result = validateWeeklyWindows([
      windowOverride({ startTime: "06:00", endTime: "12:00" }),
      windowOverride({ startTime: "12:00", endTime: "18:00" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("allows the same times on different days", () => {
    const result = validateWeeklyWindows([
      windowOverride({ dayOfWeek: 1, startTime: "06:00", endTime: "12:00" }),
      windowOverride({ dayOfWeek: 2, startTime: "06:00", endTime: "12:00" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("reports the offending day in the message so the form can show it", () => {
    const result = validateWeeklyWindows([
      windowOverride({ dayOfWeek: 5, startTime: "18:00", endTime: "09:00" }),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("Friday");
      expect(result.error.message).toContain("09:00");
    }
  });
});
