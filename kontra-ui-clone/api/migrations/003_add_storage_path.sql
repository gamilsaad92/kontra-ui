-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor

-- 1. Add storage_path column to deal_analyses
ALTER TABLE deal_analyses
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 2. Create the storage bucket (run once — safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-documents',
  'deal-documents',
  false,
  52428800,  -- 50 MB per file
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

-- 3. Storage policy — service role full access (signed URLs for everyone else)
CREATE POLICY IF NOT EXISTS "Service role can manage deal documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'deal-documents');
