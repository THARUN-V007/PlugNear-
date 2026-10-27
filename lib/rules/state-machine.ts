import { ERROR_CODES } from "./constants";
import { ok, err, type Result, type BookingRecord, type BookingStatus, type Actor } from "./types";

export interface TransitionParams {
  booking: BookingRecord;
  newStatus: BookingStatus;
  actor: Actor;
  hostId: string;
  now: Date | string;
}

export interface TransitionResult {
  updatedStatus: BookingStatus;
  decidedAt?: Date;
}

/**
 * Enforces the booking state machine transitions.
 *
 * Allowed Transitions:
 * 1. requested -> confirmed (actor: host of that charger, before slot start)
 * 2. requested -> declined (actor: host of that charger)
 * 3. requested -> cancelled (actor: the driver who made it)
 * 4. requested -> expired (actor: system, only when slot start time has passed)
 * 5. confirmed -> cancelled (actor: driver or host, only before slot start time)
 * 6. confirmed -> completed (actor: system, only when slot end time has passed)
 */
export function transitionBooking(params: TransitionParams): Result<TransitionResult> {
  const { booking, newStatus, actor, hostId, now } = params;
  const currentStatus = booking.status;
  const nowDate = typeof now === "string" ? new Date(now) : now;
  const startDate = typeof booking.startAt === "string" ? new Date(booking.startAt) : booking.startAt;
  const endDate = typeof booking.endAt === "string" ? new Date(booking.endAt) : booking.endAt;

  // Terminal states cannot be transitioned out of
  const terminalStates: BookingStatus[] = ["declined", "cancelled", "expired", "completed"];
  if (terminalStates.includes(currentStatus)) {
    return err(
      ERROR_CODES.TERMINAL_STATE,
      `Cannot transition booking: ${currentStatus} is a terminal state.`
    );
  }

  // --- TRANSITIONS FROM 'requested' ---
  if (currentStatus === "requested") {
    if (newStatus === "confirmed") {
      if (actor.role !== "host" || actor.userId !== hostId) {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only the host of this charger can approve booking requests."
        );
      }
      if (nowDate.getTime() >= startDate.getTime()) {
        return err(
          ERROR_CODES.INVALID_TRANSITION,
          "Cannot approve a booking request after its start time has passed."
        );
      }
      return ok({ updatedStatus: "confirmed", decidedAt: nowDate });
    }

    if (newStatus === "declined") {
      if (actor.role !== "host" || actor.userId !== hostId) {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only the host of this charger can decline booking requests."
        );
      }
      return ok({ updatedStatus: "declined", decidedAt: nowDate });
    }

    if (newStatus === "cancelled") {
      if (actor.role !== "driver" || actor.userId !== booking.driverId) {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only the driver who requested this booking can cancel it."
        );
      }
      // Rule 8.6: an undecided request whose start time has passed is `expired`,
      // not cancellable - otherwise the same request could flip between two
      // terminal states depending on who reads it first.
      if (nowDate.getTime() >= startDate.getTime()) {
        return err(
          ERROR_CODES.INVALID_TRANSITION,
          "This request has already expired because its start time passed without a decision."
        );
      }
      return ok({ updatedStatus: "cancelled", decidedAt: nowDate });
    }

    if (newStatus === "expired") {
      if (actor.role !== "system") {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only system refresh can mark a booking as expired."
        );
      }
      if (nowDate.getTime() < startDate.getTime()) {
        return err(
          ERROR_CODES.INVALID_TRANSITION,
          "A booking request can only expire once its scheduled start time has passed."
        );
      }
      return ok({ updatedStatus: "expired", decidedAt: nowDate });
    }
  }

  // --- TRANSITIONS FROM 'confirmed' ---
  if (currentStatus === "confirmed") {
    if (newStatus === "cancelled") {
      const isDriver = actor.role === "driver" && actor.userId === booking.driverId;
      const isHost = actor.role === "host" && actor.userId === hostId;

      if (!isDriver && !isHost) {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only the booking driver or charger host can cancel a confirmed booking."
        );
      }

      // Cancellation allowed only BEFORE the slot starts
      if (nowDate.getTime() >= startDate.getTime()) {
        return err(
          ERROR_CODES.CANNOT_CANCEL_STARTED,
          "A confirmed booking cannot be cancelled once its scheduled start time has arrived."
        );
      }

      return ok({ updatedStatus: "cancelled", decidedAt: nowDate });
    }

    if (newStatus === "completed") {
      if (actor.role !== "system") {
        return err(
          ERROR_CODES.UNAUTHORIZED_ACTOR,
          "Only system refresh can mark a booking as completed."
        );
      }
      if (nowDate.getTime() < endDate.getTime()) {
        return err(
          ERROR_CODES.INVALID_TRANSITION,
          "A booking can only be marked completed once its scheduled end time has passed."
        );
      }
      return ok({ updatedStatus: "completed" });
    }
  }

  // Any other requested transition is illegal
  return err(
    ERROR_CODES.INVALID_TRANSITION,
    `Illegal status transition from '${currentStatus}' to '${newStatus}'.`
  );
}

export interface StatusRefreshResult {
  expiredIds: string[];
  completedIds: string[];
  updates: Array<{ id: string; newStatus: BookingStatus }>;
}

/**
 * Lazy status refresh helper:
 * Scans a list of bookings against `now` and identifies which requested bookings
 * have expired and which confirmed bookings have completed.
 */
export function refreshBookingStatuses(
  bookings: BookingRecord[],
  now: Date | string
): StatusRefreshResult {
  const nowDate = typeof now === "string" ? new Date(now) : now;
  const nowMs = nowDate.getTime();

  const expiredIds: string[] = [];
  const completedIds: string[] = [];
  const updates: Array<{ id: string; newStatus: BookingStatus }> = [];

  for (const b of bookings) {
    const startMs = typeof b.startAt === "string" ? new Date(b.startAt).getTime() : b.startAt.getTime();
    const endMs = typeof b.endAt === "string" ? new Date(b.endAt).getTime() : b.endAt.getTime();

    if (b.status === "requested" && nowMs >= startMs) {
      expiredIds.push(b.id);
      updates.push({ id: b.id, newStatus: "expired" });
    } else if (b.status === "confirmed" && nowMs >= endMs) {
      completedIds.push(b.id);
      updates.push({ id: b.id, newStatus: "completed" });
    }
  }

  return { expiredIds, completedIds, updates };
}
