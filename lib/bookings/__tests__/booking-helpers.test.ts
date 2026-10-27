import { describe, it, expect } from "vitest";
import {
  mapBookingRuleError,
  checkForDuplicateBooking,
  buildBookingRecord,
} from "../booking-helpers";
import type { BookingRecord, TimeSlot } from "@/lib/rules";

describe("Developer D Step 5: Booking Request Helpers (Pure Unit Tests)", () => {
  describe("buildBookingRecord (Input Validation & Server-Side Cost Enforcement)", () => {
    it("builds a booking record with status requested and driver id from session", () => {
      const slot: TimeSlot = {
        startAt: "2026-10-27T10:00:00.000Z",
        endAt: "2026-10-27T11:00:00.000Z",
      };

      const result = buildBookingRecord({
        driverId: "driver-uuid-from-session",
        chargerId: "charger-uuid-1",
        slot,
        pricePerHour: 150,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.driver_id).toBe("driver-uuid-from-session");
        expect(result.data.charger_id).toBe("charger-uuid-1");
        expect(result.data.status).toBe("requested");
        expect(result.data.duration_minutes).toBe(60);
        expect(result.data.total_cost).toBe(150.0);
      }
    });

    it("calculates cost accurately for partial hours (90 minutes @ ₹120/hr = ₹180.00)", () => {
      const slot: TimeSlot = {
        startAt: "2026-10-27T10:00:00.000Z",
        endAt: "2026-10-27T11:30:00.000Z",
      };

      const result = buildBookingRecord({
        driverId: "driver-uuid-1",
        chargerId: "charger-uuid-1",
        slot,
        pricePerHour: 120,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration_minutes).toBe(90);
        expect(result.data.total_cost).toBe(180.0);
      }
    });

    it("rejects building a record if end time is before start time", () => {
      const slot: TimeSlot = {
        startAt: "2026-10-27T11:00:00.000Z",
        endAt: "2026-10-27T10:00:00.000Z",
      };

      const result = buildBookingRecord({
        driverId: "driver-uuid-1",
        chargerId: "charger-uuid-1",
        slot,
        pricePerHour: 150,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_END_TIME");
      }
    });
  });

  describe("mapBookingRuleError (Plain-English Error Messages)", () => {
    it("maps all standard domain error codes to helpful, user-facing text", () => {
      expect(mapBookingRuleError("PAST_SLOT")).toContain("already passed");
      expect(mapBookingRuleError("INVALID_END_TIME")).toContain("must be after");
      expect(mapBookingRuleError("DURATION_TOO_SHORT")).toContain("at least 30 minutes");
      expect(mapBookingRuleError("DURATION_TOO_LONG")).toContain("cannot exceed 8 hours");
      expect(mapBookingRuleError("INVALID_STEP")).toContain("30-minute increments");
      expect(mapBookingRuleError("INVALID_DATE_FORMAT")).toContain("Invalid date");
      expect(mapBookingRuleError("CHARGER_NOT_FOUND")).toContain("could not be found");
      expect(mapBookingRuleError("CHARGER_INACTIVE")).toContain("currently inactive");
      expect(mapBookingRuleError("CROSSES_MIDNIGHT")).toContain("cannot cross midnight");
      expect(mapBookingRuleError("OUTSIDE_AVAILABILITY")).toContain("outside the host's operating schedule");
      expect(mapBookingRuleError("SLOT_BLOCKED")).toContain("no longer available");
      expect(mapBookingRuleError("DUPLICATE_BOOKING")).toContain("already have an active booking");
      expect(mapBookingRuleError("CANNOT_BOOK_ACROSS_MIDNIGHT")).toContain("cannot be booked across local midnight");
    });

    it("falls back to generic error message for unrecognized codes", () => {
      expect(mapBookingRuleError("UNKNOWN_CODE")).toContain("unexpected error");
      expect(mapBookingRuleError("UNKNOWN_CODE", "Custom fallback")).toBe("Custom fallback");
    });
  });

  describe("checkForDuplicateBooking (Duplicate Prevention)", () => {
    const driverA = "driver-uuid-aaa";
    const driverB = "driver-uuid-bbb";
    const chargerId = "charger-uuid-1";

    const baseSlot: TimeSlot = {
      startAt: "2026-10-27T10:00:00.000Z",
      endAt: "2026-10-27T11:00:00.000Z",
    };

    it("detects duplicate when the same driver already has a 'requested' booking overlapping the slot", () => {
      const existing: BookingRecord[] = [
        {
          id: "booking-1",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T10:30:00.000Z"),
          endAt: new Date("2026-10-27T11:30:00.000Z"),
          status: "requested",
        },
      ];

      const check = checkForDuplicateBooking(driverA, baseSlot, existing);
      expect(check.isDuplicate).toBe(true);
      expect(check.conflictingStatus).toBe("requested");
      expect(check.message).toContain("pending booking request");
    });

    it("detects duplicate when the same driver already has a 'confirmed' booking overlapping the slot", () => {
      const existing: BookingRecord[] = [
        {
          id: "booking-2",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T09:30:00.000Z"),
          endAt: new Date("2026-10-27T10:30:00.000Z"),
          status: "confirmed",
        },
      ];

      const check = checkForDuplicateBooking(driverA, baseSlot, existing);
      expect(check.isDuplicate).toBe(true);
      expect(check.conflictingStatus).toBe("confirmed");
      expect(check.message).toContain("confirmed booking");
    });

    it("does NOT count a different driver's overlapping booking as a duplicate for this driver", () => {
      const existing: BookingRecord[] = [
        {
          id: "booking-3",
          chargerId,
          driverId: driverB, // Different driver
          startAt: new Date("2026-10-27T10:00:00.000Z"),
          endAt: new Date("2026-10-27T11:00:00.000Z"),
          status: "requested",
        },
      ];

      const check = checkForDuplicateBooking(driverA, baseSlot, existing);
      expect(check.isDuplicate).toBe(false);
    });

    it("does NOT count cancelled or declined bookings by the same driver as duplicates", () => {
      const existing: BookingRecord[] = [
        {
          id: "booking-4",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T10:00:00.000Z"),
          endAt: new Date("2026-10-27T11:00:00.000Z"),
          status: "cancelled",
        },
        {
          id: "booking-5",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T10:00:00.000Z"),
          endAt: new Date("2026-10-27T11:00:00.000Z"),
          status: "declined",
        },
      ];

      const check = checkForDuplicateBooking(driverA, baseSlot, existing);
      expect(check.isDuplicate).toBe(false);
    });

    it("does NOT count back-to-back bookings ([09:00, 10:00) and [10:00, 11:00)) as duplicates", () => {
      const existing: BookingRecord[] = [
        {
          id: "booking-6",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T09:00:00.000Z"),
          endAt: new Date("2026-10-27T10:00:00.000Z"), // Back-to-back
          status: "requested",
        },
        {
          id: "booking-7",
          chargerId,
          driverId: driverA,
          startAt: new Date("2026-10-27T11:00:00.000Z"),
          endAt: new Date("2026-10-27T12:00:00.000Z"), // Back-to-back
          status: "confirmed",
        },
      ];

      const check = checkForDuplicateBooking(driverA, baseSlot, existing);
      expect(check.isDuplicate).toBe(false);
    });
  });
});
