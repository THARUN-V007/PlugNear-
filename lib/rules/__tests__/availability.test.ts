import { describe, it, expect } from "vitest";
import { checkAvailability } from "../availability";
import { ERROR_CODES } from "../constants";
import type { AvailabilityWindow } from "../types";

describe("Rule 2: Availability Windows", () => {
  // Sunday = 0, Monday = 1, etc.
  // 2026-11-01 is a Sunday (UTC).
  // 10:00 UTC = 15:30 IST (Sunday)
  // 12:00 UTC = 17:30 IST (Sunday)
  const sundayWindows: AvailabilityWindow[] = [
    {
      dayOfWeek: 0, // Sunday
      startTime: "10:00",
      endTime: "18:00",
    },
  ];

  it("accepts a slot that fits entirely inside a single window", () => {
    // 06:00 UTC to 08:00 UTC = 11:30 IST to 13:30 IST on Sunday (within 10:00 to 18:00)
    const slot = {
      startAt: "2026-11-01T06:00:00Z",
      endAt: "2026-11-01T08:00:00Z",
    };
    const charger = { isActive: true, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(true);
  });

  it("accepts a slot that ends exactly at the window boundary", () => {
    // 12:30 UTC = 18:00 IST (exactly window end)
    const slot = {
      startAt: "2026-11-01T10:00:00Z", // 15:30 IST
      endAt: "2026-11-01T12:30:00Z", // 18:00 IST
    };
    const charger = { isActive: true, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(true);
  });

  it("rejects a slot that ends one minute after the window boundary", () => {
    // 12:31 UTC = 18:01 IST (1 minute past window end)
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T12:31:00Z",
    };
    const charger = { isActive: true, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.OUTSIDE_AVAILABILITY);
    }
  });

  it("rejects a slot that starts before the window starts", () => {
    // 04:00 UTC = 09:30 IST (before 10:00 IST)
    const slot = {
      startAt: "2026-11-01T04:00:00Z",
      endAt: "2026-11-01T06:00:00Z",
    };
    const charger = { isActive: true, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.OUTSIDE_AVAILABILITY);
    }
  });

  it("rejects a slot on a day where the charger has no windows scheduled", () => {
    // 2026-11-02 is Monday (dayOfWeek = 1). Charger only has Sunday window.
    const slot = {
      startAt: "2026-11-02T06:00:00Z",
      endAt: "2026-11-02T08:00:00Z",
    };
    const charger = { isActive: true, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.OUTSIDE_AVAILABILITY);
    }
  });

  it("rejects a slot that crosses local midnight in Asia/Kolkata", () => {
    // 18:00 UTC = 23:30 IST
    // 19:30 UTC = 01:00 IST next day
    const slot = {
      startAt: "2026-11-01T18:00:00Z",
      endAt: "2026-11-01T19:30:00Z",
    };
    const charger = {
      isActive: true,
      windows: [
        { dayOfWeek: 0, startTime: "08:00", endTime: "23:59" },
        { dayOfWeek: 1, startTime: "00:00", endTime: "08:00" },
      ],
    };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.CROSSES_MIDNIGHT);
    }
  });

  it("rejects booking on an inactive charger", () => {
    const slot = {
      startAt: "2026-11-01T06:00:00Z",
      endAt: "2026-11-01T08:00:00Z",
    };
    const charger = { isActive: false, windows: sundayWindows };

    const result = checkAvailability(slot, charger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.CHARGER_INACTIVE);
    }
  });
});
