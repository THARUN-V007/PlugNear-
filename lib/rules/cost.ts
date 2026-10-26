import { APP_CURRENCY, ERROR_CODES } from "./constants";
import { ok, err, type Result } from "./types";

export interface BookingCostDetails {
  totalCost: number;
  durationHours: number;
  pricePerHour: number;
  currency: string;
}

/**
 * Calculates the total cost for a booking slot based on duration in minutes and hourly rate.
 *
 * Rules:
 * 1. Price per hour must be non-negative (>= 0).
 * 2. Duration in minutes must be strictly positive (> 0).
 * 3. Total cost = (durationMinutes / 60) * pricePerHour, rounded to 2 decimal places.
 */
export function calculateBookingCost(
  durationMinutes: number,
  pricePerHour: number
): Result<BookingCostDetails> {
  if (isNaN(pricePerHour) || pricePerHour < 0) {
    return err(
      ERROR_CODES.INVALID_PRICE,
      "Price per hour must be a non-negative number."
    );
  }

  if (isNaN(durationMinutes) || durationMinutes <= 0) {
    return err(
      ERROR_CODES.INVALID_DURATION,
      "Booking duration must be greater than zero."
    );
  }

  const durationHours = durationMinutes / 60;
  const rawCost = durationHours * pricePerHour;
  // Deterministic 2-decimal financial rounding
  const totalCost = Math.round((rawCost + Number.EPSILON) * 100) / 100;

  return ok({
    totalCost,
    durationHours,
    pricePerHour,
    currency: APP_CURRENCY,
  });
}
