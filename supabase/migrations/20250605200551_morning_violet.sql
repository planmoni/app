/*
  # Create payout plans table
  
  1. New Tables
    - payout_plans
      - id (uuid)
      - user_id (uuid, references profiles)
      - name (text)
      - description (text)
      - total_amount (numeric)
      - payout_amount (numeric)
      - frequency (text)
      - duration (integer)
      - start_date (date)
      - bank_account_id (uuid, references bank_accounts)
      - status (text)
      - completed_payouts (integer)
      - next_payout_date (date)
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS payout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  payout_amount numeric NOT NULL CHECK (payout_amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  duration integer NOT NULL CHECK (duration > 0),
  start_date date NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  completed_payouts integer DEFAULT 0,
  next_payout_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payout_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payout plans"
  ON payout_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payout plans"
  ON payout_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payout plans"
  ON payout_plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);