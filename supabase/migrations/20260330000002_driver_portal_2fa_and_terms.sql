-- Driver Portal 2FA Codes & Terms Acceptance Migration
-- Target: Shared Supabase Database (servicevch / virtualcarhire)

-- 1. Add Terms Acceptance columns to driver_tracks and drivers
ALTER TABLE IF EXISTS public.driver_tracks
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

ALTER TABLE IF EXISTS public.drivers
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- 2. Create Table for 2FA Verification Codes
CREATE TABLE IF NOT EXISTS public.portal_2fa_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on portal_2fa_codes
ALTER TABLE IF EXISTS public.portal_2fa_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_portal_2fa_codes_email ON public.portal_2fa_codes (email);
CREATE INDEX IF NOT EXISTS idx_portal_2fa_codes_user_id ON public.portal_2fa_codes (user_id);

-- Secure RLS: Deny direct table SELECT queries to anon and authenticated roles.
-- Access is strictly controlled via SECURITY DEFINER RPC functions below.
DROP POLICY IF EXISTS "Users can view own 2FA codes" ON public.portal_2fa_codes;

-- 3. RPC Function to Store / Generate 2FA Code (Returns boolean, NOT plaintext code)
CREATE OR REPLACE FUNCTION public.create_2fa_code(
  p_email text,
  p_user_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_expires_in_minutes int DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_expires_at timestamptz;
BEGIN
  IF p_code IS NULL OR length(p_code) = 0 THEN
    v_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  ELSE
    v_code := p_code;
  END IF;

  v_expires_at := now() + (p_expires_in_minutes || ' minutes')::interval;

  -- Invalidate previous unused codes for this email
  UPDATE public.portal_2fa_codes
  SET used = true
  WHERE lower(email) = lower(p_email) AND used = false;

  -- Insert new active code
  INSERT INTO public.portal_2fa_codes (user_id, email, code, expires_at, used)
  VALUES (p_user_id, lower(p_email), v_code, v_expires_at, false);

  RETURN true;
END;
$$;

-- 4. RPC Function to Verify 2FA Code
CREATE OR REPLACE FUNCTION public.verify_2fa_code(
  p_email text,
  p_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.portal_2fa_codes
  WHERE lower(email) = lower(p_email)
    AND code = p_code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.portal_2fa_codes
    SET used = true
    WHERE id = v_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 5. RPC Function to Record Driver Terms Acceptance
CREATE OR REPLACE FUNCTION public.accept_driver_terms(
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  -- Update driver_tracks
  UPDATE public.driver_tracks
  SET terms_accepted_at = now(),
      terms_accepted = true
  WHERE (p_user_id IS NOT NULL AND (auth_user_id = p_user_id OR id = p_user_id))
     OR (p_email IS NOT NULL AND lower(email) = lower(p_email));

  IF FOUND THEN
    v_updated := true;
  END IF;

  -- Update drivers
  UPDATE public.drivers
  SET terms_accepted_at = now(),
      terms_accepted = true
  WHERE (p_user_id IS NOT NULL AND (auth_user_id = p_user_id OR id = p_user_id))
     OR (p_email IS NOT NULL AND lower(email) = lower(p_email));

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

-- 6. RPC Function to Check Driver Terms Acceptance Status
CREATE OR REPLACE FUNCTION public.check_driver_terms_accepted(
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepted boolean := false;
BEGIN
  -- Check driver_tracks
  SELECT (terms_accepted_at IS NOT NULL OR terms_accepted = true) INTO v_accepted
  FROM public.driver_tracks
  WHERE (p_user_id IS NOT NULL AND (auth_user_id = p_user_id OR id = p_user_id))
     OR (p_email IS NOT NULL AND lower(email) = lower(p_email))
  LIMIT 1;

  IF v_accepted IS TRUE THEN
    RETURN true;
  END IF;

  -- Check drivers
  SELECT (terms_accepted_at IS NOT NULL OR terms_accepted = true) INTO v_accepted
  FROM public.drivers
  WHERE (p_user_id IS NOT NULL AND (auth_user_id = p_user_id OR id = p_user_id))
     OR (p_email IS NOT NULL AND lower(email) = lower(p_email))
  LIMIT 1;

  RETURN COALESCE(v_accepted, false);
END;
$$;

-- Grant EXECUTE permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.create_2fa_code(text, uuid, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_2fa_code(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_driver_terms(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_driver_terms_accepted(uuid, text) TO anon, authenticated;
