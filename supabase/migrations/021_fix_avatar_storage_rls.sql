-- Migration 021: Fix avatar storage RLS policies
-- Problem: policies used auth.role() = 'authenticated', but this app uses
-- custom auth (not Supabase Auth), so all requests arrive as 'anon'.
-- This matches the pattern used for cnh-uploads in migration 006.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Avatars" ON storage.objects;

-- Also drop any leftovers from migration 019
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload User" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update User" ON storage.objects;

-- Recreate with anon + authenticated access (matching cnh-uploads pattern)
CREATE POLICY "Permitir leitura avatars"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'avatars');

CREATE POLICY "Permitir upload avatars"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Permitir update avatars"
    ON storage.objects FOR UPDATE
    TO anon, authenticated
    USING (bucket_id = 'avatars');

CREATE POLICY "Permitir delete avatars"
    ON storage.objects FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'avatars');
