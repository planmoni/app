/*
  # Create Paystack Accounts Table
  
  1. New Tables
    - paystack_accounts
      - id (uuid, primary key)
      - user_id (uuid, references profiles)
      - customer_code (text) - Paystack customer code
      - account_number (text) - Virtual account number
      - account_name (text) - Account holder name
      - bank_name (text) - Bank name
      - accountId (text) - Paystack account ID
      - is_active (boolean) - Whether account is active
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create paystack_accounts table
CREATE TABLE IF NOT EXISTS paystack_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  customer_code text NOT NULL,
  account_number text,
  account_name text,
  bank_name text,
  accountId text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE paystack_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own paystack accounts"
  ON paystack_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paystack accounts"
  ON paystack_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paystack accounts"
  ON paystack_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paystack accounts"
  ON paystack_accounts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_paystack_accounts_user_id ON paystack_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_paystack_accounts_account_number ON paystack_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_paystack_accounts_customer_code ON paystack_accounts(customer_code);

-- Add trigger to update updated_at
CREATE TRIGGER update_paystack_accounts_updated_at
  BEFORE UPDATE ON paystack_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add unique constraints
ALTER TABLE paystack_accounts ADD CONSTRAINT paystack_accounts_user_id_key UNIQUE (user_id);
ALTER TABLE paystack_accounts ADD CONSTRAINT paystack_accounts_customer_code_key UNIQUE (customer_code);
ALTER TABLE paystack_accounts ADD CONSTRAINT paystack_accounts_account_number_key UNIQUE (account_number); 