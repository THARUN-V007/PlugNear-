import { describe, it, expect } from "vitest";
import {
  CreateChargerSchema,
  ToggleChargerStatusSchema,
  type CreateChargerInput,
} from "@/lib/validation/charger";
import {
  buildChargerInsertRecord,
  buildChargerUpdateRecord,
  formatChargerPrice,
  mapChargerError,
} from "../host-chargers-helpers";
import { APP_CURRENCY } from "@/lib/rules";

describe("Host Chargers Validation & Helpers (Unit Tests)", () => {
  const validPayload: CreateChargerInput = {
    title: "100ft Road Fast Hub",
    address_text: "Plot 42, 100 Feet Rd, Indiranagar, Bengaluru 560038",
    latitude: 12.9719,
    longitude: 77.6412,
    connector_type: "CCS2",
    power_kw: 50.0,
    price_per_hour: 150.0,
    notes: "Basement bay with security guard.",
    host_connection_type: "dedicated_ev",
    electricity_permission_acknowledged: true,
  };

  describe("CreateChargerSchema Validation", () => {
    it("accepts a completely valid charger payload", () => {
      const result = CreateChargerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects title shorter than 3 characters or longer than 100 characters", () => {
      const shortTitle = CreateChargerSchema.safeParse({ ...validPayload, title: "EV" });
      expect(shortTitle.success).toBe(false);

      const longTitle = CreateChargerSchema.safeParse({ ...validPayload, title: "A".repeat(101) });
      expect(longTitle.success).toBe(false);
    });

    it("rejects address shorter than 5 characters or longer than 500 characters", () => {
      const shortAddr = CreateChargerSchema.safeParse({ ...validPayload, address_text: "Main" });
      expect(shortAddr.success).toBe(false);

      const longAddr = CreateChargerSchema.safeParse({ ...validPayload, address_text: "A".repeat(501) });
      expect(longAddr.success).toBe(false);
    });

    it("rejects out-of-range coordinates", () => {
      const badLat = CreateChargerSchema.safeParse({ ...validPayload, latitude: 91.5 });
      expect(badLat.success).toBe(false);

      const badLng = CreateChargerSchema.safeParse({ ...validPayload, longitude: -181.0 });
      expect(badLng.success).toBe(false);
    });

    it("rejects non-positive power or power exceeding 350 kW", () => {
      const zeroPower = CreateChargerSchema.safeParse({ ...validPayload, power_kw: 0 });
      expect(zeroPower.success).toBe(false);

      const negPower = CreateChargerSchema.safeParse({ ...validPayload, power_kw: -10 });
      expect(negPower.success).toBe(false);

      const excessPower = CreateChargerSchema.safeParse({ ...validPayload, power_kw: 351 });
      expect(excessPower.success).toBe(false);
    });

    it("rejects negative price or price exceeding 5000", () => {
      const negPrice = CreateChargerSchema.safeParse({ ...validPayload, price_per_hour: -10 });
      expect(negPrice.success).toBe(false);

      const excessPrice = CreateChargerSchema.safeParse({ ...validPayload, price_per_hour: 5001 });
      expect(excessPrice.success).toBe(false);
      if (!excessPrice.success) {
        // Confirm error message uses dynamic currency constant, not hardcoded symbol
        const msg = excessPrice.error.issues[0].message;
        expect(msg).toContain(APP_CURRENCY);
      }
    });

    it("allows free charging (price = 0)", () => {
      const freeCharger = CreateChargerSchema.safeParse({ ...validPayload, price_per_hour: 0 });
      expect(freeCharger.success).toBe(true);
    });

    it("accepts all 5 valid connector types and rejects invalid ones", () => {
      const validConnectors = ["Type 2", "CCS2", "CHAdeMO", "Bharat AC-001", "Other"] as const;
      for (const conn of validConnectors) {
        const res = CreateChargerSchema.safeParse({ ...validPayload, connector_type: conn });
        expect(res.success).toBe(true);
      }

      const invalidConn = CreateChargerSchema.safeParse({ ...validPayload, connector_type: "Tesla Supercharger" });
      expect(invalidConn.success).toBe(false);
    });

    it("accepts all 3 host connection types and rejects invalid ones", () => {
      const validTypes = ["domestic", "commercial", "dedicated_ev"] as const;
      for (const t of validTypes) {
        const res = CreateChargerSchema.safeParse({ ...validPayload, host_connection_type: t });
        expect(res.success).toBe(true);
      }

      const invalidType = CreateChargerSchema.safeParse({ ...validPayload, host_connection_type: "industrial" });
      expect(invalidType.success).toBe(false);
    });

    it("strictly requires electricity_permission_acknowledged to be true", () => {
      const unchecked = CreateChargerSchema.safeParse({
        ...validPayload,
        electricity_permission_acknowledged: false,
      });
      expect(unchecked.success).toBe(false);
      if (!unchecked.success) {
        expect(unchecked.error.issues[0].message).toContain("electricity provider");
      }
    });
  });

  describe("ToggleChargerStatusSchema Validation", () => {
    it("allows deactivation without acknowledgement checkbox", () => {
      const deactivate = ToggleChargerStatusSchema.safeParse({ is_active: false });
      expect(deactivate.success).toBe(true);
    });

    it("requires acknowledgement when reactivating a charger", () => {
      const reactivateWithoutAck = ToggleChargerStatusSchema.safeParse({
        is_active: true,
        electricity_permission_acknowledged: false,
      });
      expect(reactivateWithoutAck.success).toBe(false);

      const reactivateWithAck = ToggleChargerStatusSchema.safeParse({
        is_active: true,
        electricity_permission_acknowledged: true,
      });
      expect(reactivateWithAck.success).toBe(true);
    });
  });

  describe("buildChargerInsertRecord", () => {
    it("builds a database insert record enforcing session hostId and is_active: true", () => {
      const sessionHostId = "session-host-uuid-1234";
      const record = buildChargerInsertRecord(validPayload, sessionHostId);

      expect(record.host_id).toBe(sessionHostId);
      expect(record.title).toBe(validPayload.title);
      expect(record.is_active).toBe(true);
      expect(record.electricity_permission_acknowledged).toBe(true);
      expect(record.power_kw).toBe(validPayload.power_kw);
      expect(record.price_per_hour).toBe(validPayload.price_per_hour);
    });
  });

  describe("buildChargerUpdateRecord", () => {
    it("contains only allow-listed fields and excludes host_id, created_at, and id", () => {
      const updateRecord = buildChargerUpdateRecord(validPayload);

      expect((updateRecord as any).host_id).toBeUndefined();
      expect((updateRecord as any).created_at).toBeUndefined();
      expect((updateRecord as any).id).toBeUndefined();
      expect(updateRecord.title).toBe(validPayload.title);
      expect(updateRecord.address_text).toBe(validPayload.address_text);
      expect(updateRecord.electricity_permission_acknowledged).toBe(true);
    });
  });

  describe("formatChargerPrice", () => {
    it("formats price with INR currency symbol", () => {
      expect(formatChargerPrice(150)).toBe("₹150.00/hr");
      expect(formatChargerPrice(0)).toBe("₹0.00/hr");
      expect(formatChargerPrice(75.5)).toBe("₹75.50/hr");
    });
  });

  describe("mapChargerError", () => {
    it("maps CHARGER_NOT_FOUND to plain-English 404 message", () => {
      expect(mapChargerError("CHARGER_NOT_FOUND")).toBe("Charger not found.");
    });

    it("maps MIGRATION_MISSING to informative migration message", () => {
      expect(mapChargerError("MIGRATION_MISSING")).toContain("20261027000004_add_charger_acknowledgement.sql");
    });

    it("falls back to friendly generic message for unknown errors", () => {
      expect(mapChargerError("UNKNOWN", "Custom message")).toBe("Custom message");
      expect(mapChargerError("UNKNOWN")).toBe("An unexpected error occurred. Please try again.");
    });
  });
});
