import { describe, it, expect } from "vitest";
import { doRangesOverlap, checkSlotOverlap, findConflictingPendingBookings } from "../overlap";
import { ERROR_CODES } from "../constants";
import type { BookingRecord } from "../types";

describe("Rule 3 & 7: Overlap and Auto-Decline", () => {
  describe("doRangesOverlap (half-open intervals [start, end))", () => {
    const base = {
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-01T11:00:00Z"),
    };

    it("detects identical ranges as overlapping", () => {
      expect(doRangesOverlap(base, base)).toBe(true);
    });

    it("detects a range fully enclosed inside another as overlapping", () => {
      const inside = {
        startAt: new Date("2026-11-01T10:15:00Z"),
        endAt: new Date("2026-11-01T10:45:00Z"),
      };
      expect(doRangesOverlap(base, inside)).toBe(true);
    });

    it("detects partial overlap at the start", () => {
      const partialStart = {
        startAt: new Date("2026-11-01T09:30:00Z"),
        endAt: new Date("2026-11-01T10:30:00Z"),
      };
      expect(doRangesOverlap(base, partialStart)).toBe(true);
    });

    it("detects partial overlap at the end", () => {
      const partialEnd = {
        startAt: new Date("2026-11-01T10:30:00Z"),
        endAt: new Date("2026-11-01T11:30:00Z"),
      };
      expect(doRangesOverlap(base, partialEnd)).toBe(true);
    });

    it("allows back-to-back booking immediately before (end == start)", () => {
      const beforeBackToBack = {
        startAt: new Date("2026-11-01T09:00:00Z"),
        endAt: new Date("2026-11-01T10:00:00Z"),
      };
      expect(doRangesOverlap(base, beforeBackToBack)).toBe(false);
    });

    it("allows back-to-back booking immediately after (start == end)", () => {
      const afterBackToBack = {
        startAt: new Date("2026-11-01T11:00:00Z"),
        endAt: new Date("2026-11-01T12:00:00Z"),
      };
      expect(doRangesOverlap(base, afterBackToBack)).toBe(false);
    });
  });

  describe("checkSlotOverlap with existing bookings", () => {
    const chargerA = "charger-aaa";
    const chargerB = "charger-bbb";

    const existingBookings: BookingRecord[] = [
      {
        id: "b-confirmed-1",
        chargerId: chargerA,
        driverId: "driver-1",
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-01T11:00:00Z"),
        status: "confirmed",
      },
      {
        id: "b-requested-1",
        chargerId: chargerA,
        driverId: "driver-2",
        startAt: new Date("2026-11-01T14:00:00Z"),
        endAt: new Date("2026-11-01T15:00:00Z"),
        status: "requested", // Pending does NOT block
      },
      {
        id: "b-confirmed-other-charger",
        chargerId: chargerB,
        driverId: "driver-3",
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-01T11:00:00Z"),
        status: "confirmed",
      },
    ];

    it("blocks a new slot overlapping an existing confirmed booking on same charger", () => {
      const slot = {
        startAt: new Date("2026-11-01T10:30:00Z"),
        endAt: new Date("2026-11-01T11:30:00Z"),
      };

      const result = checkSlotOverlap(slot, existingBookings, chargerA);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.SLOT_BLOCKED);
      }
    });

    it("allows a slot that overlaps a pending ('requested') booking because pending does not block", () => {
      const slot = {
        startAt: new Date("2026-11-01T14:15:00Z"),
        endAt: new Date("2026-11-01T14:45:00Z"),
      };

      const result = checkSlotOverlap(slot, existingBookings, chargerA);
      expect(result.success).toBe(true);
    });

    it("allows a slot overlapping a booking on a different charger", () => {
      const slot = {
        startAt: new Date("2026-11-01T10:00:00Z"),
        endAt: new Date("2026-11-01T11:00:00Z"),
      };

      // Querying chargerA; chargerB has a confirmed booking at this time, but chargerA is free
      const result = checkSlotOverlap(slot, existingBookings, "charger-free");
      expect(result.success).toBe(true);
    });

    it("allows back-to-back confirmed slots on the same charger", () => {
      const slot = {
        startAt: new Date("2026-11-01T11:00:00Z"),
        endAt: new Date("2026-11-01T12:00:00Z"),
      };

      const result = checkSlotOverlap(slot, existingBookings, chargerA);
      expect(result.success).toBe(true);
    });
  });

  describe("findConflictingPendingBookings (auto-decline helper)", () => {
    const chargerId = "charger-test";
    const confirmedBooking: BookingRecord = {
      id: "b-just-approved",
      chargerId,
      driverId: "driver-1",
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-01T11:30:00Z"),
      status: "confirmed",
    };

    const allBookings: BookingRecord[] = [
      confirmedBooking,
      {
        id: "b-conflicting-1",
        chargerId,
        driverId: "driver-2",
        startAt: new Date("2026-11-01T10:30:00Z"),
        endAt: new Date("2026-11-01T12:00:00Z"),
        status: "requested",
      },
      {
        id: "b-non-conflicting",
        chargerId,
        driverId: "driver-3",
        startAt: new Date("2026-11-01T11:30:00Z"),
        endAt: new Date("2026-11-01T12:30:00Z"),
        status: "requested", // Back-to-back, does not overlap
      },
      {
        id: "b-conflicting-other-charger",
        chargerId: "other-charger",
        driverId: "driver-4",
        startAt: new Date("2026-11-01T10:30:00Z"),
        endAt: new Date("2026-11-01T11:00:00Z"),
        status: "requested", // Different charger
      },
    ];

    it("identifies only overlapping pending requests on the same charger", () => {
      const conflicting = findConflictingPendingBookings(confirmedBooking, allBookings);

      expect(conflicting.length).toBe(1);
      expect(conflicting[0].id).toBe("b-conflicting-1");
    });
  });
});
