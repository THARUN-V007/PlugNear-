-- ============================================================================
-- PlugNear: Repeatable Seed Script
-- Area: Indiranagar, Bengaluru (Karnataka, India)
-- Timezone: Asia/Kolkata (IST)
-- Shared Dev Password: Password123!
-- ============================================================================

-- Ensure pgcrypto is enabled for hashing dev passwords
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_host1_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_host2_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_driver1_id uuid := '33333333-3333-4333-8333-333333333333'::uuid;
  v_driver2_id uuid := '44444444-4444-4444-8444-444444444444'::uuid;

  v_charger1_id uuid := 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_charger2_id uuid := 'a2222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_charger3_id uuid := 'a3333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_charger4_id uuid := 'a4444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_charger5_id uuid := 'a5555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;

  v_encrypted_password text := crypt('Password123!', gen_salt('bf'));
  v_tomorrow date := CURRENT_DATE + interval '1 day';
BEGIN
  RAISE NOTICE 'Seeding PlugNear test data...';

  -- 1. Create or update test users in auth.users
  -- Host 1
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
  ) VALUES (
    v_host1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'host1@plugnear.dev', v_encrypted_password, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Arun Host","role":"host","phone":"+91 98450 11111"}'::jsonb,
    now(), now(), '', '', '', '', false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = v_encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- Host 2
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
  ) VALUES (
    v_host2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'host2@plugnear.dev', v_encrypted_password, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Priya Host","role":"host","phone":"+91 98450 22222"}'::jsonb,
    now(), now(), '', '', '', '', false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = v_encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- Driver 1
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
  ) VALUES (
    v_driver1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'driver1@plugnear.dev', v_encrypted_password, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Vikram Driver","role":"driver","phone":"+91 98450 33333"}'::jsonb,
    now(), now(), '', '', '', '', false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = v_encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- Driver 2
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
  ) VALUES (
    v_driver2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'driver2@plugnear.dev', v_encrypted_password, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Ananya Driver","role":"driver","phone":"+91 98450 44444"}'::jsonb,
    now(), now(), '', '', '', '', false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = v_encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- 2. Insert or update corresponding identities in auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES
    (v_host1_id, v_host1_id, jsonb_build_object('sub', v_host1_id::text, 'email', 'host1@plugnear.dev'), 'email', 'host1@plugnear.dev', now(), now(), now()),
    (v_host2_id, v_host2_id, jsonb_build_object('sub', v_host2_id::text, 'email', 'host2@plugnear.dev'), 'email', 'host2@plugnear.dev', now(), now(), now()),
    (v_driver1_id, v_driver1_id, jsonb_build_object('sub', v_driver1_id::text, 'email', 'driver1@plugnear.dev'), 'email', 'driver1@plugnear.dev', now(), now(), now()),
    (v_driver2_id, v_driver2_id, jsonb_build_object('sub', v_driver2_id::text, 'email', 'driver2@plugnear.dev'), 'email', 'driver2@plugnear.dev', now(), now(), now())
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  -- 3. Upsert Profiles
  INSERT INTO public.profiles (id, name, role, phone)
  VALUES
    (v_host1_id, 'Arun Host', 'host', '+91 98450 11111'),
    (v_host2_id, 'Priya Host', 'host', '+91 98450 22222'),
    (v_driver1_id, 'Vikram Driver', 'driver', '+91 98450 33333'),
    (v_driver2_id, 'Ananya Driver', 'driver', '+91 98450 44444')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone;

  -- 3. Clear existing seeded test chargers & dependent rows to keep seed repeatable
  DELETE FROM public.chargers WHERE id IN (
    v_charger1_id, v_charger2_id, v_charger3_id, v_charger4_id, v_charger5_id
  );

  -- 4. Seed 5 Chargers in Indiranagar, Bengaluru
  INSERT INTO public.chargers (
    id, host_id, title, address_text, latitude, longitude,
    connector_type, power_kw, price_per_hour, notes,
    host_connection_type, is_active, electricity_permission_acknowledged
  ) VALUES
    (
      v_charger1_id, v_host1_id,
      '100ft Road Fast Hub',
      'Plot 42, 100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      12.9719, 77.6412,
      'CCS2', 22.0, 180.00,
      'Prime commercial spot near 100ft Rd junction. Cafe accessible during charging.',
      'commercial', true, true
    ),
    (
      v_charger2_id, v_host1_id,
      'Indiranagar Residential Home Plug',
      'No. 8, 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
      12.9698, 77.6385,
      'Type 2', 7.4, 120.00,
      'Quiet driveway parking. Suitable for overnight and daytime charging.',
      'domestic', true, true
    ),
    (
      v_charger3_id, v_host2_id,
      'Defence Colony Dedicated EV Port',
      '6th Cross Rd, Defence Colony, Indiranagar, Bengaluru 560038',
      12.9760, 77.6440,
      'Type 2', 11.0, 140.00,
      'Dedicated metered EV line. Covered parking with security camera.',
      'dedicated_ev', true, true
    ),
    (
      v_charger4_id, v_host2_id,
      'Double Road Commercial AC',
      'Commercial Complex, Old Airport Rd, Indiranagar, Bengaluru 560008',
      12.9635, 77.6480,
      'Bharat AC-001', 3.3, 80.00,
      'Economical slow charger, ideal for 2-wheelers and fleet EVs.',
      'commercial', true, true
    ),
    (
      v_charger5_id, v_host1_id,
      'CMH Road DC Fast Station (Under Maintenance)',
      'CMH Road, Indiranagar, Bengaluru 560038',
      12.9782, 77.6390,
      'CCS2', 30.0, 220.00,
      'Currently inactive for firmware calibration.',
      'commercial', false, true
    );

  -- 5. Seed Weekly Availability Windows (Days 0=Sun to 6=Sat)
  -- Charger 1 (100ft Rd): Available Monday to Saturday from 08:00 to 22:00
  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger1_id, day, '08:00'::time, '22:00'::time
  FROM generate_series(1, 6) AS day;

  -- Charger 2 (Residential): Available Everyday from 07:00 to 23:00
  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger2_id, day, '07:00'::time, '23:00'::time
  FROM generate_series(0, 6) AS day;

  -- Charger 3 (Defence Colony): Available Everyday, split into morning and evening windows
  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger3_id, day, '06:00'::time, '12:00'::time
  FROM generate_series(0, 6) AS day;

  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger3_id, day, '16:00'::time, '22:00'::time
  FROM generate_series(0, 6) AS day;

  -- Charger 4 (Double Road): Available Monday to Friday from 09:00 to 18:00
  INSERT INTO public.availability_windows (charger_id, day_of_week, start_time, end_time)
  SELECT v_charger4_id, day, '09:00'::time, '18:00'::time
  FROM generate_series(1, 5) AS day;

  -- 6. Seed Test Bookings for Conflict & Overlap Testing (on Charger 1)
  -- A. Confirmed booking for Driver 1: Tomorrow 10:00 to 11:30 UTC
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost, decided_at
  ) VALUES (
    v_charger1_id, v_driver1_id,
    (v_tomorrow || ' 10:00:00+00')::timestamptz,
    (v_tomorrow || ' 11:30:00+00')::timestamptz,
    'confirmed', 270.00, now()
  );

  -- B. Back-to-back Confirmed booking for Driver 2: Tomorrow 11:30 to 13:00 UTC
  -- Verifies back-to-back scheduling works without exclusion conflict
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost, decided_at
  ) VALUES (
    v_charger1_id, v_driver2_id,
    (v_tomorrow || ' 11:30:00+00')::timestamptz,
    (v_tomorrow || ' 13:00:00+00')::timestamptz,
    'confirmed', 270.00, now()
  );

  -- C. Pending Requested booking for Driver 2: Tomorrow 10:30 to 12:00 UTC
  -- Overlaps with confirmed booking A (10:00-11:30); used to test approval auto-decline
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost
  ) VALUES (
    v_charger1_id, v_driver2_id,
    (v_tomorrow || ' 10:30:00+00')::timestamptz,
    (v_tomorrow || ' 12:00:00+00')::timestamptz,
    'requested', 270.00
  );

  -- D. Pending Requested non-conflicting booking: Tomorrow 14:00 to 16:00 UTC
  INSERT INTO public.bookings (
    charger_id, driver_id, start_at, end_at, status, total_cost
  ) VALUES (
    v_charger1_id, v_driver1_id,
    (v_tomorrow || ' 14:00:00+00')::timestamptz,
    (v_tomorrow || ' 16:00:00+00')::timestamptz,
    'requested', 360.00
  );

  RAISE NOTICE 'PlugNear seed data populated successfully!';
END $$;
