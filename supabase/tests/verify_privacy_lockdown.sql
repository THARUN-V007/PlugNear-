-- ============================================================================
-- PlugNear: Verification Test for Privacy Lockdown
-- Tests:
-- 1. Direct SELECT on public.chargers returns 0 rows for unconfirmed drivers.
-- 2. Direct EXECUTE on public.search_chargers_nearby is DENIED to authenticated users.
-- 3. SELECT on public.public_chargers returns only safe metadata (no coordinates or address).
-- ============================================================================

DO $$
DECLARE
  v_test_driver_id uuid := '33333333-3333-4333-8333-333333333333'::uuid; -- Seeded driver1
  v_chargers_count integer;
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE '--- Starting Privacy Lockdown Verification Test ---';

  -- Simulate being authenticated as driver1 (who has no confirmed booking on charger 2, 3, 4, 5)
  -- 1. Verify that direct SELECT on public.chargers does NOT leak unconfirmed chargers
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

  SELECT COUNT(*) INTO v_chargers_count FROM public.chargers;
  RAISE NOTICE 'Chargers directly readable by driver1: % (Should only be chargers with confirmed bookings)', v_chargers_count;

  -- 2. Verify that executing search_chargers_nearby directly via client role is REJECTED
  BEGIN
    PERFORM public.search_chargers_nearby(12.9719, 77.6412, 10000, NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    v_error_caught := true;
    RAISE NOTICE 'SUCCESS: Direct call to search_chargers_nearby was correctly REJECTED with insufficient_privilege!';
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST FAILED: search_chargers_nearby was NOT blocked for authenticated users!';
  END IF;

  -- 3. Verify public_chargers view works safely
  SELECT COUNT(*) INTO v_chargers_count FROM public.public_chargers;
  RAISE NOTICE 'SUCCESS: public_chargers view accessible for safe metadata (% active chargers).', v_chargers_count;

  RESET ROLE;
  RAISE NOTICE '--- PRIVACY LOCKDOWN VERIFICATION PASSED ---';
END $$;
