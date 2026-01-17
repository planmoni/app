/*
  # Create Mono Mandates Table
  
  This table stores DirectDebit mandates for recurring payments.
  
  CRITICAL: DirectDebit requires mandates - user authorizes once, then we can debit multiple times.
  
  1. New Table
    - mono_mandates
      - Stores mandate information
      - Tracks mandate status (pending, active, cancelled, expired)
      - Links to bank_accounts and users
      - Stores Mono mandate ID and reference
  
  2. Security
    - Enable RLS
    - Users can only view their own mandates
*/

CREATE TABLE IF NOT EXISTS mono_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  mono_account_id text NOT NULL, -- Mono account ID linked to this mandate
  mono_mandate_id text UNIQUE, -- Mono mandate ID (set after mandate creation)
  mono_reference text UNIQUE, -- Mono mandate reference (unique identifier)
  
  -- Mandate status lifecycle
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'failed')),
  
  -- Mandate details
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  bank_code text,
  
  -- Mandate metadata from Mono
  mandate_type text, -- e.g., 'recurring', 'one-time'
  max_amount numeric, -- Maximum amount allowed per debit (if specified)
  expiry_date timestamptz, -- Mandate expiry date (if applicable)
  
  -- Authorization details
  authorized_at timestamptz, -- When user authorized the mandate
  activated_at timestamptz, -- When mandate became active
  cancelled_at timestamptz, -- When mandate was cancelled
  
  -- Mono webhook data
  mono_webhook_data jsonb, -- Store webhook payloads for audit
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure one active mandate per bank account
  CONSTRAINT unique_active_mandate_per_account UNIQUE NULLS NOT DISTINCT (bank_account_id, status) 
    WHERE status = 'active'
);

-- Enable RLS
ALTER TABLE mono_mandates ENABLE ROW LEVEL SECURITY;

-- Users can view their own mandates
CREATE POLICY "Users can view own mandates"
  ON mono_mandates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own mandates
CREATE POLICY "Users can insert own mandates"
  ON mono_mandates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own mandates
CREATE POLICY "Users can update own mandates"
  ON mono_mandates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mono_mandates_user_id ON mono_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_mono_mandates_bank_account_id ON mono_mandates(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_mono_mandates_mono_mandate_id ON mono_mandates(mono_mandate_id) WHERE mono_mandate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mono_mandates_status ON mono_mandates(status);
CREATE INDEX IF NOT EXISTS idx_mono_mandates_active ON mono_mandates(user_id, status) WHERE status = 'active';

-- Add comment for documentation
COMMENT ON TABLE mono_mandates IS 'Stores Mono DirectDebit mandates for recurring payments';
COMMENT ON COLUMN mono_mandates.status IS 'Mandate status: pending (created, awaiting authorization), active (authorized and ready for debits), cancelled (user cancelled), expired (mandate expired), failed (authorization failed)';
COMMENT ON COLUMN mono_mandates.mono_mandate_id IS 'Mono mandate ID returned after mandate creation';
COMMENT ON COLUMN mono_mandates.mono_reference IS 'Unique reference for this mandate, used for debits';



