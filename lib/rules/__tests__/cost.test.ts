import { describe, it, expect } from "vitest";
import { calculateBookingCost } from "../cost";
import { ERROR_CODES, APP_CURRENCY } from "../constants";

describe("Rule 4: Cost Calculation", () => {
  it("calculates cost for whole hours", () => {
    // 2 hours @ 150.00/hr = 300.00
    const result = calculateBookingCost(120, 150);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(300.0);
      expect(result.data.durationHours).toBe(2);
      expect(result.data.currency).toBe(APP_CURRENCY);
    }
  });

  it("calculates cost for half hours", () => {
    // 1.5 hours @ 180.00/hr = 270.00
    const result = calculateBookingCost(90, 180);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(270.0);
      expect(result.data.durationHours).toBe(1.5);
    }
  });

  it("rounds cost correctly to two decimal places", () => {
    // 30 mins (0.5 hr) @ 125.55/hr = 62.775 -> rounds to 62.78
    const result = calculateBookingCost(30, 125.55);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(62.78);
    }
  });

  it("handles free/zero-price chargers", () => {
    const result = calculateBookingCost(60, 0);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(0.0);
    }
  });

  it("rejects negative hourly price", () => {
    const result = calculateBookingCost(60, -50);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_PRICE);
    }
  });

  it("rejects zero or negative duration", () => {
    const zeroResult = calculateBookingCost(0, 100);
    expect(zeroResult.success).toBe(false);
    if (!zeroResult.success) {
      expect(zeroResult.error.code).toBe(ERROR_CODES.INVALID_DURATION);
    }

    const negResult = calculateBookingCost(-30, 100);
    expect(negResult.success).toBe(false);
    if (!negResult.success) {
      expect(negResult.error.code).toBe(ERROR_CODES.INVALID_DURATION);
    }
  });

  it("rejects NaN inputs safely", () => {
    const result = calculateBookingCost(NaN, 100);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_DURATION);
    }
  });
});
