/*
  # Create banners table and policies

  1. New Tables
    - `banners` - Stores banner information for the app carousel
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `description` (text, nullable)
      - `image_url` (text, not null)
      - `cta_text` (text, nullable)
      - `link_url` (text, nullable)
      - `order_index` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `banners` table
    - Add policy for admins to manage banners
    - Add policy for public users to read banners
  
  3. Sample Data
    - Insert 3 sample banners
*/

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