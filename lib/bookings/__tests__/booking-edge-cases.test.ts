import { describe, it, expect } from "vitest";
import {
  checkDriverCalendarConflict,
  checkForDuplicateBooking,
  mapBookingRuleError,
} from "../booking-helpers";
import { ERROR_CODES, type BookingRecord } from "@/lib/rules";

const DRIVER = "driver-1";
const OTHER_DRIVER = "driver-2";

// Proposed slot: 10:00 - 11:30 UTC
const slot = { startAt: "2026-11-01T10:00:00Z", endAt: "2026-11-01T11:30:00Z" };

function booking(overrides: Partial<BookingRecord>): BookingRecord {
  return {
    id: "b-1",
    chargerId: "charger-1",
    driverId: DRIVER,
    startAt: new Date("2026-11-01T10:00:00Z"),
    endAt: new Date("2026-11-01T11:30:00Z"),
    status: "confirmed",
    ...overrides,
  };
}

describe("Booking edge cases: the same slot twice", () => {
  describe("checkDriverCalendarConflict (cross-charger)", () => {
    it("blocks a booking when the driver is already confirmed at another charger", () => {
      const result = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ chargerId: "charger-2" }),
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.DRIVER_SLOT_CONFLICT);
        expect(result.error.message).toContain("another charger");
      }
    });

    it("allows a booking on a different charger when the times do not touch", () => {
      const result = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ chargerId: "charger-2", startAt: new Date("2026-11-01T11:30:00Z"), endAt: new Date("2026-11-01T13:00:00Z") }),
      ]);
      expect(result.success).toBe(true);
    });

    it("ignores other drivers entirely", () => {
      const result = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ driverId: OTHER_DRIVER, chargerId: "charger-2" }),
      ]);
      expect(result.success).toBe(true);
    });

    it("ignores non-confirmed statuses (a pending request elsewhere is not a lock)", () => {
      const result = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ chargerId: "charger-2", status: "requested" }),
        booking({ id: "b-2", chargerId: "charger-3", status: "cancelled" }),
        booking({ id: "b-3", chargerId: "charger-4", status: "declined" }),
      ]);
      expect(result.success).toBe(true);
    });

    it("catches a partial overlap at either end of the existing booking", () => {
      const overlapsStart = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ chargerId: "charger-2", startAt: new Date("2026-11-01T09:00:00Z"), endAt: new Date("2026-11-01T10:30:00Z") }),
      ]);
      const overlapsEnd = checkDriverCalendarConflict(DRIVER, slot, [
        booking({ chargerId: "charger-2", startAt: new Date("2026-11-01T11:00:00Z"), endAt: new Date("2026-11-01T12:00:00Z") }),
      ]);

      expect(overlapsStart.success).toBe(false);
      expect(overlapsEnd.success).toBe(false);
    });
  });

  describe("checkForDuplicateBooking (same charger)", () => {
    it("flags an identical re-submission as a duplicate request", () => {
      const result = checkForDuplicateBooking(DRIVER, slot, [booking({ status: "requested" })]);
      expect(result.isDuplicate).toBe(true);
      expect(result.conflictingStatus).toBe("requested");
    });

    it("flags a confirmed booking on the same charger", () => {
      const result = checkForDuplicateBooking(DRIVER, slot, [booking({ status: "confirmed" })]);
      expect(result.isDuplicate).toBe(true);
      expect(result.conflictingStatus).toBe("confirmed");
    });

    it("does not flag a different driver's booking on the same charger", () => {
      const result = checkForDuplicateBooking(DRIVER, slot, [
        booking({ driverId: OTHER_DRIVER, status: "requested" }),
      ]);
      expect(result.isDuplicate).toBe(false);
    });

    it("lets a driver re-book a slot they already cancelled", () => {
      const result = checkForDuplicateBooking(DRIVER, slot, [booking({ status: "cancelled" })]);
      expect(result.isDuplicate).toBe(false);
    });

    it("does not treat back-to-back slots as duplicates", () => {
      const result = checkForDuplicateBooking(DRIVER, slot, [
        booking({ status: "confirmed", startAt: new Date("2026-11-01T11:30:00Z"), endAt: new Date("2026-11-01T13:00:00Z") }),
      ]);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe("error message mapping", () => {
    it("explains the cross-charger conflict in plain language", () => {
      expect(mapBookingRuleError(ERROR_CODES.DRIVER_SLOT_CONFLICT)).toContain("two places");
    });

    it("explains the same-charger duplicate in plain language", () => {
      expect(mapBookingRuleError(ERROR_CODES.DUPLICATE_BOOKING)).toContain("this charging point");
    });
  });
});
