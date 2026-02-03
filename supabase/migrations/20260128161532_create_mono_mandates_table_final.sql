CREATE TABLE IF NOT EXISTS mono_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  mono_account_id text NOT NULL,
  mono_mandate_id text UNIQUE,
  mono_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'failed')),
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  bank_code text,
  mandate_type text,
  max_amount numeric,
  expiry_date timestamptz,
  authorized_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  mono_webhook_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_active_mandate_per_account UNIQUE NULLS NOT DISTINCT (bank_account_id, status) 
    WHERE status = 'active'
);

ALTER TABLE mono_mandates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own mandates" ON mono_mandates FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own mandates" ON mono_mandates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own mandates" ON mono_mandates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mono_mandates_user_id ON mono_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_mono_mandates_bank_account_id ON mono_mandates(bank_account_id);
