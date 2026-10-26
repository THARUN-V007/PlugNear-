import { describe, it, expect } from "vitest";
import {
  assembleSearchResults,
  type RawCandidateCharger,
  type AssembleSearchInput,
} from "../search-assembly";
import type { ValidatedSlotDetails } from "@/lib/rules";

describe("Search Assembly & Ranking (Pure Unit Tests)", () => {
  // Sunday, 2026-11-01.
  // 10:00 UTC to 11:30 UTC = 15:30 to 17:00 IST on Sunday (dayOfWeek = 0).
  const slot = {
    startAt: "2026-11-01T10:00:00Z",
    endAt: "2026-11-01T11:30:00Z",
  };

  const validatedSlot: ValidatedSlotDetails = {
    durationMinutes: 90,
    durationHours: 1.5,
    start: new Date("2026-11-01T10:00:00Z"),
    end: new Date("2026-11-01T11:30:00Z"),
  };

  // Base window open Sundays 08:00 to 22:00 IST (covers 15:30 to 17:00 IST)
  const baseWindows = [
    {
      dayOfWeek: 0,
      startTime: "08:00",
      endTime: "22:00",
    },
  ];

  const candidate1: RawCandidateCharger = {
    id: "charger-1",
    hostId: "host-1",
    title: "100ft Road Fast Hub",
    connectorType: "CCS2",
    powerKw: 22,
    pricePerHour: 180,
    latitude: 12.9719,
    longitude: 77.6412,
    distanceMeters: 500, // 0.5 km
    isActive: true,
    windows: baseWindows,
    bookings: [],
  };

  const candidate2: RawCandidateCharger = {
    id: "charger-2",
    hostId: "host-2",
    title: "Indiranagar Home Plug",
    connectorType: "Type 2",
    powerKw: 7.4,
    pricePerHour: 120,
    latitude: 12.9698,
    longitude: 77.6385,
    distanceMeters: 1200, // 1.2 km
    isActive: true,
    windows: baseWindows,
    bookings: [],
  };

  const candidate3: RawCandidateCharger = {
    id: "charger-3",
    hostId: "host-3",
    title: "Defence Colony EV Port",
    connectorType: "Type 2",
    powerKw: 11,
    pricePerHour: 140,
    latitude: 12.9760,
    longitude: 77.6440,
    distanceMeters: 2500, // 2.5 km
    isActive: true,
    windows: baseWindows,
    bookings: [],
  };

  it("excludes a charger that is outside its availability window", () => {
    // Window on Monday only (dayOfWeek = 1); slot is on Sunday (dayOfWeek = 0)
    const chargerOutsideWindow: RawCandidateCharger = {
      ...candidate1,
      windows: [{ dayOfWeek: 1, startTime: "08:00", endTime: "22:00" }],
    };

    const input: AssembleSearchInput = {
      candidates: [chargerOutsideWindow, candidate2],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.map((c) => c.id)).not.toContain("charger-1");
    expect(result.chargers.map((c) => c.id)).toContain("charger-2");
    expect(result.meta.totalInRadius).toBe(2);
    expect(result.meta.availableCount).toBe(1);
  });

  it("excludes a charger that has an overlapping confirmed booking", () => {
    // Confirmed booking from 10:30 to 12:00 UTC (overlaps requested 10:00 to 11:30 UTC)
    const chargerWithOverlap: RawCandidateCharger = {
      ...candidate1,
      bookings: [
        {
          id: "b-conf",
          chargerId: candidate1.id,
          driverId: "other-driver",
          startAt: new Date("2026-11-01T10:30:00Z"),
          endAt: new Date("2026-11-01T12:00:00Z"),
          status: "confirmed",
        },
      ],
    };

    const input: AssembleSearchInput = {
      candidates: [chargerWithOverlap, candidate2],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.map((c) => c.id)).not.toContain("charger-1");
    expect(result.chargers.map((c) => c.id)).toContain("charger-2");
    expect(result.meta.availableCount).toBe(1);
  });

  it("does NOT exclude a charger when an overlapping booking is pending ('requested')", () => {
    // Pending booking should NOT block the slot
    const chargerWithPending: RawCandidateCharger = {
      ...candidate1,
      bookings: [
        {
          id: "b-pending",
          chargerId: candidate1.id,
          driverId: "other-driver",
          startAt: new Date("2026-11-01T10:30:00Z"),
          endAt: new Date("2026-11-01T12:00:00Z"),
          status: "requested",
        },
      ],
    };

    const input: AssembleSearchInput = {
      candidates: [chargerWithPending],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.map((c) => c.id)).toContain("charger-1");
    expect(result.meta.availableCount).toBe(1);
  });

  it("does NOT exclude a charger when a confirmed booking is back-to-back", () => {
    // Back-to-back confirmed booking: 11:30 to 13:00 UTC (ends exactly when requested slot ends)
    const chargerBackToBack: RawCandidateCharger = {
      ...candidate1,
      bookings: [
        {
          id: "b-back-to-back",
          chargerId: candidate1.id,
          driverId: "other-driver",
          startAt: new Date("2026-11-01T11:30:00Z"),
          endAt: new Date("2026-11-01T13:00:00Z"),
          status: "confirmed",
        },
      ],
    };

    const input: AssembleSearchInput = {
      candidates: [chargerBackToBack],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.map((c) => c.id)).toContain("charger-1");
  });

  it("excludes chargers with a mismatched connector type when connector filter is applied", () => {
    const input: AssembleSearchInput = {
      candidates: [candidate1, candidate2, candidate3],
      slot,
      validatedSlot,
      limit: 20,
      connectorFilter: "CCS2",
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.length).toBe(1);
    expect(result.chargers[0].id).toBe("charger-1");
    expect(result.chargers[0].connectorType).toBe("CCS2");
    expect(result.meta.totalInRadius).toBe(1); // Only 1 CCS2 charger matched
  });

  it("sorts available chargers nearest first by distance", () => {
    // Candidate order: candidate3 (2.5km), candidate1 (0.5km), candidate2 (1.2km)
    const input: AssembleSearchInput = {
      candidates: [candidate3, candidate1, candidate2],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.map((c) => c.id)).toEqual([
      "charger-1", // 0.5 km
      "charger-2", // 1.2 km
      "charger-3", // 2.5 km
    ]);
    expect(result.chargers[0].distanceKm).toBe(0.5);
    expect(result.chargers[1].distanceKm).toBe(1.2);
    expect(result.chargers[2].distanceKm).toBe(2.5);
  });

  it("respects the requested pagination limit", () => {
    const input: AssembleSearchInput = {
      candidates: [candidate1, candidate2, candidate3],
      slot,
      validatedSlot,
      limit: 2,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.length).toBe(2);
    expect(result.meta.availableCount).toBe(3); // 3 available, but only 2 returned
  });

  it("never includes exact coordinates or address text in the output", () => {
    const input: AssembleSearchInput = {
      candidates: [candidate1],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    const item = result.chargers[0];

    // Verify fields that MUST NOT exist
    expect((item as any).latitude).toBeUndefined();
    expect((item as any).longitude).toBeUndefined();
    expect((item as any).address_text).toBeUndefined();
    expect((item as any).addressText).toBeUndefined();
    expect((item as any).hostId).toBeUndefined();

    // Verify approximateLocation exists and differs from exact coordinates
    expect(item.approximateLocation).toBeDefined();
    expect(item.approximateLocation.latitude).not.toBe(candidate1.latitude);
    expect(item.approximateLocation.longitude).not.toBe(candidate1.longitude);
  });

  it("calculates estimated cost correctly from slot duration and price per hour", () => {
    // Duration: 1.5 hours, Price: 180 INR/hr -> Estimated cost = 270 INR
    const input: AssembleSearchInput = {
      candidates: [candidate1],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers[0].estimatedCost).toBe(270.0);
  });

  it("provides accurate metadata for empty state feedback", () => {
    // Both chargers blocked by confirmed bookings
    const blockedCandidate1 = {
      ...candidate1,
      bookings: [
        {
          id: "b1",
          chargerId: candidate1.id,
          driverId: "d1",
          startAt: new Date("2026-11-01T09:00:00Z"),
          endAt: new Date("2026-11-01T12:00:00Z"),
          status: "confirmed" as const,
        },
      ],
    };
    const blockedCandidate2 = {
      ...candidate2,
      bookings: [
        {
          id: "b2",
          chargerId: candidate2.id,
          driverId: "d2",
          startAt: new Date("2026-11-01T09:00:00Z"),
          endAt: new Date("2026-11-01T12:00:00Z"),
          status: "confirmed" as const,
        },
      ],
    };

    const input: AssembleSearchInput = {
      candidates: [blockedCandidate1, blockedCandidate2],
      slot,
      validatedSlot,
      limit: 20,
    };

    const result = assembleSearchResults(input);
    expect(result.chargers.length).toBe(0);
    expect(result.meta.totalInRadius).toBe(2);
    expect(result.meta.availableCount).toBe(0);
  });
});
