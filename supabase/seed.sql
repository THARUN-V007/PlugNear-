-- ============================================================================
-- PlugNear: Repeatable Seed Script (minimal, realistic demo data)
-- Area: Indiranagar, Bengaluru (Karnataka, India) · Timezone: Asia/Kolkata
-- Shared dev password: Password123!
--
-- Deliberately small: ONE host, ONE driver, TWO chargers, TWO bookings.
-- Every record is written as believable production data - real landmarks,
-- connector/power/price combinations you would actually see in Bengaluru, and
-- host notes a driver would read before driving there.
--
-- Preferred path is still `npm run seed` (Admin API). This file is the SQL
-- Editor alternative: it resolves users by email and only creates an auth.users
-- row when it is missing, so it converges on the same data as the script and
-- can be re-run safely.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_host_id uuid;
  v_driver_id uuid;

  v_charger_home uuid := 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_charger_store uuid := 'a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  v_tomorrow date := CURRENT_DATE + 1;
  v_tomorrow_is_sunday boolean := EXTRACT(ISODOW FROM CURRENT_DATE + 1) = 7;

  v_pending_charger uuid;
  v_pending_start timestamptz;
  v_pending_end timestamptz;
  v_pending_cost numeric(10, 2);
BEGIN
  RAISE NOTICE 'Seeding PlugNear demo data (1 host, 1 driver, 2 chargers, 2 bookings)...';

  -- ---------------------------------------------------------------------------
  -- 1. Resolve or create the two demo accounts
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_host_id FROM auth.users WHERE email = 'host@plugnear.dev';
  IF v_host_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'host@plugnear.dev', v_password, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Manjunath Setty","role":"host","phone":"+91 98860 41235"}'::jsonb,
      now(), now(), '', '', '', '', false
    )
    RETURNING id INTO v_host_id;
  ELSE
    UPDATE auth.users
      SET encrypted_password = v_password,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          raw_user_meta_data = '{"name":"Manjunath Setty","role":"host","phone":"+91 98860 41235"}'::jsonb
    WHERE id = v_host_id;
  END IF;

  SELECT id INTO v_driver_id FROM auth.users WHERE email = 'driver@plugnear.dev';
  IF v_driver_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'driver@plugnear.dev', v_password, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Nithya Rao","role":"driver","phone":"+91 99001 27654"}'::jsonb,
      now(), now(), '', '', '', '', false
    )
    RETURNING id INTO v_driver_id;
  ELSE
    UPDATE auth.users
      SET encrypted_password = v_password,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          raw_user_meta_data = '{"name":"Nithya Rao","role":"driver","phone":"+91 99001 27654"}'::jsonb
    WHERE id = v_driver_id;
  END IF;

  -- Email identities (GoTrue needs these for password logins)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  SELECT gen_random_uuid(), u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email),
         'email', u.email, now(), now(), now()
  FROM auth.users u
  WHERE u.id IN (v_host_id, v_driver_id)
    AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.provider = 'email' AND i.provider_id = u.email);

  -- ---------------------------------------------------------------------------
  -- 2. Profiles (the auth trigger normally does this; upsert keeps it idempotent)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.profiles (id, name, role, phone) VALUES
    (v_host_id, 'Manjunath Setty', 'host', '+91 98860 41235'),
    (v_driver_id, 'Nithya Rao', 'driver', '+91 99001 27654')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone;

  -- ---------------------------------------------------------------------------
  -- 3. Retire the older, bulkier demo dataset
  -- ---------------------------------------------------------------------------
  DELETE FROM public.chargers WHERE id IN (
    'a3333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a5555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );

  DELETE FROM public.bookings WHERE charger_id IN (v_charger_home, v_charger_store);
  DELETE FROM public.availability_windows WHERE charger_id IN (v_charger_home, v_charger_store);

  -- ---------------------------------------------------------------------------
  -- 4. Two chargers, both owned by the same host
  -- ---------------------------------------------------------------------------
  INSERT INTO public.chargers (
    id, host_id, title, address_text, latitude, longitude,
    connector_type, power_kw, price_per_hour, notes,
    host_connection_type, is_active, electricity_permission_acknowledged
  ) VALUES
    (
      v_charger_home, v_host_id,
      'Home Bay Charger - Indiranagar 1st Stage',
      'No. 24, 4th Cross Rd, Indiranagar 1st Stage, Bengaluru, Karnataka 560038',
      12.9755, 77.6395,
      'Type 2', 7.4, 85.00,
      'Covered ground-floor bay behind the main gate with a 6 m tethered Type 2 cable. Ring the intercom for Manjunath - the socket breaker is the third switch in the meter box by the door. Slow but dependable; good for topping up while you are at work or overnight.',
      'domestic', true, true
    ),
    (
      v_charger_store, v_host_id,
      'Store Fast Point - 100 Feet Road',
      'Shop No. 7, 100 Feet Rd, near Trinity Metro, Indiranagar, Bengaluru, Karnataka 560008',
      12.9784, 77.6403,
      'CCS2', 30.0, 190.00,
      'Customer parking bay behind the store shutter on a commercial meter. Open whenever the shop is, closed Sundays. Ask for the charging bay at the counter - staff will walk you through, and coffee is available next door while you wait.',
      'commercial', true, true
    )
  ON CONFLICT (id) DO UPDATE SET
    host_id = EXCLUDED.host_id,
    title = EXCLUDED.title,
    address_text = EXCLUDED.address_text,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    connector_type = EXCLUDED.connector_type,
    power_kw = EXCLUDED.power_kw,
    price_per_hour = EXCLUDED.price_per_hour,
    notes = EXCLUDED.notes,
    host_connection_type = EXCLUDED.host_connection_type,
    is_active = EXCLUDED.is_active,
    electricity_permission_acknowledged = true;

  -- ---------------------------------------------------------------------------
  -- 5. Weekly availability (day_of_week: 0 = Sunday)
  --    Home: weekday mornings before work and evenings, all day at weekends.
  --    Store: shop hours, closed Sunday.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger_home, 0, '06:00'::time, '22:30'::time
  UNION ALL SELECT v_charger_home, 1, '06:00', '10:00'
  UNION ALL SELECT v_charger_home, 1, '17:00', '22:30'
  UNION ALL SELECT v_charger_home, 2, '06:00', '10:00'
  UNION ALL SELECT v_charger_home, 2, '17:00', '22:30'
  UNION ALL SELECT v_charger_home, 3, '06:00', '10:00'
  UNION ALL SELECT v_charger_home, 3, '17:00', '22:30'
  UNION ALL SELECT v_charger_home, 4, '06:00', '10:00'
  UNION ALL SELECT v_charger_home, 4, '17:00', '22:30'
  UNION ALL SELECT v_charger_home, 5, '06:00', '10:00'
  UNION ALL SELECT v_charger_home, 5, '17:00', '22:30'
  UNION ALL SELECT v_charger_home, 6, '06:00', '12:00'
  UNION ALL SELECT v_charger_home, 6, '16:00', '22:30'
  UNION ALL SELECT v_charger_store, 1, '08:00', '20:00'
  UNION ALL SELECT v_charger_store, 2, '08:00', '20:00'
  UNION ALL SELECT v_charger_store, 3, '08:00', '20:00'
  UNION ALL SELECT v_charger_store, 4, '08:00', '20:00'
  UNION ALL SELECT v_charger_store, 5, '08:00', '20:00'
  UNION ALL SELECT v_charger_store, 6, '08:00', '20:00';

  -- ---------------------------------------------------------------------------
  -- 6. Two bookings: one already confirmed, one waiting on the host.
  --    Both are placed inside a real availability window for tomorrow's weekday,
  --    and they do not overlap, so approving the pending one always succeeds.
  -- ---------------------------------------------------------------------------
  IF v_tomorrow_is_sunday THEN
    v_pending_charger := v_charger_home;
    v_pending_start := (v_tomorrow || ' 20:00:00+05:30')::timestamptz;
    v_pending_end := (v_tomorrow || ' 21:00:00+05:30')::timestamptz;
    v_pending_cost := 85.00;
  ELSE
    v_pending_charger := v_charger_store;
    v_pending_start := (v_tomorrow || ' 11:00:00+05:30')::timestamptz;
    v_pending_end := (v_tomorrow || ' 12:30:00+05:30')::timestamptz;
    v_pending_cost := 285.00; -- 1.5 h x 190
  END IF;

  INSERT INTO public.bookings (
    id, charger_id, driver_id, start_at, end_at, status, total_cost, decided_at
  ) VALUES
    (
      'b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      v_charger_home, v_driver_id,
      (v_tomorrow || ' 18:00:00+05:30')::timestamptz,
      (v_tomorrow || ' 19:30:00+05:30')::timestamptz,
      'confirmed', 127.50, now()  -- 1.5 h x 85
    ),
    (
      'b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      v_pending_charger, v_driver_id,
      v_pending_start, v_pending_end,
      'requested', v_pending_cost
    );

  RAISE NOTICE 'Seed complete. Log in as host@plugnear.dev or driver@plugnear.dev (password: Password123!)';
END $$;
