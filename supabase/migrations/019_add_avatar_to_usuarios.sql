-- Migration 019: Add avatar_url to usuarios table
-- This allows users to have a profile picture separate from CNH

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Policy to allow users to update their own avatar (already covered by generic update policy, but good to double check storage policies)
-- The storage bucket 'avatars' needs to create if it doesn't exist
-- We can't easily create buckets via SQL in all Supabase versions, but we can try inserting into storage.buckets if permissions allow.
-- For now, we assume the bucket 'cnh-uploads' exists. We should create an 'avatars' bucket or use a folder in existing.
-- Let's use a new public bucket 'avatars'.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for 'avatars' bucket
CREATE POLICY "Avatar Public Access"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'avatars' );

CREATE POLICY "Avatar Upload User"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Avatar Update User"
    ON storage.objects FOR UPDATE
    USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
