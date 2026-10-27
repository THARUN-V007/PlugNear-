import { describe, it, expect } from "vitest";
import {
  groupDriverBookings,
  getStatusBadgeDetails,
  canCancelBooking,
  getGoogleMapsDirectionsUrl,
  mapCancellationError,
  type DriverBookingItem,
} from "../driver-bookings-helpers";
import { canViewExactLocation, type Actor, type BookingRecord } from "@/lib/rules";

describe("Developer D Step 6: Driver Bookings Helpers (Pure Unit Tests)", () => {
  const mockBooking = (
    id: string,
    status: any,
    startAt: string,
    endAt: string
  ): DriverBookingItem => ({
    id,
    chargerId: "charger-1",
    driverId: "driver-1",
    startAt,
    endAt,
    status,
    totalCost: 150,
    createdAt: "2026-10-27T08:00:00.000Z",
    chargerTitle: "Indiranagar Fast Charger",
    connectorType: "CCS2",
    powerKw: 50,
    pricePerHour: 150,
    hostId: "host-1",
    approximateLocation: { latitude: 12.977, longitude: 77.643 },
    exactAddress: status === "confirmed" ? "123 100ft Road, Indiranagar" : null,
    exactLocation: status === "confirmed" ? { latitude: 12.975, longitude: 77.644 } : null,
    directionsUrl:
      status === "confirmed"
        ? getGoogleMapsDirectionsUrl(12.975, 77.644)
        : null,
  });

  describe("groupDriverBookings (Upcoming vs Past Sorting)", () => {
    it("groups requested and confirmed bookings into upcoming, and final statuses into past", () => {
      const bookings: DriverBookingItem[] = [
        mockBooking("b1", "requested", "2026-10-28T10:00:00.000Z", "2026-10-28T11:00:00.000Z"),
        mockBooking("b2", "confirmed", "2026-10-28T09:00:00.000Z", "2026-10-28T10:00:00.000Z"),
        mockBooking("b3", "completed", "2026-10-26T14:00:00.000Z", "2026-10-26T15:00:00.000Z"),
        mockBooking("b4", "cancelled", "2026-10-26T16:00:00.000Z", "2026-10-26T17:00:00.000Z"),
        mockBooking("b5", "declined", "2026-10-25T10:00:00.000Z", "2026-10-25T11:00:00.000Z"),
        mockBooking("b6", "expired", "2026-10-25T12:00:00.000Z", "2026-10-25T13:00:00.000Z"),
      ];

      const { upcoming, past } = groupDriverBookings(bookings);

      expect(upcoming.map((b) => b.id)).toEqual(["b2", "b1"]); // Nearest start time first (09:00 then 10:00)
      expect(past.map((b) => b.id)).toEqual(["b4", "b3", "b6", "b5"]); // Newest end time first (17:00, 15:00, 13:00, 11:00)
    });
  });

  describe("getStatusBadgeDetails (Status Labels & Help Text)", () => {
    it("returns correct labels and explanatory help text for every status", () => {
      const requested = getStatusBadgeDetails("requested");
      expect(requested.label).toBe("Requested");
      expect(requested.helpText).toContain("Waiting for the host");

      const confirmed = getStatusBadgeDetails("confirmed");
      expect(confirmed.label).toBe("Confirmed");
      expect(confirmed.helpText).toContain("Exact address and driving directions unlocked");

      const declined = getStatusBadgeDetails("declined");
      expect(declined.label).toBe("Declined");
      expect(declined.helpText).toContain("host declined");

      const cancelled = getStatusBadgeDetails("cancelled");
      expect(cancelled.label).toBe("Cancelled");

      const expired = getStatusBadgeDetails("expired");
      expect(expired.label).toBe("Expired");
      expect(expired.helpText).toContain("host did not respond in time");

      const completed = getStatusBadgeDetails("completed");
      expect(completed.label).toBe("Completed");
    });
  });

  describe("canCancelBooking (Cancel Button Permission Logic)", () => {
    const fixedNow = new Date("2026-10-27T10:00:00.000Z");

    it("allows cancelling a requested booking at any time", () => {
      const booking = {
        status: "requested" as const,
        startAt: "2026-10-27T12:00:00.000Z",
      };
      expect(canCancelBooking(booking, fixedNow)).toBe(true);
    });

    it("allows cancelling a confirmed booking strictly before its start time", () => {
      const futureConfirmed = {
        status: "confirmed" as const,
        startAt: "2026-10-27T10:30:00.000Z", // 30 min in the future
      };
      expect(canCancelBooking(futureConfirmed, fixedNow)).toBe(true);
    });

    it("disallows cancelling a confirmed booking once its start time has arrived or passed", () => {
      const startedConfirmed = {
        status: "confirmed" as const,
        startAt: "2026-10-27T09:30:00.000Z", // 30 min in the past
      };
      expect(canCancelBooking(startedConfirmed, fixedNow)).toBe(false);

      const exactStartConfirmed = {
        status: "confirmed" as const,
        startAt: "2026-10-27T10:00:00.000Z", // exact start
      };
      expect(canCancelBooking(exactStartConfirmed, fixedNow)).toBe(false);
    });

    it("disallows cancelling bookings in terminal statuses (declined, cancelled, expired, completed)", () => {
      expect(canCancelBooking({ status: "declined", startAt: "2026-10-27T12:00:00.000Z" }, fixedNow)).toBe(false);
      expect(canCancelBooking({ status: "cancelled", startAt: "2026-10-27T12:00:00.000Z" }, fixedNow)).toBe(false);
      expect(canCancelBooking({ status: "expired", startAt: "2026-10-27T12:00:00.000Z" }, fixedNow)).toBe(false);
      expect(canCancelBooking({ status: "completed", startAt: "2026-10-27T12:00:00.000Z" }, fixedNow)).toBe(false);
    });
  });

  describe("Address Visibility Rules through canViewExactLocation", () => {
    const driverViewer: Actor = { role: "driver", userId: "driver-1" };
    const charger = { hostId: "host-1" };

    it("reveals exact address only when booking is confirmed", () => {
      const confirmedBooking: BookingRecord = {
        id: "b1",
        chargerId: "charger-1",
        driverId: "driver-1",
        startAt: "2026-10-28T10:00:00.000Z",
        endAt: "2026-10-28T11:00:00.000Z",
        status: "confirmed",
      };

      const canView = canViewExactLocation(driverViewer, charger, [confirmedBooking]);
      expect(canView).toBe(true);
    });

    it("hides exact address for requested, declined, cancelled, expired, and completed bookings", () => {
      const nonConfirmedStatuses = ["requested", "declined", "cancelled", "expired", "completed"] as const;

      for (const st of nonConfirmedStatuses) {
        const booking: BookingRecord = {
          id: `b-${st}`,
          chargerId: "charger-1",
          driverId: "driver-1",
          startAt: "2026-10-28T10:00:00.000Z",
          endAt: "2026-10-28T11:00:00.000Z",
          status: st,
        };

        const canView = canViewExactLocation(driverViewer, charger, [booking]);
        expect(canView).toBe(false);
      }
    });
  });

  describe("mapCancellationError (Error Mapping)", () => {
    it("maps cancellation errors to clear plain-English messages", () => {
      expect(mapCancellationError("BOOKING_NOT_FOUND")).toBe("Booking not found.");
      expect(mapCancellationError("TERMINAL_STATE")).toContain("final status");
      expect(mapCancellationError("CANNOT_CANCEL_STARTED")).toContain("already started");
      expect(mapCancellationError("CONCURRENT_UPDATE")).toContain("just updated");
      expect(mapCancellationError("UNAUTHORIZED_ACTOR")).toContain("not authorized");
      expect(mapCancellationError("UNKNOWN", "Fallback")).toBe("Fallback");
    });
  });
});
