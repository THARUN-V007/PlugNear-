import { z } from "zod";

/**
 * Validation schema for driver booking creation request (POST /api/bookings).
 *
 * Driver ID and price/cost are NEVER accepted in the body:
 * - Driver ID is taken securely from the authenticated session.
 * - Total cost is calculated server-side from the charger's stored price.
 */
export const BookingRequestSchema = z.object({
  chargerId: z.string().uuid({ message: "Invalid charger ID format" }),
  startAt: z.string().datetime({ message: "Start time must be a valid ISO 8601 UTC string" }),
  endAt: z.string().datetime({ message: "End time must be a valid ISO 8601 UTC string" }),
});

export type BookingRequestBody = z.infer<typeof BookingRequestSchema>;

/**
 * Validation schema for query parameters passed to the charger details page
 * (/driver/chargers/[id]?startAt=...&endAt=...&isEmergency=...)
 */
export const ChargerDetailsQuerySchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isEmergency: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export type ChargerDetailsQueryParams = z.infer<typeof ChargerDetailsQuerySchema>;
