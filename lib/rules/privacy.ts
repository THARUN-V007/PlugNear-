import type { Actor, BookingRecord, GeoPoint } from "./types";

/**
 * Calculates the great-circle distance between two geographic coordinates
 * in meters using the Haversine formula.
 */
export function calculateHaversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const val =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
  return R * c;
}

/**
 * Internal deterministic 32-bit FNV-1a hash of a string.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Returns a deterministic approximate position for a charger by shifting its
 * true position by a fixed distance between 200m and 350m based on a hash of chargerId.
 *
 * Guarantees:
 * - Deterministic: Always returns the exact same coordinates for the same chargerId.
 * - Distance: The shifted position is always within ~200 to 350 meters of the true position.
 * - Privacy: Obscures exact residential address while remaining useful on a neighborhood map.
 */
export function getApproximateCoordinates(chargerId: string, exact: GeoPoint): GeoPoint {
  const h1 = fnv1a(chargerId);
  const h2 = fnv1a(chargerId + "_offset_seed");

  // Normalized floats between 0 and 1
  const norm1 = (h1 % 10000) / 10000;
  const norm2 = (h2 % 10000) / 10000;

  // Angle in radians [0, 2π)
  const angle = norm1 * 2 * Math.PI;

  // Distance in meters between 200m and 350m
  const distanceMeters = 200 + norm2 * 150;

  const latRad = (exact.latitude * Math.PI) / 180;
  const metersPerDegreeLat = 111132.954;
  const metersPerDegreeLng = 111132.954 * Math.cos(latRad);

  const deltaLat = (distanceMeters * Math.cos(angle)) / metersPerDegreeLat;
  const deltaLng = (distanceMeters * Math.sin(angle)) / metersPerDegreeLng;

  return {
    latitude: Number((exact.latitude + deltaLat).toFixed(6)),
    longitude: Number((exact.longitude + deltaLng).toFixed(6)),
  };
}

/**
 * Evaluates whether a viewing user has permission to view a charger's exact
 * address and coordinates.
 *
 * Rules:
 * 1. The charger host can always view exact location.
 * 2. A driver can view exact location ONLY IF they have a CONFIRMED booking on that charger.
 * 3. In all other cases (unauthenticated, unrelated drivers, drivers with only pending requests),
 *    exact location is hidden.
 */
export function canViewExactLocation(
  viewer: Actor,
  charger: { hostId: string },
  userBookingsOnCharger?: BookingRecord[]
): boolean {
  // 1. Host owns the charger
  if (viewer.role === "host" && viewer.userId === charger.hostId) {
    return true;
  }

  // 2. Driver with a confirmed booking
  if (viewer.role === "driver" && userBookingsOnCharger && userBookingsOnCharger.length > 0) {
    const hasConfirmedBooking = userBookingsOnCharger.some(
      (b) => b.driverId === viewer.userId && b.status === "confirmed"
    );
    if (hasConfirmedBooking) {
      return true;
    }
  }

  return false;
}
