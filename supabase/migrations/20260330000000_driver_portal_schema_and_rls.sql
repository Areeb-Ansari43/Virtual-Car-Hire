-- Driver Portal Schema Modifications & Row Level Security (RLS) Migration
-- Target: Shared Supabase Database (servicevch / virtualcarhire)

-- 1. Schema Additions for `driver_tracks` and `drivers` tables
ALTER TABLE IF EXISTS public.driver_tracks
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.drivers
  ADD COLUMN IF NOT EXISTS email text UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes for fast lookup on invite_token and auth_user_id
CREATE INDEX IF NOT EXISTS idx_driver_tracks_invite_token ON public.driver_tracks (invite_token);
CREATE INDEX IF NOT EXISTS idx_driver_tracks_auth_user_id ON public.driver_tracks (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_invite_token ON public.drivers (invite_token);
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id ON public.drivers (auth_user_id);

-- 2. Enable RLS on Driver Portal Tables
ALTER TABLE IF EXISTS public.driver_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.driver_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for `driver_tracks` and `drivers`
-- Anonymous users can lookup unaccepted invites by invite_token (needed for portal signup before auth)
DROP POLICY IF EXISTS "Anon can validate driver_tracks invite token" ON public.driver_tracks;
CREATE POLICY "Anon can validate driver_tracks invite token"
  ON public.driver_tracks
  FOR SELECT
  TO anon, authenticated
  USING (
    invite_token IS NOT NULL
    AND (invite_status IS NULL OR invite_status != 'accepted')
    AND auth_user_id IS NULL
  );

DROP POLICY IF EXISTS "Anon can validate drivers invite token" ON public.drivers;
CREATE POLICY "Anon can validate drivers invite token"
  ON public.drivers
  FOR SELECT
  TO anon, authenticated
  USING (
    invite_token IS NOT NULL
    AND (invite_status IS NULL OR invite_status != 'accepted')
    AND auth_user_id IS NULL
  );

-- Logged in drivers can ONLY view their own driver profile row
DROP POLICY IF EXISTS "Drivers can view own driver_tracks profile" ON public.driver_tracks;
CREATE POLICY "Drivers can view own driver_tracks profile"
  ON public.driver_tracks
  FOR SELECT
  USING (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can view own driver profile" ON public.drivers;
CREATE POLICY "Drivers can view own driver profile"
  ON public.drivers
  FOR SELECT
  USING (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can update own driver_tracks profile" ON public.driver_tracks;
CREATE POLICY "Drivers can update own driver_tracks profile"
  ON public.driver_tracks
  FOR UPDATE
  USING (
    auth_user_id = auth.uid() OR (invite_token IS NOT NULL AND auth_user_id IS NULL)
  );

DROP POLICY IF EXISTS "Drivers can update own profile" ON public.drivers;
CREATE POLICY "Drivers can update own profile"
  ON public.drivers
  FOR UPDATE
  USING (
    auth_user_id = auth.uid() OR (invite_token IS NOT NULL AND auth_user_id IS NULL)
  );

-- 4. RPC Security Definer Functions for Invite Validation & Acceptance
-- Protects pending driver data from being enumerated by unauthenticated API calls
CREATE OR REPLACE FUNCTION public.validate_driver_invite(p_token text)
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
  SELECT dt.id, dt.email, dt.invite_status
  FROM public.driver_tracks dt
  WHERE (dt.invite_token = p_token OR dt.invite_token::text = p_token)
    AND (dt.invite_status IS NULL OR dt.invite_status != 'accepted')
    AND dt.auth_user_id IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT d.id, d.email, d.invite_status
    FROM public.drivers d
    WHERE (d.invite_token = p_token OR d.invite_token::text = p_token)
      AND (d.invite_status IS NULL OR d.invite_status != 'accepted')
      AND d.auth_user_id IS NULL;
  END IF;
END;
$$;

-- Overload for uuid parameter backward compatibility
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
  RETURN QUERY SELECT * FROM public.validate_driver_invite(p_token::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_driver_invite(
  p_token text,
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
  -- First try driver_tracks
  SELECT id INTO v_driver_id
  FROM public.driver_tracks
  WHERE (invite_token = p_token OR invite_token::text = p_token)
    AND (invite_status IS NULL OR invite_status != 'accepted');

  IF v_driver_id IS NOT NULL THEN
    UPDATE public.driver_tracks
    SET auth_user_id = p_auth_user_id,
        invite_status = 'accepted',
        email = COALESCE(p_email, email)
    WHERE id = v_driver_id;

    RETURN true;
  END IF;

  -- Fallback to drivers
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE (invite_token = p_token OR invite_token::text = p_token)
    AND (invite_status IS NULL OR invite_status != 'accepted');

  IF v_driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET auth_user_id = p_auth_user_id,
        invite_status = 'accepted',
        email = COALESCE(p_email, email)
    WHERE id = v_driver_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Overload for uuid parameter backward compatibility
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
BEGIN
  RETURN public.accept_driver_invite(p_token::text, p_auth_user_id, p_email);
END;
$$;

-- Grant execution permissions on RPC functions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_driver_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_driver_invite(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_driver_invite(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_driver_invite(uuid, uuid, text) TO anon, authenticated;

-- 5. RLS Policies for `rentals` and child tables
DROP POLICY IF EXISTS "Drivers can view own rentals" ON public.rentals;
CREATE POLICY "Drivers can view own rentals"
  ON public.rentals
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own driver_charges" ON public.driver_charges;
CREATE POLICY "Drivers can view own driver_charges"
  ON public.driver_charges
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own alerts" ON public.alerts;
CREATE POLICY "Drivers can view own alerts"
  ON public.alerts
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update own alerts" ON public.alerts;
CREATE POLICY "Drivers can update own alerts"
  ON public.alerts
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own notifications" ON public.notifications;
CREATE POLICY "Drivers can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update own notifications" ON public.notifications;
CREATE POLICY "Drivers can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own mileage logs" ON public.mileage_logs;
CREATE POLICY "Drivers can view own mileage logs"
  ON public.mileage_logs
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can insert own mileage logs" ON public.mileage_logs;
CREATE POLICY "Drivers can insert own mileage logs"
  ON public.mileage_logs
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own charges" ON public.charges;
CREATE POLICY "Drivers can view own charges"
  ON public.charges
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own maintenance" ON public.maintenance;
CREATE POLICY "Drivers can view own maintenance"
  ON public.maintenance
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own service bookings" ON public.service_bookings;
CREATE POLICY "Drivers can view own service bookings"
  ON public.service_bookings
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );
