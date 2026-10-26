import { z } from "zod";

export const ConnectorTypeEnum = z.enum([
  "Type 2",
  "CCS2",
  "CHAdeMO",
  "Bharat AC-001",
  "Other",
]);
export type ConnectorType = z.infer<typeof ConnectorTypeEnum>;

export const SearchQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radiusKm: z.coerce
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(50, "Radius cannot exceed 50 km")
    .default(10),
  startAt: z.string().min(1, "startAt timestamp is required"),
  endAt: z.string().min(1, "endAt timestamp is required"),
  connectorType: ConnectorTypeEnum.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(20),
});

export type SearchQueryParams = z.infer<typeof SearchQuerySchema>;
