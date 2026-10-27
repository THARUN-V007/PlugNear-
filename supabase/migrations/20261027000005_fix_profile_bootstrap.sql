-- ============================================================================
-- PlugNear: Fix profile bootstrap trigger + driver details RPC
-- Version: 20261027000005
-- Description:
--   Two production-blocking database defects.
--
--   1. public.handle_new_user() was created without a pinned search_path and
--      referenced the enum type unqualified (`user_role`). GoTrue connects with
--      a restricted search_path, so the type reference fails and EVERY sign-up
--      and admin user creation returns HTTP 500 "Database error creating new
--      user". The trigger also cast `role` straight from metadata, so an empty
--      or unexpected value raised `invalid input value for enum`.
--      Fix: pin search_path, qualify the enum, and map unknown roles safely.
--
--   2. public.get_charger_details_for_driver() raises
--      `42702: column reference "id" is ambiguous` because its RETURNS TABLE
--      output parameter `id` collides with the unqualified `id` column of
--      public.profiles inside the caller guard. The function therefore fails on
--      every call, breaking /driver/chargers/[id].
--      Fix: qualify the column reference.
-- ============================================================================

-- 1. Profile bootstrap trigger: pinned search_path, qualified types, safe role mapping.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.user_role;
  v_name text;
  v_phone text;
  v_raw_role text;
BEGIN
  v_raw_role := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'role'), '');

  -- Map only the two known labels; anything else (or nothing) becomes a driver.
  IF v_raw_role = 'host' THEN
    v_role := 'host'::public.user_role;
  ELSE
    v_role := 'driver'::public.user_role;
  END IF;

  v_name := COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), ''), split_part(NEW.email, '@', 1));
  v_phone := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'phone'), '');

  INSERT INTO public.profiles (id, name, role, phone, created_at)
  VALUES (NEW.id, v_name, v_role, v_phone, now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Keep the trigger bound to the repaired function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Hardening: the other two row triggers also had no pinned search_path.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'User role cannot be changed once created.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_availability_window_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.availability_windows w
    WHERE w.charger_id = NEW.charger_id
      AND w.day_of_week = NEW.day_of_week
      AND w.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (NEW.start_time < w.end_time AND NEW.end_time > w.start_time)
  ) THEN
    RAISE EXCEPTION 'Availability windows on the same day cannot overlap for charger %', NEW.charger_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Driver details RPC: qualify the profiles column so `id` is no longer ambiguous.
CREATE OR REPLACE FUNCTION public.get_charger_details_for_driver(
  p_charger_id uuid
)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  title text,
  connector_type public.connector_type,
  power_kw numeric(6, 2),
  price_per_hour numeric(10, 2),
  notes text,
  host_connection_type public.host_connection_type,
  latitude double precision,
  longitude double precision,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF current_user <> 'service_role' AND (
    auth.role() <> 'authenticated' OR NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'driver'::public.user_role
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: caller must be a signed-in driver or service_role';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.host_id,
    c.title,
    c.connector_type,
    c.power_kw,
    c.price_per_hour,
    c.notes,
    c.host_connection_type,
    c.latitude,
    c.longitude,
    c.is_active
  FROM public.chargers c
  WHERE c.id = p_charger_id
    AND c.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_charger_details_for_driver(uuid) TO service_role;

-- 4. Backfill: repair profiles for users that already exist but have no profile row.
--    Their role is taken from auth metadata, defaulting to driver.
INSERT INTO public.profiles (id, name, role, phone)
SELECT
  u.id,
  COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
  CASE WHEN u.raw_user_meta_data ->> 'role' = 'host' THEN 'host'::public.user_role
       ELSE 'driver'::public.user_role END,
  NULLIF(BTRIM(u.raw_user_meta_data ->> 'phone'), '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
