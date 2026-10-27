import { describe, it, expect } from "vitest";
import { SearchQuerySchema, EmergencyQuerySchema } from "@/lib/validation/search";

const baseQuery = {
  latitude: "12.9719",
  longitude: "77.6412",
  startAt: "2026-11-01T10:00:00Z",
  endAt: "2026-11-01T11:30:00Z",
};

describe("Search Query Validation (HTTP contract)", () => {
  it("accepts a normal query and types the coordinates as numbers", () => {
    const parsed = SearchQuerySchema.safeParse(baseQuery);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.latitude).toBeCloseTo(12.9719);
      expect(parsed.data.radiusKm).toBe(10);
      expect(parsed.data.limit).toBe(20);
    }
  });

  // Regression: z.coerce.number() turned these into 0, so an empty search
  // silently queried the Gulf of Guinea instead of failing with 400.
  it.each([
    ["empty strings", { latitude: "", longitude: "" }],
    ["nulls (missing parameters)", { latitude: null, longitude: null }],
    ["text", { latitude: "abc", longitude: "def" }],
  ])("rejects %s instead of defaulting to 0,0", (_label, coords) => {
    const parsed = SearchQuerySchema.safeParse({ ...baseQuery, ...coords });
    expect(parsed.success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(SearchQuerySchema.safeParse({ ...baseQuery, latitude: "91" }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ ...baseQuery, longitude: "-181" }).success).toBe(false);
  });

  it("rejects a radius above the 50 km ceiling", () => {
    // The route maps the `radius` alias onto radiusKm before validation.
    const parsed = SearchQuerySchema.safeParse({ ...baseQuery, radiusKm: "100" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("between 1 and 50");
    }
  });

  it("keeps a valid radius inside the ceiling", () => {
    const parsed = SearchQuerySchema.safeParse({ ...baseQuery, radiusKm: "25" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.radiusKm).toBe(25);
  });

  it("requires both slot boundaries", () => {
    expect(SearchQuerySchema.safeParse({ ...baseQuery, endAt: "" }).success).toBe(false);
    expect(
      SearchQuerySchema.safeParse({
        latitude: "12.9",
        longitude: "77.6",
        radiusKm: "5",
      }).success
    ).toBe(false);
  });

  it("accepts numeric input from a server-side caller", () => {
    const parsed = SearchQuerySchema.safeParse({
      ...baseQuery,
      latitude: 12.9719,
      longitude: 77.6412,
      radiusKm: 15,
    });
    expect(parsed.success).toBe(true);
  });

  it("widens the default radius only for emergency mode", () => {
    const parsed = EmergencyQuerySchema.safeParse({
      latitude: "12.9719",
      longitude: "77.6412",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.radiusKm).toBe(25);
  });

  it("rejects a non-integer limit", () => {
    const parsed = SearchQuerySchema.safeParse({ ...baseQuery, limit: "2.5" });
    expect(parsed.success).toBe(false);
  });
});
