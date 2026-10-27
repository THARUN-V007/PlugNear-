import { z } from "zod";

export const ConnectorTypeEnum = z.enum([
  "Type 2",
  "CCS2",
  "CHAdeMO",
  "Bharat AC-001",
  "Other",
]);
export type ConnectorType = z.infer<typeof ConnectorTypeEnum>;

/**
 * Search parameters arrive as strings from URLSearchParams, and `z.coerce.number()`
 * is unsafe for coordinates: it converts an empty or missing value into `0`, so
 * `?latitude=&longitude=` would quietly search the Gulf of Guinea and return a
 * successful 200 with no results. These helpers keep "missing", "malformed" and
 * "out of range" distinguishable while still accepting numeric input.
 */
function parseParamNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(value) ? value : null;
}

function requiredNumber(label: string, min: number, max: number, unit = "") {
  return z.unknown().transform((raw, ctx) => {
    const suffix = unit ? ` ${unit}` : "";
    if (raw === undefined || raw === null || raw === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required` });
      return Number.NaN;
    }

    const value = parseParamNumber(raw);
    if (value === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a valid number` });
      return Number.NaN;
    }

    if (value < min || value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be between ${min} and ${max}${suffix}`,
      });
    }

    return value;
  });
}

function optionalNumber(label: string, min: number, max: number, fallback: number, unit = "") {
  return z.unknown().transform((raw, ctx) => {
    if (raw === undefined || raw === null || raw === "") return fallback;

    const value = parseParamNumber(raw);
    if (value === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be a valid number`,
      });
      return fallback;
    }

    if (value < min || value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be between ${min} and ${max}${unit ? ` ${unit}` : ""}`,
      });
    }

    return value;
  });
}

function optionalLimit() {
  return z.unknown().transform((raw, ctx) => {
    if (raw === undefined || raw === null || raw === "") return 20;

    const value = parseParamNumber(raw);
    if (value === null || !Number.isInteger(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Limit must be a whole number" });
      return 20;
    }

    if (value < 1 || value > 50) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Limit must be between 1 and 50" });
    }

    return value;
  });
}

const Latitude = requiredNumber("Latitude", -90, 90);
const Longitude = requiredNumber("Longitude", -180, 180);

export const SearchQuerySchema = z.object({
  latitude: Latitude,
  longitude: Longitude,
  radiusKm: optionalNumber("Radius", 1, 50, 10, "km"),
  startAt: z.string({ required_error: "startAt timestamp is required" }).min(1, "startAt timestamp is required"),
  endAt: z.string({ required_error: "endAt timestamp is required" }).min(1, "endAt timestamp is required"),
  connectorType: ConnectorTypeEnum.optional(),
  limit: optionalLimit(),
});

export type SearchQueryParams = z.infer<typeof SearchQuerySchema>;

export const EmergencyQuerySchema = z.object({
  latitude: Latitude,
  longitude: Longitude,
  // Emergency mode deliberately casts a wider net than a planned search.
  radiusKm: optionalNumber("Radius", 1, 50, 25, "km"),
  limit: optionalLimit(),
});

export type EmergencyQueryParams = z.infer<typeof EmergencyQuerySchema>;
