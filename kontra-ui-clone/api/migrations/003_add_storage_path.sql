-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor

-- 1. Add storage_path column to deal_analyses (safe to re-run)
ALTER TABLE deal_analyses
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 2. Create the storage bucket (safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-documents',
  'deal-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policy — drop first to avoid duplicate error, then recreate
DROP POLICY IF EXISTS "Service role can manage deal documents" ON storage.objects;

CREATE POLICY "Service role can manage deal documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'deal-documents');
