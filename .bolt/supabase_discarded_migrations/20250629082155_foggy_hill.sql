/*
  # Banner Slides Schema

  1. New Tables
    - `banners`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, nullable)
      - `image_url` (text)
      - `cta_text` (text, nullable)
      - `link_url` (text, nullable)
      - `order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `banners` table
    - Add policy for public to read banners
*/

-- Create banners table
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  cta_text text,
  link_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read banners
CREATE POLICY "Allow public read access to banners" 
  ON banners 
  FOR SELECT 
  TO public 
  USING (true);

-- Create policy to allow authenticated users with admin role to manage banners
CREATE POLICY "Allow admins to manage banners" 
  ON banners 
  FOR ALL 
  TO authenticated 
  USING (is_admin());

-- Create trigger to update the updated_at column
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample banners
INSERT INTO banners (title, description, image_url, cta_text, link_url, order_index, is_active)
VALUES 
  ('As a freelancer, you don''t get paid every 30 days', 'But with Planmoni, it feels like you do.', 'https://images.pexels.com/photos/3760529/pexels-photo-3760529.jpeg', 'Learn more', '/learn-more', 1, true),
  ('Manage your finances better', 'Take control of your income with scheduled payouts', 'https://images.pexels.com/photos/6694543/pexels-photo-6694543.jpeg', 'Get started', '/create-payout', 2, true),
  ('Refer friends, earn rewards', 'Get ₦1,000 for every friend who joins Planmoni', 'https://images.pexels.com/photos/7821485/pexels-photo-7821485.jpeg', 'Invite now', '/referral', 3, true);