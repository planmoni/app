/*
  # Banner Storage Setup

  1. New Tables
    - No new tables are created in this migration
  2. Storage
    - Creates a new storage bucket for banner images
  3. Security
    - Sets up RLS policies for the storage bucket
*/

-- Create a storage bucket for banner images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage bucket
UPDATE storage.buckets SET public = true WHERE id = 'banners';

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

-- Create policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners' AND (auth.uid() = owner));

-- Create policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners' AND (auth.uid() = owner));

-- Create policy to allow public read access to banner files
CREATE POLICY "Allow public read access to banner files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners');