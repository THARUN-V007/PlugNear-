import {
  checkAvailability,
  checkSlotOverlap,
  calculateBookingCost,
  getApproximateCoordinates,
  type TimeSlot,
  type AvailabilityWindow,
  type BookingRecord,
  type GeoPoint,
  type ValidatedSlotDetails,
} from "@/lib/rules";

export interface RawCandidateCharger {
  id: string;
  hostId: string;
  title: string;
  connectorType: string;
  powerKw: number;
  pricePerHour: number;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  isActive: boolean;
  notes?: string | null;
  hostConnectionType?: string | null;
  windows: AvailabilityWindow[];
  bookings: BookingRecord[];
}

export interface AssembleSearchInput {
  candidates: RawCandidateCharger[];
  slot: TimeSlot;
  validatedSlot: ValidatedSlotDetails;
  limit: number;
  connectorFilter?: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  connectorType: string;
  powerKw: number;
  pricePerHour: number;
  distanceKm: number;
  estimatedCost: number;
  approximateLocation: GeoPoint;
}

export interface SearchResponsePayload {
  chargers: SearchResultItem[];
  meta: {
    totalInRadius: number;
    availableCount: number;
  };
}

/**
 * Pure function that filters, validates, ranks, and transforms raw candidate chargers
 * into the public search response payload.
 *
 * Rules:
 * 1. Counts total active chargers in the radius matching optional connector filter.
 * 2. Checks each candidate against lib/rules availability windows.
 * 3. Checks each candidate against lib/rules overlap check (confirmed bookings only).
 * 4. Computes estimated cost via lib/rules.
 * 5. Masks exact coordinates using lib/rules approximate pin generator.
 * 6. Strips exact address and host contact details.
 * 7. Sorts nearest first and truncates to requested limit.
 */
export function assembleSearchResults(input: AssembleSearchInput): SearchResponsePayload {
  const { candidates, slot, validatedSlot, limit, connectorFilter } = input;

  // 1. Filter matching active candidates within radius
  const matchingCandidates = candidates.filter((c) => {
    if (!c.isActive) {
      return false;
    }
    if (connectorFilter && c.connectorType !== connectorFilter) {
      return false;
    }
    return true;
  });

  const totalInRadius = matchingCandidates.length;
  const availableItems: SearchResultItem[] = [];

  for (const candidate of matchingCandidates) {
    // 2. Availability window check
    const availabilityResult = checkAvailability(slot, {
      isActive: candidate.isActive,
      windows: candidate.windows,
    });
    if (!availabilityResult.success) {
      continue;
    }

    // 3. Booking overlap check (confirmed bookings only block)
    const overlapResult = checkSlotOverlap(slot, candidate.bookings, candidate.id);
    if (!overlapResult.success) {
      continue;
    }

    // 4. Calculate cost
    const costResult = calculateBookingCost(
      validatedSlot.durationMinutes,
      candidate.pricePerHour
    );
    const estimatedCost = costResult.success ? costResult.data.totalCost : 0;

    // 5. Compute approximate location (deterministic, 200m-350m offset)
    const approximateLocation = getApproximateCoordinates(candidate.id, {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });

    // 6. Distance in km rounded to one decimal
    const distanceKm = Math.round((candidate.distanceMeters / 1000) * 10) / 10;

    // 7. Assemble safe result item (never contains exact coordinates or address_text)
    availableItems.push({
      id: candidate.id,
      title: candidate.title,
      connectorType: candidate.connectorType,
      powerKw: candidate.powerKw,
      pricePerHour: candidate.pricePerHour,
      distanceKm,
      estimatedCost,
      approximateLocation,
    });
  }

  const availableCount = availableItems.length;

  // 8. Sort nearest first (using distanceKm and tie-breaking by exact distance)
  availableItems.sort((a, b) => a.distanceKm - b.distanceKm);

  // 9. Apply limit
  const limitedItems = availableItems.slice(0, Math.max(1, limit));

  return {
    chargers: limitedItems,
    meta: {
      totalInRadius,
      availableCount,
    },
  };
}
