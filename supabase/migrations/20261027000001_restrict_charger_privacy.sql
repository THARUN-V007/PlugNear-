-- ============================================================================
-- PlugNear: Restrict Charger Privacy & Proximity Search Function
-- Version: 20261027000001
-- Description:
--   1. Restricts SELECT on public.chargers so unconfirmed drivers cannot read
--      exact coordinates or street addresses directly.
--   2. Provides a public_chargers view exposing only non-sensitive metadata.
--   3. Adds a PostGIS proximity search function search_chargers_nearby
--      accessible ONLY to the server-side service_role (revoked from public/anon/authenticated).
-- ============================================================================

-- 1. Restrict public.chargers base table SELECT policy
DROP POLICY IF EXISTS "Active chargers are viewable by authenticated users" ON public.chargers;
DROP POLICY IF EXISTS "Chargers viewable by host or confirmed driver" ON public.chargers;

CREATE POLICY "Chargers viewable by host or confirmed driver"
  ON public.chargers FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.charger_id = chargers.id
        AND bookings.driver_id = auth.uid()
        AND bookings.status = 'confirmed'
    )
  );

-- 2. Safe Public Chargers View (exposes safe metadata with NO private address or coordinates)
CREATE OR REPLACE VIEW public.public_chargers AS
SELECT
  id,
  host_id,
  title,
  connector_type,
  power_kw,
  price_per_hour,
  notes,
  host_connection_type,
  is_active,
  created_at
FROM public.chargers
WHERE is_active = true;

GRANT SELECT ON public.public_chargers TO authenticated;

-- 3. PostGIS Spatial Search Function (Server-Side Only)
CREATE OR REPLACE FUNCTION public.search_chargers_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision,
  p_connector_type text DEFAULT NULL
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
  distance_meters double precision,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
STABLE
AS $$
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
    ST_Distance(
      c.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) AS distance_meters,
    c.is_active
  FROM public.chargers c
  WHERE c.is_active = true
    AND (p_connector_type IS NULL OR c.connector_type::text = p_connector_type)
    AND ST_DWithin(
      c.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters ASC;
$$;

-- Lock down function: REVOKE from public/anon/authenticated; GRANT only to service_role
REVOKE ALL ON FUNCTION public.search_chargers_nearby(double precision, double precision, double precision, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_chargers_nearby(double precision, double precision, double precision, text) FROM anon;
REVOKE ALL ON FUNCTION public.search_chargers_nearby(double precision, double precision, double precision, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.search_chargers_nearby(double precision, double precision, double precision, text) TO service_role;
