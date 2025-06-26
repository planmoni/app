/*
  # Create transactions table
  
  1. New Tables
    - transactions
      - id (uuid)
      - user_id (uuid, references profiles)
      - type (text)
      - amount (numeric)
      - status (text)
      - source (text)
      - destination (text)
      - payout_plan_id (uuid, references payout_plans)
      - bank_account_id (uuid, references bank_accounts)
      - reference (text)
      - description (text)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'payout', 'withdrawal')),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  source text NOT NULL,
  destination text NOT NULL,
  payout_plan_id uuid REFERENCES payout_plans(id),
  bank_account_id uuid REFERENCES bank_accounts(id),
  reference text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);