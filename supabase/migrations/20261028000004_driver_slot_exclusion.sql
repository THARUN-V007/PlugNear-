-- ============================================================================
-- PlugNear: One confirmed slot per driver, enforced by the database
-- Version: 20261028000004
-- Description:
--   The charger-level exclusion constraint keeps two bookings from colliding on
--   the same bay, and the approval function pre-checks that the driver is not
--   already confirmed elsewhere. Neither survives a race: two different hosts
--   approving two overlapping requests from the same driver at the same instant
--   both pass their checks before either UPDATE commits, leaving the driver
--   confirmed at two chargers.
--
--   A partial exclusion constraint on (driver_id, slot) for confirmed bookings
--   closes that window at the storage layer, in the same way the existing
--   constraint protects a single charger.
-- ============================================================================

-- Refuse to install over data that already violates the rule, with an error that
-- says what to fix rather than an opaque constraint failure.
DO $$
DECLARE
  v_conflicting_pairs integer;
BEGIN
  SELECT count(*) INTO v_conflicting_pairs
  FROM public.bookings a
  JOIN public.bookings b
    ON a.driver_id = b.driver_id
   AND a.id < b.id
   AND a.status = 'confirmed'
   AND b.status = 'confirmed'
   AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');

  IF v_conflicting_pairs > 0 THEN
    RAISE EXCEPTION
      'Cannot add the driver overlap constraint: % pair(s) of confirmed bookings already overlap for the same driver. Cancel one booking in each pair first.',
      v_conflicting_pairs;
  END IF;
END $$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_confirmed_slots_per_driver;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_confirmed_slots_per_driver
  EXCLUDE USING gist (
    driver_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status = 'confirmed');
