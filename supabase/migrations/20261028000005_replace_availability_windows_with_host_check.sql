-- ============================================================================
-- PlugNear: Atomic availability window replacement with host ownership check
-- Version: 20261028000005
-- Description:
--   Drops the old 2-argument replace_charger_availability_windows(p_charger_id, p_windows)
--   function so no unguarded overload exists.
--   Creates replace_charger_availability_windows(p_charger_id, p_host_id, p_windows)
--   which enforces host ownership within the atomic transaction before replacing windows.
--   Granted exclusively to service_role (never callable by anon or authenticated directly).
-- ============================================================================

-- 1. Drop old 2-argument version so no unguarded overload exists
DROP FUNCTION IF EXISTS public.replace_charger_availability_windows(uuid, jsonb);

-- 2. Create the guarded 3-argument version
CREATE OR REPLACE FUNCTION public.replace_charger_availability_windows(
  p_charger_id uuid,
  p_host_id uuid,
  p_windows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF p_charger_id IS NULL THEN
    RAISE EXCEPTION 'CHARGER_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_host_id IS NULL THEN
    RAISE EXCEPTION 'HOST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_windows IS NULL OR jsonb_typeof(p_windows) <> 'array' THEN
    RAISE EXCEPTION 'WINDOWS_MUST_BE_ARRAY' USING ERRCODE = '22P02';
  END IF;

  -- Verify charger exists AND belongs to the specified host
  IF NOT EXISTS (
    SELECT 1 FROM public.chargers c
    WHERE c.id = p_charger_id AND c.host_id = p_host_id
  ) THEN
    RAISE EXCEPTION 'CHARGER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Atomically wipe existing windows for this charger
  DELETE FROM public.availability_windows WHERE charger_id = p_charger_id;

  -- Insert the new set; if empty array, 0 rows inserted
  IF jsonb_array_length(p_windows) > 0 THEN
    INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
    SELECT
      p_charger_id,
      (w ->> 'day_of_week')::integer,
      (w ->> 'start_time')::time,
      (w ->> 'end_time')::time
    FROM jsonb_array_elements(p_windows) AS w;
  END IF;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- 3. Lock down execution permissions to service_role only
REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_charger_availability_windows(uuid, uuid, jsonb) TO service_role;
