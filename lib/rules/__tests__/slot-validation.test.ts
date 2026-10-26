import { describe, it, expect } from "vitest";
import { validateSlot } from "../slot-validation";
import { ERROR_CODES } from "../constants";

describe("Rule 1: Slot Validation", () => {
  const fixedNow = new Date("2026-11-01T08:00:00Z");

  it("accepts a valid 1-hour slot in the future", () => {
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T11:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durationMinutes).toBe(60);
      expect(result.data.durationHours).toBe(1);
    }
  });

  it("accepts a valid 30-minute minimum duration slot", () => {
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T10:30:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durationMinutes).toBe(30);
    }
  });

  it("accepts a valid 8-hour maximum duration slot", () => {
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T18:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durationMinutes).toBe(480);
      expect(result.data.durationHours).toBe(8);
    }
  });

  it("rejects a slot that starts in the past", () => {
    const slot = {
      startAt: "2026-11-01T07:00:00Z",
      endAt: "2026-11-01T08:30:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.PAST_SLOT);
    }
  });

  it("rejects a slot that starts exactly at now", () => {
    const slot = {
      startAt: "2026-11-01T08:00:00Z",
      endAt: "2026-11-01T09:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.PAST_SLOT);
    }
  });

  it("rejects a slot where end time is before start time", () => {
    const slot = {
      startAt: "2026-11-01T12:00:00Z",
      endAt: "2026-11-01T11:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_END_TIME);
    }
  });

  it("rejects a slot where end time equals start time", () => {
    const slot = {
      startAt: "2026-11-01T12:00:00Z",
      endAt: "2026-11-01T12:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_END_TIME);
    }
  });

  it("rejects a slot that is shorter than 30 minutes", () => {
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T10:25:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.DURATION_TOO_SHORT);
    }
  });

  it("rejects a slot that exceeds 8 hours", () => {
    const slot = {
      startAt: "2026-11-01T09:00:00Z",
      endAt: "2026-11-01T17:30:00Z", // 8.5 hours
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.DURATION_TOO_LONG);
    }
  });

  it("rejects a slot whose duration is not a multiple of 30 minutes", () => {
    const slot = {
      startAt: "2026-11-01T10:00:00Z",
      endAt: "2026-11-01T10:45:00Z", // 45 minutes
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_STEP);
    }
  });

  it("rejects an invalid date format", () => {
    const slot = {
      startAt: "not-a-valid-date",
      endAt: "2026-11-01T10:00:00Z",
    };
    const result = validateSlot(slot, fixedNow);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_DATE_FORMAT);
    }
  });
});
