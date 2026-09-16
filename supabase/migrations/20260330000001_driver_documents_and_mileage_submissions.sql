-- Driver Portal: Documents & Self-Service Mileage Submissions Migration
-- Target: Shared Supabase Database (servicevch / virtualcarhire)

-- 1. Create `driver_documents` Table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  file_path text NOT NULL,
  document_type text DEFAULT 'other',
  label text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index on driver_id for fast document retrieval
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON public.driver_documents (driver_id);

-- 2. Create `mileage_submissions` Table
CREATE TABLE IF NOT EXISTS public.mileage_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  image_path text NOT NULL,
  reading_value numeric NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz DEFAULT now()
);

-- Index on driver_id and status
CREATE INDEX IF NOT EXISTS idx_mileage_submissions_driver_id ON public.mileage_submissions (driver_id);
CREATE INDEX IF NOT EXISTS idx_mileage_submissions_status ON public.mileage_submissions (status);

-- 3. Enable RLS
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_submissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for `driver_documents`
DROP POLICY IF EXISTS "Drivers can view own driver_documents" ON public.driver_documents;
CREATE POLICY "Drivers can view own driver_documents"
  ON public.driver_documents
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 5. RLS Policies for `mileage_submissions`
DROP POLICY IF EXISTS "Drivers can view own mileage_submissions" ON public.mileage_submissions;
CREATE POLICY "Drivers can view own mileage_submissions"
  ON public.mileage_submissions
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can insert own mileage_submissions" ON public.mileage_submissions;
CREATE POLICY "Drivers can insert own mileage_submissions"
  ON public.mileage_submissions
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.driver_tracks WHERE auth_user_id = auth.uid()
      UNION
      SELECT id FROM public.drivers WHERE auth_user_id = auth.uid()
    )
  );

-- 6. Storage Buckets Configuration for `driver-documents` and `mileage-photos`
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('driver-documents', 'driver-documents', true),
  ('mileage-photos', 'mileage-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies
DROP POLICY IF EXISTS "Authenticated drivers can read driver documents storage" ON storage.objects;
CREATE POLICY "Authenticated drivers can read driver documents storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'driver-documents' OR bucket_id = 'mileage-photos');

DROP POLICY IF EXISTS "Authenticated drivers can upload mileage photos storage" ON storage.objects;
CREATE POLICY "Authenticated drivers can upload mileage photos storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'mileage-photos');
