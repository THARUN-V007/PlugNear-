-- ============================================================================
-- PlugNear: Atomic availability window replacement
-- Version: 20261028000001
-- Description:
--   Hosts edit their whole weekly schedule at once. Doing "delete all windows
--   then insert the new set" from the app is two separate round trips: if the
--   insert fails (for example the same-day overlap trigger rejects the set), the
--   charger is left with NO windows and silently disappears from every search.
--
--   replace_charger_availability_windows() performs the delete and the insert
--   inside one function call, so a rejected set rolls back and keeps the
--   previous schedule intact. Same-day overlap is still enforced by
--   tr_check_window_overlap, so this function cannot weaken that rule.
--
--   Granted exclusively to service_role, matching the other server-only RPCs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_charger_availability_windows(
  p_charger_id uuid,
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

  IF p_windows IS NULL OR jsonb_typeof(p_windows) <> 'array' THEN
    RAISE EXCEPTION 'WINDOWS_MUST_BE_ARRAY' USING ERRCODE = '22P02';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.chargers c WHERE c.id = p_charger_id) THEN
    RAISE EXCEPTION 'CHARGER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.availability_windows WHERE charger_id = p_charger_id;

  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT
    p_charger_id,
    (w ->> 'day_of_week')::integer,
    (w ->> 'start_time')::time,
    (w ->> 'end_time')::time
  FROM jsonb_array_elements(p_windows) AS w;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_charger_availability_windows(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_charger_availability_windows(uuid, jsonb) TO service_role;
