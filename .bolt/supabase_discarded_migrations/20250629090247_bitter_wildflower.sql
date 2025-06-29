/*
  # Create banners table

  1. New Tables
    - `banners`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `image_url` (text, required)
      - `cta_text` (text, optional)
      - `link_url` (text, optional)
      - `order_index` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
  2. Security
    - Enable RLS on `banners` table
    - Add policy for admins to manage banners
    - Add policy for public read access to banners
*/

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
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create policies
CREATE POLICY "Allow admins to manage banners"
  ON banners
  FOR ALL
  TO authenticated
  USING (is_admin());

CREATE POLICY "Allow public read access to banners"
  ON banners
  FOR SELECT
  TO public
  USING (true);

-- Insert some sample banners
INSERT INTO banners (title, description, image_url, cta_text, link_url, order_index, is_active)
VALUES 
  ('As a freelancer, you don''t get paid every 30 days', 'But with Planmoni, it feels like you do.', 'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/banners//banner1.png', 'Learn more', '/create-payout/amount', 0, true),
  ('Save for your future goals', 'Set up automated savings with Planmoni', 'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 'Start saving', '/create-payout/amount', 1, true),
  ('Refer friends, earn rewards', 'Get ₦1,000 for each friend who joins', 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 'Invite now', '/referral', 2, true);