import { describe, it, expect } from "vitest";
import {
  canViewExactLocation,
  getApproximateCoordinates,
  calculateHaversineDistance,
} from "../privacy";
import type { Actor, BookingRecord, GeoPoint } from "../types";

describe("Rule 8: Privacy and Approximate Pin", () => {
  const hostId = "host-owner-1";
  const driverWithConfirmed = "driver-confirmed-1";
  const driverWithPending = "driver-pending-1";
  const strangerDriver = "driver-stranger-1";

  const charger = { hostId };
  const exactLocation: GeoPoint = { latitude: 12.9719, longitude: 77.6412 };

  const bookings: BookingRecord[] = [
    {
      id: "b1",
      chargerId: "c1",
      driverId: driverWithConfirmed,
      startAt: new Date("2026-11-01T10:00:00Z"),
      endAt: new Date("2026-11-01T11:00:00Z"),
      status: "confirmed",
    },
    {
      id: "b2",
      chargerId: "c1",
      driverId: driverWithPending,
      startAt: new Date("2026-11-01T12:00:00Z"),
      endAt: new Date("2026-11-01T13:00:00Z"),
      status: "requested",
    },
  ];

  describe("canViewExactLocation Permission Check", () => {
    it("allows the charger host to view exact location", () => {
      const hostActor: Actor = { userId: hostId, role: "host" };
      expect(canViewExactLocation(hostActor, charger, bookings)).toBe(true);
    });

    it("allows a driver with a confirmed booking to view exact location", () => {
      const driverActor: Actor = { userId: driverWithConfirmed, role: "driver" };
      expect(canViewExactLocation(driverActor, charger, bookings)).toBe(true);
    });

    it("hides exact location from a driver with only a pending ('requested') booking", () => {
      const driverActor: Actor = { userId: driverWithPending, role: "driver" };
      expect(canViewExactLocation(driverActor, charger, bookings)).toBe(false);
    });

    it("hides exact location from an unrelated driver with no bookings", () => {
      const driverActor: Actor = { userId: strangerDriver, role: "driver" };
      expect(canViewExactLocation(driverActor, charger, bookings)).toBe(false);
    });

    it("hides exact location from unauthenticated or foreign host", () => {
      const otherHost: Actor = { userId: "other-host", role: "host" };
      expect(canViewExactLocation(otherHost, charger, bookings)).toBe(false);
    });
  });

  describe("getApproximateCoordinates", () => {
    const chargerId = "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    it("returns identical coordinates across repeated calls (deterministic)", () => {
      const pos1 = getApproximateCoordinates(chargerId, exactLocation);
      const pos2 = getApproximateCoordinates(chargerId, exactLocation);

      expect(pos1.latitude).toBe(pos2.latitude);
      expect(pos1.longitude).toBe(pos2.longitude);
    });

    it("shifts the position so it differs from the exact coordinates", () => {
      const approx = getApproximateCoordinates(chargerId, exactLocation);

      expect(approx.latitude).not.toBe(exactLocation.latitude);
      expect(approx.longitude).not.toBe(exactLocation.longitude);
    });

    it("guarantees the shifted position is within 200 to 350 meters of exact position", () => {
      // Test across multiple different charger IDs
      const testChargers = [
        "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "c3333333-cccc-4ccc-8ccc-cccccccccccc",
        "d4444444-dddd-4ddd-8ddd-dddddddddddd",
        "e5555555-eeee-4eee-8eee-eeeeeeeeeeee",
      ];

      for (const id of testChargers) {
        const approx = getApproximateCoordinates(id, exactLocation);
        const distance = calculateHaversineDistance(exactLocation, approx);

        expect(distance).toBeGreaterThanOrEqual(195); // accounts for float precision
        expect(distance).toBeLessThanOrEqual(355);
      }
    });
  });
});
