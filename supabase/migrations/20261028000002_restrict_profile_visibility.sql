-- ============================================================================
-- PlugNear: Restrict profile visibility to booking counterparties
-- Version: 20261028000002
-- Description:
--   The initial schema granted SELECT on public.profiles to every authenticated
--   user, so any signed-in account could read the whole table - full names and
--   phone numbers of all hosts and drivers - straight from the browser with the
--   public anon key:
--
--     supabase.from('profiles').select('name, phone')
--
--   Nothing in the app needs that. Role checks always read the caller's own
--   row, and the only counterparty reads (a host listing driver names on the
--   bookings dashboard) already go through the service-role client.
--
--   This policy keeps exactly the access the product requires: your own row,
--   the host of a charger you booked, and the drivers who booked your chargers.
--   It uses the existing SECURITY DEFINER is_charger_host() helper so it cannot
--   re-enter the chargers RLS policies (which would recurse).
-- ============================================================================

DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;

DROP POLICY IF EXISTS "Profiles readable by self and booking counterparties" ON public.profiles;
CREATE POLICY "Profiles readable by self and booking counterparties"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- 1. Your own profile
    id = auth.uid()

    -- 2. A host may see the drivers who booked one of their chargers
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = profiles.id
        AND public.is_charger_host(b.charger_id, auth.uid())
    )

    -- 3. A driver may see the host of a charger they booked
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = auth.uid()
        AND public.is_charger_host(b.charger_id, profiles.id)
    )
  );
