import { describe, it, expect } from "vitest";
import {
  kolkataInputsToUtcSlot,
  getDefaultSearchDateTime,
  getEmptyStateMessage,
  formatDistance,
  formatPrice,
  DEFAULT_MAP_CENTER,
} from "../search-helpers";

describe("Search Helpers (Unit Tests)", () => {
  describe("kolkataInputsToUtcSlot", () => {
    it("converts same-day Asia/Kolkata slot to UTC instants correctly", () => {
      // 2026-11-01 at 15:30 IST is 10:00 UTC (15:30 - 05:30 = 10:00)
      const input = {
        date: "2026-11-01",
        startTime: "15:30",
        durationMinutes: 60,
      };

      const { startAt, endAt } = kolkataInputsToUtcSlot(input);

      expect(startAt).toBe("2026-11-01T10:00:00.000Z");
      expect(endAt).toBe("2026-11-01T11:00:00.000Z");
    });

    it("correctly converts an early morning IST slot where UTC falls on the PREVIOUS calendar day", () => {
      // 2026-11-02 at 02:00 IST in the morning:
      // In UTC, this is 2026-11-01 at 20:30 UTC (8:30 PM on the previous day)
      const input = {
        date: "2026-11-02",
        startTime: "02:00",
        durationMinutes: 90,
      };

      const { startAt, endAt } = kolkataInputsToUtcSlot(input);

      expect(startAt).toBe("2026-11-01T20:30:00.000Z"); // Previous calendar day in UTC!
      expect(endAt).toBe("2026-11-01T22:00:00.000Z");
    });
  });

  describe("getDefaultSearchDateTime", () => {
    it("generates a slot starting at a 30-minute interval in the future", () => {
      // Given fixed now: 10:10 AM IST
      const now = new Date("2026-11-01T04:40:00Z"); // 10:10 AM IST
      const defaults = getDefaultSearchDateTime(now);

      expect(defaults.date).toBe("2026-11-01");
      // 10:10 + 30 mins = 10:40 -> next 30m boundary is 11:00 AM
      expect(defaults.startTime).toBe("11:00");
      expect(defaults.durationMinutes).toBe(60);
    });
  });

  describe("getEmptyStateMessage", () => {
    it("returns zero-in-radius message when totalInRadius is 0", () => {
      const msg = getEmptyStateMessage({ totalInRadius: 0, availableCount: 0 }, 10);
      expect(msg.title).toContain("No chargers found within 10 km");
      expect(msg.hint).toContain("expanding your search radius");
    });

    it("returns busy/occupied message when chargers exist in radius but none are free", () => {
      const msg = getEmptyStateMessage({ totalInRadius: 3, availableCount: 0 }, 10);
      expect(msg.title).toContain("3 chargers nearby, but none are free");
      expect(msg.hint).toContain("confirmed bookings or closed");
    });
  });

  describe("Formatting Helpers", () => {
    it("formats distances under 1 km in meters and over 1 km in km", () => {
      expect(formatDistance(0.4)).toBe("400 m away");
      expect(formatDistance(2.34)).toBe("2.3 km away");
    });

    it("formats prices with INR symbol", () => {
      expect(formatPrice(150)).toBe("₹150.00/hr");
    });

    it("has a valid default seed map center in Indiranagar Bengaluru", () => {
      expect(DEFAULT_MAP_CENTER.latitude).toBeCloseTo(12.9719);
      expect(DEFAULT_MAP_CENTER.longitude).toBeCloseTo(77.6412);
    });
  });
});
