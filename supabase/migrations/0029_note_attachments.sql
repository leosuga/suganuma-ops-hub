-- Migration 0029: Note attachments (Supabase Storage)
-- Run this in Supabase SQL Editor after deploy

-- 1. Create the bucket (idempotent via ON CONFLICT or pg_net if available)
-- Note: bucket creation via SQL may require pg_storage or admin privileges
-- Alternative: create via Supabase Dashboard > Storage > New bucket
-- Bucket name: note-attachments
-- Public: true
-- Allowed mime types: image/*, application/pdf, text/*

-- 2. Add attachments column to note table
alter table note add column if not exists attachments jsonb default '[]'::jsonb;

-- 3. Create a function to generate storage paths
-- Path format: note-attachments/{owner_id}/{note_id}/{filename}
-- This ensures RLS-friendly organization

-- 4. Storage RLS policies (run after bucket creation):
-- Policy: Allow authenticated users to upload to their own folder
-- CREATE POLICY "Users can upload own attachments" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Allow users to read their own attachments
-- CREATE POLICY "Users can read own attachments" ON storage.objects
-- FOR SELECT USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Allow users to delete their own attachments
-- CREATE POLICY "Users can delete own attachments" ON storage.objects
-- FOR DELETE USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
