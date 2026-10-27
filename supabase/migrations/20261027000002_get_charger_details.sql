-- ============================================================================
-- PlugNear: Single Charger Safe Lookup Function & RLS Cycle Fix
-- Version: 20261027000002
-- Description:
--   1. Provides a server-only function to fetch a single charger by ID for the
--      details page and booking flow.
--      SECURITY DEFINER with fixed search_path.
--      Enforces caller is service_role or authenticated driver.
--      Revoked from PUBLIC, anon, and authenticated so client browsers cannot invoke directly.
--      Granted ONLY to service_role (server-side Next.js loader/actions).
--   2. Prevents mutual RLS recursion (Postgres error 42P17) between chargers and bookings:
--      Uses a SECURITY DEFINER helper public.is_charger_host to check host ownership
--      without recursively re-triggering the chargers SELECT policy.
-- ============================================================================

-- 1. Single Charger Safe Server-Side Lookup Function
CREATE OR REPLACE FUNCTION public.get_charger_details_for_driver(
  p_charger_id uuid
)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  title text,
  connector_type connector_type,
  power_kw numeric(6, 2),
  price_per_hour numeric(10, 2),
  notes text,
  host_connection_type host_connection_type,
  latitude double precision,
  longitude double precision,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
STABLE
AS $$
BEGIN
  -- Strict caller guard: Must be service_role OR an authenticated user with driver role
  IF current_user <> 'service_role' AND (
    auth.role() <> 'authenticated' OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver'
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

-- Explicitly revoke from PUBLIC, anon, and authenticated (cannot be called with public anon key)
REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_charger_details_for_driver(uuid) FROM authenticated;

-- Grant EXECUTE exclusively to service_role
GRANT EXECUTE ON FUNCTION public.get_charger_details_for_driver(uuid) TO service_role;

-- 2. Break Mutual RLS Recursion on public.bookings
-- Replaces the nested subquery on public.chargers with a SECURITY DEFINER helper function
CREATE OR REPLACE FUNCTION public.is_charger_host(
  p_charger_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chargers
    WHERE id = p_charger_id AND host_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Drivers see only their own bookings" ON public.bookings;
CREATE POLICY "Drivers see only their own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid() OR
    public.is_charger_host(charger_id, auth.uid())
  );
