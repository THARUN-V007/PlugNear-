import { describe, it, expect } from "vitest";
import {
  buildEmergencySlot,
  EMERGENCY_START_BUFFER_MINUTES,
  EMERGENCY_DEFAULT_DURATION_MINUTES,
} from "../emergency-slot";
import { validateSlot, toKolkataLocalDetails, APP_TIMEZONE_OFFSET_MS } from "@/lib/rules";
import { getEmptyStateMessage } from "../search-helpers";
import type { SearchResultItem } from "../search-assembly";

// Helper to construct precise Date instances corresponding to specific Asia/Kolkata local times
function createKolkataDate(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number
): Date {
  const localEpoch = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const utcEpoch = localEpoch - APP_TIMEZONE_OFFSET_MS;
  return new Date(utcEpoch);
}

describe("Developer D Step 4: Emergency Mode", () => {
  describe("Emergency Slot Builder (with Injected 'now')", () => {
    it("starts strictly in the future with exactly a 10-minute buffer", () => {
      const now = createKolkataDate(2026, 10, 27, 14, 0); // 14:00 IST
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const startMs = new Date(result.data.startAt).getTime();
      const nowMs = now.getTime();
      const diffMinutes = Math.round((startMs - nowMs) / (60 * 1000));

      expect(diffMinutes).toBe(EMERGENCY_START_BUFFER_MINUTES);
      expect(startMs).toBeGreaterThan(nowMs);
    });

    it("creates a slot that is exactly one hour long during normal daytime hours", () => {
      const now = createKolkataDate(2026, 10, 27, 10, 15); // 10:15 IST
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.durationMinutes).toBe(EMERGENCY_DEFAULT_DURATION_MINUTES);

      const startMs = new Date(result.data.startAt).getTime();
      const endMs = new Date(result.data.endAt).getTime();
      expect(endMs - startMs).toBe(60 * 60 * 1000); // Exactly 60 minutes
    });

    it("passes the rules engine validateSlot check cleanly", () => {
      const now = createKolkataDate(2026, 10, 27, 16, 30); // 16:30 IST
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const slotValidation = validateSlot(
        {
          startAt: result.data.startAt,
          endAt: result.data.endAt,
        },
        now
      );

      expect(slotValidation.success).toBe(true);
      if (!slotValidation.success) return;
      expect(slotValidation.data.durationMinutes).toBe(60);
    });

    // --- Near-Midnight Behavior Tests (as required by prompt) ---

    it("starts at 22:30 IST: creates a full 60-minute slot ending at 23:30 IST on the same day", () => {
      // With 10 min buffer, now is 22:20 IST so start is exactly 22:30 IST
      const now = createKolkataDate(2026, 10, 27, 22, 20);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const startDetails = toKolkataLocalDetails(result.data.startAt);
      const endDetails = toKolkataLocalDetails(result.data.endAt);

      expect(startDetails.timeString).toBe("22:30");
      expect(endDetails.timeString).toBe("23:30");
      expect(startDetails.calendarDate).toBe(endDetails.calendarDate);
      expect(result.data.durationMinutes).toBe(60);
    });

    it("starts at 23:00 IST: clamps duration to 30 minutes ending at 23:30 IST before midnight", () => {
      // With 10 min buffer, now is 22:50 IST so start is exactly 23:00 IST
      const now = createKolkataDate(2026, 10, 27, 22, 50);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const startDetails = toKolkataLocalDetails(result.data.startAt);
      const endDetails = toKolkataLocalDetails(result.data.endAt);

      expect(startDetails.timeString).toBe("23:00");
      expect(endDetails.timeString).toBe("23:30");
      expect(startDetails.calendarDate).toBe(endDetails.calendarDate);
      expect(result.data.durationMinutes).toBe(30);

      // Validate that rules engine approves 30-min duration
      const validation = validateSlot(
        {
          startAt: result.data.startAt,
          endAt: result.data.endAt,
        },
        now
      );
      expect(validation.success).toBe(true);
    });

    it("starts at 23:25 IST: clamps duration to 30 minutes ending at 23:55 IST before midnight", () => {
      // With 10 min buffer, now is 23:15 IST so start is exactly 23:25 IST
      const now = createKolkataDate(2026, 10, 27, 23, 15);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const startDetails = toKolkataLocalDetails(result.data.startAt);
      const endDetails = toKolkataLocalDetails(result.data.endAt);

      expect(startDetails.timeString).toBe("23:25");
      expect(endDetails.timeString).toBe("23:55");
      expect(startDetails.calendarDate).toBe(endDetails.calendarDate);
      expect(result.data.durationMinutes).toBe(30);
    });

    it("starts at 23:45 IST: returns clear error when less than 30 minutes remain before midnight", () => {
      // With 10 min buffer, now is 23:35 IST so start is exactly 23:45 IST (only 15m to midnight)
      const now = createKolkataDate(2026, 10, 27, 23, 35);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe("CANNOT_BOOK_ACROSS_MIDNIGHT");
      expect(result.error.message).toContain("Emergency charging cannot be booked across local midnight");
      expect(result.error.message).toContain("normal search");
    });

    it("when 'now' is at 23:25 IST: start is at 23:35 IST (25m to midnight), rejects with clear error", () => {
      const now = createKolkataDate(2026, 10, 27, 23, 25); // Start is 23:35 IST (< 30m remain)
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe("CANNOT_BOOK_ACROSS_MIDNIGHT");
      expect(result.error.message).toContain("Less than 30 minutes remain");
    });

    it("when 'now' is at 23:45 IST: start is at 23:55 IST (5m to midnight), rejects with clear error", () => {
      const now = createKolkataDate(2026, 10, 27, 23, 45);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe("CANNOT_BOOK_ACROSS_MIDNIGHT");
    });

    it("starts just after midnight (00:05 IST): creates a full 60-minute slot on the new calendar day", () => {
      // 00:05 IST on 2026-10-28
      const now = createKolkataDate(2026, 10, 28, 0, 5);
      const result = buildEmergencySlot(now);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const startDetails = toKolkataLocalDetails(result.data.startAt);
      const endDetails = toKolkataLocalDetails(result.data.endAt);

      expect(startDetails.timeString).toBe("00:15");
      expect(endDetails.timeString).toBe("01:15");
      expect(startDetails.calendarDate).toBe("2026-10-28");
      expect(endDetails.calendarDate).toBe("2026-10-28");
      expect(result.data.durationMinutes).toBe(60);
    });
  });

  describe("Nearest Result Selection", () => {
    it("always picks the candidate with the smallest distance as the top emergency result", () => {
      const mockChargers: Partial<SearchResultItem>[] = [
        { id: "charger-1", title: "Charger 1", distanceKm: 4.2 },
        { id: "charger-2", title: "Nearest Charger", distanceKm: 0.8 },
        { id: "charger-3", title: "Charger 3", distanceKm: 2.1 },
      ];

      // Sort candidate chargers nearest first
      const sorted = [...mockChargers].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

      const nearest = sorted[0];
      expect(nearest.id).toBe("charger-2");
      expect(nearest.title).toBe("Nearest Charger");
      expect(nearest.distanceKm).toBe(0.8);
    });
  });

  describe("Emergency Empty-State Messages", () => {
    it("returns correct empty message when totalInRadius is 0 (no chargers in range)", () => {
      const emptyMsg = getEmptyStateMessage(
        { totalInRadius: 0, availableCount: 0 },
        25,
        true // isEmergency = true
      );

      expect(emptyMsg.title).toBe("No chargers found within 25 km.");
      expect(emptyMsg.hint).toContain("widening your search radius up to 50 km");
    });

    it("returns correct empty message when chargers exist nearby but none are free right now", () => {
      const busyMsg = getEmptyStateMessage(
        { totalInRadius: 3, availableCount: 0 },
        25,
        true // isEmergency = true
      );

      expect(busyMsg.title).toBe("3 chargers nearby, but none are free right now.");
      expect(busyMsg.hint).toContain("All nearby chargers are currently occupied or outside their operating hours");
      expect(busyMsg.hint).toContain("expanding the search radius up to 50 km");
    });
  });
});
