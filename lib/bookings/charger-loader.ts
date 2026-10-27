import { createAdminClient } from "@/lib/supabase/admin";
import {
  getApproximateCoordinates,
  validateSlot,
  checkAvailability,
  checkSlotOverlap,
  calculateBookingCost,
  type TimeSlot,
  type BookingRecord,
  type AvailabilityWindow,
  type Result,
  ok,
  err,
  type GeoPoint,
} from "@/lib/rules";
import { buildEmergencySlot, type EmergencySlotDetails } from "@/lib/search/emergency-slot";
import { checkForDuplicateBooking, mapBookingRuleError } from "./booking-helpers";

export interface SafeChargerDetails {
  id: string;
  hostId: string;
  title: string;
  connectorType: string;
  powerKw: number;
  pricePerHour: number;
  notes: string | null;
  hostConnectionType: string;
  approximateLocation: GeoPoint;
  isActive: boolean;
}

export interface SlotPreValidation {
  isBookable: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMinutes: number;
  estimatedCost: number;
  slot: TimeSlot;
  isStale: boolean;
  isEmergencyRefreshed: boolean;
}

export interface ChargerDetailsLoadResult {
  charger: SafeChargerDetails;
  windows: AvailabilityWindow[];
  validation?: SlotPreValidation;
}

/**
 * Loads a charger by ID server-side with strict privacy masking.
 *
 * Guarantees:
 * - Exact coordinates and street address are NEVER returned.
 * - Approximate location is computed with getApproximateCoordinates from lib/rules.
 * - Availability windows and confirmed bookings are queried under service_role.
 * - Emergency slots are automatically rebuilt if stale.
 * - Standard search slots flag staleness without silent shifts.
 */
export async function loadChargerDetails(
  chargerId: string,
  params?: {
    startAt?: string;
    endAt?: string;
    isEmergency?: boolean;
    currentDriverId?: string;
  },
  now: Date = new Date()
): Promise<Result<ChargerDetailsLoadResult>> {
  const adminClient = createAdminClient();

  // 1. Fetch charger using RPC get_charger_details_for_driver with fallback to admin select
  let chargerData: any = null;
  const { data: rpcData, error: rpcError } = await adminClient.rpc(
    "get_charger_details_for_driver",
    { p_charger_id: chargerId }
  );

  if (!rpcError && rpcData && rpcData.length > 0) {
    chargerData = rpcData[0];
  } else {
    // Fallback if migration has not been applied yet
    const { data: tableData, error: tableError } = await adminClient
      .from("chargers")
      .select(
        "id, host_id, title, connector_type, power_kw, price_per_hour, notes, host_connection_type, latitude, longitude, is_active"
      )
      .eq("id", chargerId)
      .maybeSingle();

    if (tableError || !tableData) {
      return err("CHARGER_NOT_FOUND", "The requested charging point could not be found.");
    }
    chargerData = tableData;
  }

  if (!chargerData) {
    return err("CHARGER_NOT_FOUND", "The requested charging point could not be found.");
  }

  // Compute deterministic approximate coordinates via pure rules engine
  const exactLocation: GeoPoint = {
    latitude: Number(chargerData.latitude),
    longitude: Number(chargerData.longitude),
  };
  const approximateLocation = getApproximateCoordinates(chargerData.id, exactLocation);

  const safeCharger: SafeChargerDetails = {
    id: chargerData.id,
    hostId: chargerData.host_id,
    title: chargerData.title,
    connectorType: chargerData.connector_type,
    powerKw: Number(chargerData.power_kw),
    pricePerHour: Number(chargerData.price_per_hour),
    notes: chargerData.notes,
    hostConnectionType: chargerData.host_connection_type || "domestic",
    approximateLocation,
    isActive: Boolean(chargerData.is_active),
  };

  // 2. Fetch availability windows
  const { data: rawWindows, error: windowsError } = await adminClient
    .from("availability_windows")
    .select("id, charger_id, day_of_week, start_time, end_time")
    .eq("charger_id", chargerId);

  if (windowsError) {
    console.error("[loadChargerDetails] Windows query error:", windowsError);
    return err("DATABASE_ERROR", "Could not load charger availability schedule.");
  }

  const windows: AvailabilityWindow[] = (rawWindows || []).map((w) => ({
    id: w.id,
    chargerId: w.charger_id,
    dayOfWeek: w.day_of_week,
    startTime: w.start_time,
    endTime: w.end_time,
  }));

  // If no slot parameters provided, return charger and windows
  if (!params?.startAt || !params?.endAt) {
    return ok({ charger: safeCharger, windows });
  }

  // 3. Process Slot & Handle Staleness
  let effectiveSlot: TimeSlot = {
    startAt: params.startAt,
    endAt: params.endAt,
  };
  let isEmergencyRefreshed = false;
  let isStale = false;

  const slotStartMs = new Date(effectiveSlot.startAt).getTime();
  const currentMs = now.getTime();

  if (params.isEmergency) {
    // For Emergency mode: If the slot start is <= now + 5 minutes, rebuild fresh 10-minute slot
    if (slotStartMs <= currentMs + 5 * 60 * 1000) {
      const rebuild = buildEmergencySlot(now);
      if (rebuild.success) {
        effectiveSlot = {
          startAt: rebuild.data.startAt,
          endAt: rebuild.data.endAt,
        };
        isEmergencyRefreshed = true;
      } else {
        // Near midnight error
        return ok({
          charger: safeCharger,
          windows,
          validation: {
            isBookable: false,
            errorCode: rebuild.error.code,
            errorMessage: rebuild.error.message,
            durationMinutes: 0,
            estimatedCost: 0,
            slot: effectiveSlot,
            isStale: true,
            isEmergencyRefreshed: false,
          },
        });
      }
    }
  } else {
    // For standard search: flag if slot is in the past
    if (slotStartMs <= currentMs) {
      isStale = true;
    }
  }

  // 4. Fetch Bookings on this charger that intersect the slot
  const { data: rawBookings, error: bookingsError } = await adminClient
    .from("bookings")
    .select("id, charger_id, driver_id, start_at, end_at, status")
    .eq("charger_id", chargerId)
    .lt("start_at", effectiveSlot.endAt)
    .gt("end_at", effectiveSlot.startAt);

  if (bookingsError) {
    console.error("[loadChargerDetails] Bookings query error:", bookingsError);
    return err("DATABASE_ERROR", "Could not verify existing bookings on this charger.");
  }

  const existingBookings: BookingRecord[] = (rawBookings || []).map((b) => ({
    id: b.id,
    chargerId: b.charger_id,
    driverId: b.driver_id,
    startAt: new Date(b.start_at),
    endAt: new Date(b.end_at),
    status: b.status,
  }));

  // 5. Pre-validate using rules engine
  // A. Slot validation (duration, 30m steps, future check)
  const slotVal = validateSlot(effectiveSlot, now);
  if (!slotVal.success) {
    return ok({
      charger: safeCharger,
      windows,
      validation: {
        isBookable: false,
        errorCode: slotVal.error.code,
        errorMessage: mapBookingRuleError(slotVal.error.code, slotVal.error.message),
        durationMinutes: 0,
        estimatedCost: 0,
        slot: effectiveSlot,
        isStale,
        isEmergencyRefreshed,
      },
    });
  }

  const durationMinutes = slotVal.data.durationMinutes;
  const costResult = calculateBookingCost(durationMinutes, safeCharger.pricePerHour);
  const estimatedCost = costResult.success ? costResult.data.totalCost : 0;

  // B. Charger Active Check
  if (!safeCharger.isActive) {
    return ok({
      charger: safeCharger,
      windows,
      validation: {
        isBookable: false,
        errorCode: "CHARGER_INACTIVE",
        errorMessage: mapBookingRuleError("CHARGER_INACTIVE"),
        durationMinutes,
        estimatedCost,
        slot: effectiveSlot,
        isStale,
        isEmergencyRefreshed,
      },
    });
  }

  // C. Availability Window check
  const availVal = checkAvailability(effectiveSlot, {
    isActive: safeCharger.isActive,
    windows,
  });
  if (!availVal.success) {
    return ok({
      charger: safeCharger,
      windows,
      validation: {
        isBookable: false,
        errorCode: availVal.error.code,
        errorMessage: mapBookingRuleError(availVal.error.code, availVal.error.message),
        durationMinutes,
        estimatedCost,
        slot: effectiveSlot,
        isStale,
        isEmergencyRefreshed,
      },
    });
  }

  // D. Overlap check against confirmed bookings
  const overlapVal = checkSlotOverlap(effectiveSlot, existingBookings, safeCharger.id);
  if (!overlapVal.success) {
    return ok({
      charger: safeCharger,
      windows,
      validation: {
        isBookable: false,
        errorCode: overlapVal.error.code,
        errorMessage: mapBookingRuleError(overlapVal.error.code, overlapVal.error.message),
        durationMinutes,
        estimatedCost,
        slot: effectiveSlot,
        isStale,
        isEmergencyRefreshed,
      },
    });
  }

  // E. Duplicate booking check for current driver
  if (params.currentDriverId) {
    const dupCheck = checkForDuplicateBooking(
      params.currentDriverId,
      effectiveSlot,
      existingBookings
    );
    if (dupCheck.isDuplicate) {
      return ok({
        charger: safeCharger,
        windows,
        validation: {
          isBookable: false,
          errorCode: "DUPLICATE_BOOKING",
          errorMessage: dupCheck.message || mapBookingRuleError("DUPLICATE_BOOKING"),
          durationMinutes,
          estimatedCost,
          slot: effectiveSlot,
          isStale,
          isEmergencyRefreshed,
        },
      });
    }
  }

  return ok({
    charger: safeCharger,
    windows,
    validation: {
      isBookable: true,
      durationMinutes,
      estimatedCost,
      slot: effectiveSlot,
      isStale: false,
      isEmergencyRefreshed,
    },
  });
}
