-- Driver Portal Schema Modifications & Row Level Security (RLS) Migration
-- Target: Shared Supabase Database (servicevch / virtualcarhire)

-- 1. Schema Additions for `drivers` table
ALTER TABLE IF EXISTS public.drivers
  ADD COLUMN IF NOT EXISTS email text UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS invite_status text DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted')),
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookup on invite_token and auth_user_id
CREATE INDEX IF NOT EXISTS idx_drivers_invite_token ON public.drivers (invite_token);
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id ON public.drivers (auth_user_id);

-- 2. Enable RLS on Driver Portal Tables
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_bookings ENABLE ROW LEVEL SECURITY;

-- 3. Strict RLS Policies for `drivers`
-- Logged in drivers can ONLY view their own driver profile row
DROP POLICY IF EXISTS "Drivers can view own driver profile" ON public.drivers;
CREATE POLICY "Drivers can view own driver profile"
  ON public.drivers
  FOR SELECT
  USING (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can update own driver auth link on signup" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can update own profile" ON public.drivers;
CREATE POLICY "Drivers can update own profile"
  ON public.drivers
  FOR UPDATE
  USING (
    auth_user_id = auth.uid()
  );

-- 4. RPC Security Definer Functions for Invite Validation & Acceptance
-- Protects pending driver data from being enumerated by unauthenticated API calls
CREATE OR REPLACE FUNCTION public.validate_driver_invite(p_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  invite_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.email, d.invite_status
  FROM public.drivers d
  WHERE d.invite_token = p_token
    AND d.invite_status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_driver_invite(
  p_token uuid,
  p_auth_user_id uuid,
  p_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE invite_token = p_token
    AND invite_status = 'pending';

  IF v_driver_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.drivers
  SET auth_user_id = p_auth_user_id,
      invite_status = 'accepted',
      email = COALESCE(p_email, email)
  WHERE id = v_driver_id;

  RETURN true;
END;
$$;

-- Grant execution permissions on RPC functions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_driver_invite(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_driver_invite(uuid, uuid, text) TO anon, authenticated;

-- 5. RLS Policies for `rentals`
DROP POLICY IF EXISTS "Drivers can view own rentals" ON public.rentals;
CREATE POLICY "Drivers can view own rentals"
  ON public.rentals
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 6. RLS Policies for `mileage_logs`
DROP POLICY IF EXISTS "Drivers can view own mileage logs" ON public.mileage_logs;
CREATE POLICY "Drivers can view own mileage logs"
  ON public.mileage_logs
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can insert own mileage logs" ON public.mileage_logs;
CREATE POLICY "Drivers can insert own mileage logs"
  ON public.mileage_logs
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 7. RLS Policies for `charges`
DROP POLICY IF EXISTS "Drivers can view own charges" ON public.charges;
CREATE POLICY "Drivers can view own charges"
  ON public.charges
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 8. RLS Policies for `maintenance`
DROP POLICY IF EXISTS "Drivers can view own maintenance" ON public.maintenance;
CREATE POLICY "Drivers can view own maintenance"
  ON public.maintenance
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 9. RLS Policies for `service_bookings`
DROP POLICY IF EXISTS "Drivers can view own service bookings" ON public.service_bookings;
CREATE POLICY "Drivers can view own service bookings"
  ON public.service_bookings
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );
