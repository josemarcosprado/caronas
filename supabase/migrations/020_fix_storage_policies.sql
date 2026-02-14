-- Fix storage policies for avatars bucket
-- Drop existing policies to avoid conflicts and ensure clean slate
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Avatars" ON storage.objects;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 1. Public Read Access (Anyone can view avatars)
CREATE POLICY "Public Read Avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 2. Authenticated Upload (Insert - Auth users can upload)
CREATE POLICY "Auth Upload Avatars"
ON storage.objects FOR INSERT
WITH CHECK ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated' 
);

-- 3. Owner Update (Users can update their own files)
-- We check if the user is authenticated AND matches the owner ID (usually set on insert)
CREATE POLICY "Auth Update Avatars"
ON storage.objects FOR UPDATE
USING ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (auth.uid() = owner) 
);

-- 4. Owner Delete (Users can delete their own files - useful for cleanup or replacements)
CREATE POLICY "Auth Delete Avatars"
ON storage.objects FOR DELETE
USING ( 
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (auth.uid() = owner) 
);
