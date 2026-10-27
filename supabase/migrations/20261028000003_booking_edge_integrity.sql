-- ============================================================================
-- PlugNear: Booking edge-case integrity
-- Version: 20261028000003
-- Description:
--   Three holes that only appear once real drivers push on the edges:
--
--   1. A driver could hold confirmed bookings on TWO different chargers for the
--      same time. The exclusion constraint is per-charger, so nothing stopped it,
--      and the host approving the second one was never told. A person cannot be
--      at two charging bays at once, so approval now raises DRIVER_SLOT_CONFLICT.
--
--   2. Approving a booking only auto-declined overlapping pending requests on the
--      SAME charger (spec 8.4). Overlapping pending requests the same driver made
--      elsewhere were left dangling forever. The auto-decline now covers both.
--
--   3. A double-submitted request (double click, retried fetch) could insert two
--      identical pending rows, because the duplicate check is a read-then-write
--      and no constraint backed it. A partial unique index closes that race.
-- ============================================================================

-- 1 + 2. Host approval: cross-charger driver conflict guard and wider auto-decline.
CREATE OR REPLACE FUNCTION public.host_approve_booking_atomic(
  p_booking_id uuid,
  p_host_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_charger record;
  v_auto_declined_ids uuid[];
BEGIN
  -- Strict caller guard: must be service_role OR an authenticated host
  IF current_user <> 'service_role' AND (
    auth.role() <> 'authenticated' OR NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'host'::public.user_role
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: caller must be a signed-in host or service_role'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Fetch and row-lock the target booking
  SELECT b.id, b.charger_id, b.driver_id, b.start_at, b.end_at, b.status, b.total_cost
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify the charger exists and belongs to the calling host
  SELECT c.id, c.host_id, c.is_active
  INTO v_charger
  FROM public.chargers c
  WHERE c.id = v_booking.charger_id;

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

  IF NOT v_charger.is_active THEN
    RAISE EXCEPTION 'CHARGER_INACTIVE: Cannot approve a booking for a deactivated charger'
      USING ERRCODE = '22000';
  END IF;

  -- 4. The driver cannot already be confirmed somewhere else for this time
  IF EXISTS (
    SELECT 1
    FROM public.bookings c2
    WHERE c2.driver_id = v_booking.driver_id
      AND c2.id <> v_booking.id
      AND c2.status = 'confirmed'
      AND tstzrange(c2.start_at, c2.end_at, '[)')
          && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'DRIVER_SLOT_CONFLICT: This driver already holds a confirmed booking at another charger for this time'
      USING ERRCODE = '23P01';
  END IF;

  -- 5. Confirm the approved booking
  UPDATE public.bookings
  SET status = 'confirmed',
      decided_at = p_now
  WHERE id = v_booking.id;

  -- 6. Auto-decline every other overlapping pending request that this approval
  --    makes impossible: same charger (any driver) OR same driver (any charger).
  WITH declined_rows AS (
    UPDATE public.bookings
    SET status = 'declined',
        decided_at = p_now
    WHERE id <> v_booking.id
      AND status = 'requested'
      AND tstzrange(start_at, end_at, '[)')
          && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
      AND (charger_id = v_booking.charger_id OR driver_id = v_booking.driver_id)
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_auto_declined_ids
  FROM declined_rows;

  -- 7. Return structured result
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

REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.host_approve_booking_atomic(uuid, uuid, timestamptz) TO service_role;

-- 3. Exact duplicate active requests are impossible, even on a double submit.
--    Partial: a cancelled/declined/expired row must not block a genuine re-book,
--    and two drivers may still request the same slot at the same charger.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_request_per_driver_slot
  ON public.bookings (charger_id, driver_id, start_at, end_at)
  WHERE status IN ('requested', 'confirmed');
