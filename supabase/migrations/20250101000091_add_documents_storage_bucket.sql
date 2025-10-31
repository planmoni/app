/*
  # Documents Storage Setup

  1. Storage
    - Creates a new storage bucket for user documents (utility bills, etc.)
  2. Security
    - Sets up RLS policies for the storage bucket
    - Users can only access their own documents
*/

-- Create a storage bucket for documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage bucket
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Create policy to allow authenticated users to upload files to their own folder
CREATE POLICY "Allow authenticated users to upload documents to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to view their own documents
CREATE POLICY "Allow authenticated users to view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to update their own documents
CREATE POLICY "Allow authenticated users to update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to delete their own documents
CREATE POLICY "Allow authenticated users to delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
