/*
  # Create Emergency Withdrawal Options Table
  
  1. New Tables
    - emergency_withdrawal_options
      - id (uuid, primary key)
      - type (text) - instant, 24hrs, 72hrs
      - percentage (numeric) - 12%, 10%, 6% respectively
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users to read options
*/

-- Create emergency_withdrawal_options table
CREATE TABLE IF NOT EXISTS emergency_withdrawal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  percentage numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE emergency_withdrawal_options ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read options
CREATE POLICY "Authenticated users can view emergency withdrawal options"
  ON emergency_withdrawal_options
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert the default emergency withdrawal options
INSERT INTO emergency_withdrawal_options (type, percentage) VALUES
  ('instant', 12.00),
  ('24hrs', 10.00),
  ('72hrs', 6.00)
ON CONFLICT (type) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_emergency_withdrawal_options_updated_at
  BEFORE UPDATE ON emergency_withdrawal_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
