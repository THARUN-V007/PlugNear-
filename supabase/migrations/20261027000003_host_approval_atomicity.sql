-- ============================================================================
-- PlugNear: Atomic Host Approval and Auto-Decline Function
-- Version: 20261027000003
-- Description:
--   1. Implements public.host_approve_booking_atomic:
--      Atomically transitions a requested booking to 'confirmed' and auto-declines
--      all other pending ('requested') bookings on the same charger that overlap
--      with the confirmed time slot.
--   2. Prevents race conditions and double-booking:
--      - Row-locks target booking row with FOR UPDATE.
--      - Validates ownership: charger must exist and belong to the host (raises BOOKING_NOT_FOUND otherwise).
--      - Validates that target booking is in 'requested' status and slot has not started.
--      - Confirms target booking with decided_at = p_now.
--      - Auto-declines overlapping pending bookings on the same charger with decided_at = p_now.
--      - Backed by the database-level exclusion constraint 'no_overlapping_confirmed_bookings'.
--      - Granted EXCLUSIVELY to service_role (server-only invocation).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.host_approve_booking_atomic(
  p_booking_id uuid,
  p_host_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_booking record;
  v_charger record;
  v_auto_declined_ids uuid[];
BEGIN
  -- Strict caller guard: Must be service_role OR an authenticated host
  IF current_user <> 'service_role' AND (
    auth.role() <> 'authenticated' OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'host'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: caller must be a signed-in host or service_role'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Fetch and row-lock the target booking
  SELECT id, charger_id, driver_id, start_at, end_at, status, total_cost
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify that the charger row exists AND belongs to the calling host
  SELECT id, host_id
  INTO v_charger
  FROM public.chargers
  WHERE id = v_booking.charger_id;

  IF NOT FOUND OR v_charger.host_id <> p_host_id THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. State transition checks
  IF v_booking.status <> 'requested' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Booking is not in requested status'
      USING ERRCODE = '22000';
  END IF;

  IF p_now >= v_booking.start_at THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot approve a booking after its start time'
      USING ERRCODE = '22000';
  END IF;

  -- 4. Confirm the approved booking
  UPDATE public.bookings
  SET status = 'confirmed',
      decided_at = p_now
  WHERE id = v_booking.id;

  -- 5. Auto-decline all other overlapping 'requested' bookings on this charger
  WITH declined_rows AS (
    UPDATE public.bookings
    SET status = 'declined',
        decided_at = p_now
    WHERE charger_id = v_booking.charger_id
      AND id <> v_booking.id
      AND status = 'requested'
      AND tstzrange(start_at, end_at, '[)') && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_auto_declined_ids
  FROM declined_rows;

  -- 6. Return structured result
  RETURN jsonb_build_object(
    'booking_id', v_booking.id,
    'status', 'confirmed',
    'decided_at', p_now,
    'auto_declined_count', cardinality(v_auto_declined_ids),
    'auto_declined_ids', v_auto_declined_ids
  );

EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_BLOCKED: Another booking for this time was confirmed concurrently'
      USING ERRCODE = '23P01';
END;
$$;

-- Explicitly revoke from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM authenticated;

-- Grant EXECUTE exclusively to service_role
GRANT EXECUTE ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) TO service_role;
