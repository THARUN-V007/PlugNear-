import { describe, it, expect } from "vitest";
import {
  groupHostBookings,
  canHostApprove,
  canHostDecline,
  canHostCancel,
  getHostStatusBadgeDetails,
  formatDurationMinutes,
  mapHostActionError,
  type HostBookingItem,
} from "../host-bookings-helpers";

describe("Host Bookings Helpers (Unit Tests)", () => {
  const baseItem: HostBookingItem = {
    id: "b1",
    chargerId: "c1",
    driverId: "d1",
    driverName: "Vikram Driver",
    startAt: "2026-10-27T10:00:00.000Z",
    endAt: "2026-10-27T11:00:00.000Z",
    status: "requested",
    totalCost: 150,
    decidedAt: null,
    createdAt: "2026-10-27T08:00:00.000Z",
    chargerTitle: "Fast Charger 1",
    connectorType: "CCS2",
    powerKw: 50,
    pricePerHour: 150,
  };

  describe("groupHostBookings (3-way grouping & sorting)", () => {
    it("groups requested into pending, confirmed into upcomingConfirmed, and others into past", () => {
      const items: HostBookingItem[] = [
        { ...baseItem, id: "req-later", status: "requested", startAt: "2026-10-27T14:00:00.000Z", endAt: "2026-10-27T15:00:00.000Z" },
        { ...baseItem, id: "req-earlier", status: "requested", startAt: "2026-10-27T10:00:00.000Z", endAt: "2026-10-27T11:00:00.000Z" },
        { ...baseItem, id: "conf-later", status: "confirmed", startAt: "2026-10-27T16:00:00.000Z", endAt: "2026-10-27T17:00:00.000Z" },
        { ...baseItem, id: "conf-earlier", status: "confirmed", startAt: "2026-10-27T12:00:00.000Z", endAt: "2026-10-27T13:00:00.000Z" },
        { ...baseItem, id: "past-declined", status: "declined", startAt: "2026-10-26T10:00:00.000Z", endAt: "2026-10-26T11:00:00.000Z" },
        { ...baseItem, id: "past-completed-newest", status: "completed", startAt: "2026-10-26T14:00:00.000Z", endAt: "2026-10-26T16:00:00.000Z" },
        { ...baseItem, id: "past-cancelled", status: "cancelled", startAt: "2026-10-25T10:00:00.000Z", endAt: "2026-10-25T11:00:00.000Z" },
        { ...baseItem, id: "past-expired", status: "expired", startAt: "2026-10-24T10:00:00.000Z", endAt: "2026-10-24T11:00:00.000Z" },
      ];

      const grouped = groupHostBookings(items);

      // Pending
      expect(grouped.pending).toHaveLength(2);
      expect(grouped.pendingCount).toBe(2);
      expect(grouped.pending[0].id).toBe("req-earlier");
      expect(grouped.pending[1].id).toBe("req-later");

      // Upcoming Confirmed
      expect(grouped.upcomingConfirmed).toHaveLength(2);
      expect(grouped.upcomingConfirmed[0].id).toBe("conf-earlier");
      expect(grouped.upcomingConfirmed[1].id).toBe("conf-later");

      // Past: sorted by endAt descending
      expect(grouped.past).toHaveLength(4);
      expect(grouped.past[0].id).toBe("past-completed-newest");
      expect(grouped.past[1].id).toBe("past-declined");
      expect(grouped.past[2].id).toBe("past-cancelled");
      expect(grouped.past[3].id).toBe("past-expired");
    });

    it("handles empty booking lists gracefully", () => {
      const grouped = groupHostBookings([]);
      expect(grouped.pending).toHaveLength(0);
      expect(grouped.upcomingConfirmed).toHaveLength(0);
      expect(grouped.past).toHaveLength(0);
      expect(grouped.pendingCount).toBe(0);
    });
  });

  describe("canHostApprove", () => {
    const slotStart = "2026-10-27T10:00:00.000Z";

    it("allows approval of a requested booking strictly before start time", () => {
      const now = "2026-10-27T09:59:59.000Z";
      expect(canHostApprove({ status: "requested", startAt: new Date(slotStart) }, now)).toBe(true);
    });

    it("disallows approval once the start time has arrived", () => {
      const now = "2026-10-27T10:00:00.000Z";
      expect(canHostApprove({ status: "requested", startAt: new Date(slotStart) }, now)).toBe(false);
    });

    it("disallows approval if start time has passed", () => {
      const now = "2026-10-27T10:05:00.000Z";
      expect(canHostApprove({ status: "requested", startAt: new Date(slotStart) }, now)).toBe(false);
    });

    it("disallows approval for non-requested bookings", () => {
      const now = "2026-10-27T08:00:00.000Z";
      expect(canHostApprove({ status: "confirmed", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostApprove({ status: "declined", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostApprove({ status: "cancelled", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostApprove({ status: "expired", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostApprove({ status: "completed", startAt: new Date(slotStart) }, now)).toBe(false);
    });
  });

  describe("canHostDecline", () => {
    it("allows declining a requested booking", () => {
      expect(canHostDecline({ status: "requested" })).toBe(true);
    });

    it("disallows declining for non-requested bookings", () => {
      expect(canHostDecline({ status: "confirmed" })).toBe(false);
      expect(canHostDecline({ status: "declined" })).toBe(false);
      expect(canHostDecline({ status: "cancelled" })).toBe(false);
      expect(canHostDecline({ status: "expired" })).toBe(false);
      expect(canHostDecline({ status: "completed" })).toBe(false);
    });
  });

  describe("canHostCancel", () => {
    const slotStart = "2026-10-27T10:00:00.000Z";

    it("allows host to cancel a confirmed booking strictly before start time", () => {
      const now = "2026-10-27T09:59:00.000Z";
      expect(canHostCancel({ status: "confirmed", startAt: new Date(slotStart) }, now)).toBe(true);
    });

    it("disallows host cancellation once start time has arrived", () => {
      const now = "2026-10-27T10:00:00.000Z";
      expect(canHostCancel({ status: "confirmed", startAt: new Date(slotStart) }, now)).toBe(false);
    });

    it("disallows host cancellation after start time has passed", () => {
      const now = "2026-10-27T10:30:00.000Z";
      expect(canHostCancel({ status: "confirmed", startAt: new Date(slotStart) }, now)).toBe(false);
    });

    it("disallows host cancellation for non-confirmed bookings", () => {
      const now = "2026-10-27T08:00:00.000Z";
      expect(canHostCancel({ status: "requested", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostCancel({ status: "declined", startAt: new Date(slotStart) }, now)).toBe(false);
      expect(canHostCancel({ status: "completed", startAt: new Date(slotStart) }, now)).toBe(false);
    });
  });

  describe("getHostStatusBadgeDetails", () => {
    it("provides badges and explanatory text for all statuses", () => {
      const statuses = ["requested", "confirmed", "declined", "cancelled", "expired", "completed"] as const;
      for (const st of statuses) {
        const details = getHostStatusBadgeDetails(st);
        expect(details.label).toBeTruthy();
        expect(details.badgeStyle).toBeTruthy();
        expect(details.helpText).toBeTruthy();
      }
    });
  });

  describe("formatDurationMinutes", () => {
    it("formats 30 minutes", () => {
      expect(formatDurationMinutes(30)).toBe("30 mins");
    });

    it("formats 60 minutes", () => {
      expect(formatDurationMinutes(60)).toBe("1 hr");
    });

    it("formats 120 minutes", () => {
      expect(formatDurationMinutes(120)).toBe("2 hrs");
    });

    it("formats 90 minutes", () => {
      expect(formatDurationMinutes(90)).toBe("1 hr 30 mins");
    });

    it("formats 150 minutes", () => {
      expect(formatDurationMinutes(150)).toBe("2 hrs 30 mins");
    });
  });

  describe("mapHostActionError", () => {
    it("maps standard host error codes to friendly messages", () => {
      expect(mapHostActionError("BOOKING_NOT_FOUND")).toBe("Booking not found.");
      expect(mapHostActionError("SLOT_BLOCKED")).toContain("This booking was just updated or another booking for this time was confirmed");
      expect(mapHostActionError("CONCURRENT_UPDATE")).toContain("This booking was just updated or another booking for this time was confirmed");
      expect(mapHostActionError("CONFLICT")).toContain("This booking was just updated or another booking for this time was confirmed");
      expect(mapHostActionError("CANNOT_CANCEL_STARTED")).toContain("cannot be cancelled once its scheduled start time has arrived");
      expect(mapHostActionError("MIGRATION_MISSING")).toContain("Database migration missing");
    });

    it("falls back cleanly on unknown codes", () => {
      expect(mapHostActionError("UNKNOWN_CODE", "Custom message")).toBe("Custom message");
      expect(mapHostActionError("UNKNOWN_CODE")).toBe("An unexpected error occurred. Please try again.");
    });
  });
});
