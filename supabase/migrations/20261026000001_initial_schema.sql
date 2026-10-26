-- ============================================================================
-- PlugNear: Initial Schema Migration
-- Version: 20261026000001
-- Description: Core tables, enums, PostGIS spatial indexing, exclusion
--              constraints for conflict-free bookings, auto-profile trigger,
--              and Row Level Security (RLS) policies.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Custom Types & Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('driver', 'host');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE connector_type AS ENUM ('Type 2', 'CCS2', 'CHAdeMO', 'Bharat AC-001', 'Other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'requested',
    'confirmed',
    'declined',
    'cancelled',
    'expired',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE host_connection_type AS ENUM ('domestic', 'commercial', 'dedicated_ev');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role user_role NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to prevent role tampering after profile creation
CREATE OR REPLACE FUNCTION public.prevent_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'User role cannot be changed once created.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_role_update ON public.profiles;
CREATE TRIGGER tr_prevent_role_update
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_update();

-- Automatic profile creation on auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_name text;
  v_phone text;
BEGIN
  -- Extract metadata passed during sign up
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'driver'::user_role);
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, name, role, phone, created_at)
  VALUES (NEW.id, v_name, v_role, v_phone, now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Chargers Table
CREATE TABLE IF NOT EXISTS public.chargers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  address_text text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude double precision NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  location geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED,
  connector_type connector_type NOT NULL,
  power_kw numeric(6, 2) NOT NULL CHECK (power_kw > 0),
  price_per_hour numeric(10, 2) NOT NULL CHECK (price_per_hour >= 0),
  notes text,
  host_connection_type host_connection_type NOT NULL DEFAULT 'domestic',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chargers_host_id ON public.chargers(host_id);
CREATE INDEX IF NOT EXISTS idx_chargers_is_active ON public.chargers(is_active);
CREATE INDEX IF NOT EXISTS idx_chargers_location ON public.chargers USING GIST (location);

-- 5. Availability Windows Table
CREATE TABLE IF NOT EXISTS public.availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid NOT NULL REFERENCES public.chargers(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT check_window_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_charger_day ON public.availability_windows(charger_id, day_of_week);

-- Function and trigger to ensure availability windows on the same day never overlap
CREATE OR REPLACE FUNCTION public.check_availability_window_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.availability_windows
    WHERE charger_id = NEW.charger_id
      AND day_of_week = NEW.day_of_week
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (NEW.start_time < end_time AND NEW.end_time > start_time)
  ) THEN
    RAISE EXCEPTION 'Availability windows on the same day cannot overlap for charger %', NEW.charger_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_window_overlap ON public.availability_windows;
CREATE TRIGGER tr_check_window_overlap
  BEFORE INSERT OR UPDATE ON public.availability_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.check_availability_window_overlap();

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid NOT NULL REFERENCES public.chargers(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status booking_status NOT NULL DEFAULT 'requested',
  total_cost numeric(10, 2) NOT NULL CHECK (total_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT check_booking_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_charger_status ON public.bookings(charger_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON public.bookings(charger_id, start_at, end_at);

-- Database-level Exclusion Constraint:
-- Two confirmed bookings on the same charger can NEVER overlap.
-- Back-to-back bookings ([10:00, 11:00) and [11:00, 12:00)) are allowed due to half-open interval '[)'.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_confirmed_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_confirmed_bookings
  EXCLUDE USING gist (
    charger_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status = 'confirmed');

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Chargers Policies
DROP POLICY IF EXISTS "Active chargers are viewable by authenticated users" ON public.chargers;
CREATE POLICY "Active chargers are viewable by authenticated users"
  ON public.chargers FOR SELECT
  TO authenticated
  USING (is_active = true OR host_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can insert their own chargers" ON public.chargers;
CREATE POLICY "Hosts can insert their own chargers"
  ON public.chargers FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'host')
  );

DROP POLICY IF EXISTS "Hosts can update their own chargers" ON public.chargers;
CREATE POLICY "Hosts can update their own chargers"
  ON public.chargers FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can delete their own chargers" ON public.chargers;
CREATE POLICY "Hosts can delete their own chargers"
  ON public.chargers FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- Availability Windows Policies
DROP POLICY IF EXISTS "Availability windows are viewable by authenticated users" ON public.availability_windows;
CREATE POLICY "Availability windows are viewable by authenticated users"
  ON public.availability_windows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = availability_windows.charger_id
        AND (chargers.is_active = true OR chargers.host_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Hosts can manage availability windows for their chargers" ON public.availability_windows;
CREATE POLICY "Hosts can manage availability windows for their chargers"
  ON public.availability_windows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = availability_windows.charger_id
        AND chargers.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = availability_windows.charger_id
        AND chargers.host_id = auth.uid()
    )
  );

-- Bookings Policies
DROP POLICY IF EXISTS "Drivers see only their own bookings" ON public.bookings;
CREATE POLICY "Drivers see only their own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = bookings.charger_id
        AND chargers.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can insert booking requests" ON public.bookings;
CREATE POLICY "Drivers can insert booking requests"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver')
  );

DROP POLICY IF EXISTS "Drivers and Hosts can update their allowed booking states" ON public.bookings;
CREATE POLICY "Drivers and Hosts can update their allowed booking states"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = bookings.charger_id
        AND chargers.host_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chargers
      WHERE chargers.id = bookings.charger_id
        AND chargers.host_id = auth.uid()
    )
  );
