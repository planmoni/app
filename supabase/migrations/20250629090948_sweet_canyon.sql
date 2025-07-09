-- This migration creates the 'banners' table, its RLS policies, and a trigger.
-- It includes checks to prevent errors if objects already exist.

-- Create banners table if it doesn't exist
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  cta_text text,
  link_url text,
  order_index integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Create trigger for updating the updated_at column
-- Use IF NOT EXISTS to avoid the "trigger already exists" error
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_banners_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_banners_updated_at
             BEFORE UPDATE ON banners
             FOR EACH ROW
             EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END
$$;

-- Create policies (using IF NOT EXISTS to be safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow admins to manage banners') THEN
    CREATE POLICY "Allow admins to manage banners"
      ON banners
      FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow public read access to banners') THEN
    CREATE POLICY "Allow public read access to banners"
      ON banners
      FOR SELECT
      TO public
      USING (true);
  END IF;
END
$$;

-- Insert sample banners (only if they don't exist)
INSERT INTO banners (title, description, image_url, cta_text, link_url, order_index, is_active)
SELECT 
  'As a freelancer, you don''t get paid every 30 days', 
  'But with Planmoni, it feels like you do.', 
  'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/banners//banner1.png', 
  'Learn more', 
  '/create-payout/amount', 
  0, 
  true
WHERE NOT EXISTS (
  SELECT 1 FROM banners 
  WHERE title = 'As a freelancer, you don''t get paid every 30 days'
);

INSERT INTO banners (title, description, image_url, cta_text, link_url, order_index, is_active)
SELECT 
  'Save for your future goals', 
  'Set up automated savings with Planmoni', 
  'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 
  'Start saving', 
  '/create-payout/amount', 
  1, 
  true
WHERE NOT EXISTS (
  SELECT 1 FROM banners 
  WHERE title = 'Save for your future goals'
);

INSERT INTO banners (title, description, image_url, cta_text, link_url, order_index, is_active)
SELECT 
  'Refer friends, earn rewards', 
  'Get ₦1,000 for each friend who joins', 
  'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 
  'Invite now', 
  '/referral', 
  2, 
  true
WHERE NOT EXISTS (
  SELECT 1 FROM banners 
  WHERE title = 'Refer friends, earn rewards'
);

/*
  # KYC Progress Tracking Table
  
  1. New Tables
    - `kyc_progress` - Tracks user's KYC completion progress
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `current_step` (text) - 'personal', 'bvn_verification', 'id_face_match', 'address_details', 'review'
      - `personal_info_completed` (boolean) - Whether personal info step is done
      - `bvn_verified` (boolean) - Whether BVN verification is completed
      - `documents_verified` (boolean) - Whether document verification is completed
      - `address_completed` (boolean) - Whether address details are completed
      - `overall_completed` (boolean) - Whether entire KYC is completed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create kyc_progress table
CREATE TABLE IF NOT EXISTS kyc_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_step text NOT NULL DEFAULT 'personal' CHECK (current_step IN ('personal', 'bvn_verification', 'id_face_match', 'address_details', 'review')),
  personal_info_completed boolean DEFAULT false,
  bvn_verified boolean DEFAULT false,
  documents_verified boolean DEFAULT false,
  address_completed boolean DEFAULT false,
  overall_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE kyc_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own kyc progress"
  ON kyc_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kyc progress"
  ON kyc_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kyc progress"
  ON kyc_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_kyc_progress_updated_at
  BEFORE UPDATE ON kyc_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_kyc_progress_user_id ON kyc_progress(user_id);

-- Create a function to get or create KYC progress for a user
CREATE OR REPLACE FUNCTION get_or_create_kyc_progress(user_uuid uuid)
RETURNS kyc_progress
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  progress_record kyc_progress;
BEGIN
  -- Try to get existing progress
  SELECT * INTO progress_record
  FROM kyc_progress
  WHERE user_id = user_uuid;
  
  -- If no progress exists, create one
  IF NOT FOUND THEN
    INSERT INTO kyc_progress (user_id, current_step)
    VALUES (user_uuid, 'personal')
    RETURNING * INTO progress_record;
  END IF;
  
  RETURN progress_record;
END;
$$;