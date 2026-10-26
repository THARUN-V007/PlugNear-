import { describe, it, expect } from "vitest";
import { transitionBooking, refreshBookingStatuses } from "../state-machine";
import { ERROR_CODES } from "../constants";
import type { BookingRecord, Actor } from "../types";

describe("Rule 5 & 6: Booking State Machine & Lazy Refresh", () => {
  const hostId = "host-123";
  const driverId = "driver-456";
  const otherUserId = "user-999";

  const hostActor: Actor = { userId: hostId, role: "host" };
  const driverActor: Actor = { userId: driverId, role: "driver" };
  const imposterHost: Actor = { userId: otherUserId, role: "host" };
  const imposterDriver: Actor = { userId: otherUserId, role: "driver" };
  const systemActor: Actor = { userId: "system", role: "system" };

  const futureBooking: BookingRecord = {
    id: "booking-1",
    chargerId: "charger-1",
    driverId,
    startAt: new Date("2026-11-01T10:00:00Z"),
    endAt: new Date("2026-11-01T11:00:00Z"),
    status: "requested",
  };

  const beforeStart = new Date("2026-11-01T09:00:00Z");
  const duringSlot = new Date("2026-11-01T10:30:00Z");
  const afterEnd = new Date("2026-11-01T11:30:00Z");

  describe("Allowed Transitions", () => {
    it("allows host to approve a requested booking before start time", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "confirmed",
        actor: hostActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("confirmed");
        expect(result.data.decidedAt).toBeDefined();
      }
    });

    it("allows host to decline a requested booking", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "declined",
        actor: hostActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("declined");
      }
    });

    it("allows requesting driver to cancel a requested booking", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "cancelled",
        actor: driverActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("cancelled");
      }
    });

    it("allows system to expire an undecided booking once start time has passed", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "expired",
        actor: systemActor,
        hostId,
        now: duringSlot,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("expired");
      }
    });

    it("allows driver to cancel a confirmed booking before slot start", () => {
      const confirmedBooking: BookingRecord = {
        ...futureBooking,
        status: "confirmed",
      };

      const result = transitionBooking({
        booking: confirmedBooking,
        newStatus: "cancelled",
        actor: driverActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("cancelled");
      }
    });

    it("allows host to cancel a confirmed booking before slot start", () => {
      const confirmedBooking: BookingRecord = {
        ...futureBooking,
        status: "confirmed",
      };

      const result = transitionBooking({
        booking: confirmedBooking,
        newStatus: "cancelled",
        actor: hostActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("cancelled");
      }
    });

    it("allows system to mark a confirmed booking completed once end time has passed", () => {
      const confirmedBooking: BookingRecord = {
        ...futureBooking,
        status: "confirmed",
      };

      const result = transitionBooking({
        booking: confirmedBooking,
        newStatus: "completed",
        actor: systemActor,
        hostId,
        now: afterEnd,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedStatus).toBe("completed");
      }
    });
  });

  describe("Illegal Transitions & Actor Enforcement", () => {
    it("rejects driver attempting to approve own booking", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "confirmed",
        actor: driverActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACTOR);
      }
    });

    it("rejects a host from a different charger attempting to approve", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "confirmed",
        actor: imposterHost,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACTOR);
      }
    });

    it("rejects an unrelated driver attempting to cancel someone else's booking", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "cancelled",
        actor: imposterDriver,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACTOR);
      }
    });

    it("rejects approving a requested booking after its start time has passed", () => {
      const result = transitionBooking({
        booking: futureBooking,
        newStatus: "confirmed",
        actor: hostActor,
        hostId,
        now: duringSlot, // slot already started
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.INVALID_TRANSITION);
      }
    });

    it("rejects cancelling a confirmed booking after its start time has passed", () => {
      const confirmedBooking: BookingRecord = {
        ...futureBooking,
        status: "confirmed",
      };

      const result = transitionBooking({
        booking: confirmedBooking,
        newStatus: "cancelled",
        actor: driverActor,
        hostId,
        now: duringSlot, // slot already started
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.CANNOT_CANCEL_STARTED);
      }
    });

    it("rejects transition out of terminal state 'declined'", () => {
      const declinedBooking: BookingRecord = {
        ...futureBooking,
        status: "declined",
      };

      const result = transitionBooking({
        booking: declinedBooking,
        newStatus: "confirmed",
        actor: hostActor,
        hostId,
        now: beforeStart,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.TERMINAL_STATE);
      }
    });

    it("rejects transition out of terminal state 'completed'", () => {
      const completedBooking: BookingRecord = {
        ...futureBooking,
        status: "completed",
      };

      const result = transitionBooking({
        booking: completedBooking,
        newStatus: "cancelled",
        actor: hostActor,
        hostId,
        now: afterEnd,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.TERMINAL_STATE);
      }
    });

    it("rejects marking completed before the slot end time", () => {
      const confirmedBooking: BookingRecord = {
        ...futureBooking,
        status: "confirmed",
      };

      const result = transitionBooking({
        booking: confirmedBooking,
        newStatus: "completed",
        actor: systemActor,
        hostId,
        now: duringSlot, // Still running
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.INVALID_TRANSITION);
      }
    });
  });

  describe("refreshBookingStatuses (Lazy status refresh)", () => {
    it("identifies expired requested bookings and completed confirmed bookings", () => {
      const bookings: BookingRecord[] = [
        {
          id: "b-should-expire",
          chargerId: "c1",
          driverId,
          startAt: new Date("2026-11-01T10:00:00Z"),
          endAt: new Date("2026-11-01T11:00:00Z"),
          status: "requested",
        },
        {
          id: "b-should-complete",
          chargerId: "c1",
          driverId,
          startAt: new Date("2026-11-01T08:00:00Z"),
          endAt: new Date("2026-11-01T09:00:00Z"),
          status: "confirmed",
        },
        {
          id: "b-future-requested",
          chargerId: "c1",
          driverId,
          startAt: new Date("2026-11-01T14:00:00Z"),
          endAt: new Date("2026-11-01T15:00:00Z"),
          status: "requested",
        },
        {
          id: "b-ongoing-confirmed",
          chargerId: "c1",
          driverId,
          startAt: new Date("2026-11-01T10:00:00Z"),
          endAt: new Date("2026-11-01T11:00:00Z"),
          status: "confirmed",
        },
      ];

      // Now is 10:30 UTC
      const now = new Date("2026-11-01T10:30:00Z");
      const refresh = refreshBookingStatuses(bookings, now);

      expect(refresh.expiredIds).toEqual(["b-should-expire"]);
      expect(refresh.completedIds).toEqual(["b-should-complete"]);
      expect(refresh.updates.length).toBe(2);
    });
  });
});
