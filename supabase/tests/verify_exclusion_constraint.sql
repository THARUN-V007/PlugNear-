-- ============================================================================
-- PlugNear: Verification Test for Definition of Done #5
-- Tests:
-- 1. Back-to-back confirmed bookings on the same charger are ALLOWED.
-- 2. Overlapping confirmed bookings on the same charger are REJECTED by exclusion constraint.
-- ============================================================================

DO $$
DECLARE
  v_host_id uuid := gen_random_uuid();
  v_driver1_id uuid := gen_random_uuid();
  v_driver2_id uuid := gen_random_uuid();
  v_charger_id uuid := gen_random_uuid();
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE '--- Starting Verification Test for Exclusion Constraint ---';

  -- 1. Create mock profiles directly (simulating service role / test harness)
  INSERT INTO public.profiles (id, name, role)
  VALUES
    (v_host_id, 'Test Host', 'host'),
    (v_driver1_id, 'Test Driver 1', 'driver'),
    (v_driver2_id, 'Test Driver 2', 'driver');

  -- 2. Create mock charger
  INSERT INTO public.chargers (
    id, host_id, title, address_text, latitude, longitude,
    connector_type, power_kw, price_per_hour
  ) VALUES (
    v_charger_id, v_host_id, 'Exclusion Test Charger', '123 Test St',
    12.9716, 77.5946, 'Type 2', 7.4, 150.00
  );

  -- 3. Insert first confirmed booking: 10:00 to 11:00 UTC
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost
  ) VALUES (
    v_charger_id, v_driver1_id,
    '2026-11-01 10:00:00+00', '2026-11-01 11:00:00+00',
    'confirmed', 150.00
  );
  RAISE NOTICE 'SUCCESS: First confirmed booking (10:00 - 11:00) inserted.';

  -- 4. Insert BACK-TO-BACK confirmed booking: 11:00 to 12:00 UTC (MUST SUCCEED)
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost
  ) VALUES (
    v_charger_id, v_driver2_id,
    '2026-11-01 11:00:00+00', '2026-11-01 12:00:00+00',
    'confirmed', 150.00
  );
  RAISE NOTICE 'SUCCESS: Back-to-back confirmed booking (11:00 - 12:00) inserted without error.';

  -- 5. Insert OVERLAPPING confirmed booking: 10:30 to 11:30 UTC (MUST FAIL)
  BEGIN
    INSERT INTO public.bookings (
      charger_id, driver_id, start_at, end_at, status, total_cost
    ) VALUES (
      v_charger_id, v_driver2_id,
      '2026-11-01 10:30:00+00', '2026-11-01 11:30:00+00',
      'confirmed', 150.00
    );
  EXCEPTION WHEN exclusion_violation THEN
    v_error_caught := true;
    RAISE NOTICE 'SUCCESS: Overlapping confirmed booking was correctly REJECTED with exclusion_violation!';
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST FAILED: Overlapping booking was NOT rejected!';
  END IF;

  -- Cleanup test harness data
  DELETE FROM public.chargers WHERE id = v_charger_id;
  DELETE FROM public.profiles WHERE id IN (v_host_id, v_driver1_id, v_driver2_id);

  RAISE NOTICE '--- ALL EXCLUSION CONSTRAINT VERIFICATION TESTS PASSED ---';
END $$;
