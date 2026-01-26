/*
  # Create Partners System for Platform-as-a-Service
  
  This migration creates the partner management infrastructure for Planmoni's PaaS offering.
  Partners are external businesses (healthcare, employers, schools, etc.) that integrate
  with Planmoni to provide controlled money access to their users.
  
  1. New Tables
    - partners - External businesses integrating with Planmoni
    - partner_api_keys - API key management per partner
    - partner_users - Mapping between partner's users and Planmoni users
    - partner_settings - Partner-specific configurations
  
  2. Security
    - Enable RLS on all tables
    - Add policies for partner access control
*/

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN (
    'healthcare', 'employer', 'cooperative', 'education', 
    'insurance', 'marketplace', 'fintech', 'other'
  )),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
  subscription_tier text DEFAULT 'standard' CHECK (subscription_tier IN ('standard', 'premium', 'enterprise')),
  api_key_hash text,
  api_key_prefix text,
  webhook_url text,
  webhook_secret text,
  settings jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create partner_api_keys table for managing multiple API keys per partner
CREATE TABLE IF NOT EXISTS partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Create partner_users table - Maps partner's external user IDs to Planmoni users
CREATE TABLE IF NOT EXISTS partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  external_user_id text NOT NULL, -- Partner's internal user ID
  wallet_id uuid REFERENCES wallets(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, external_user_id)
);

-- Create partner_settings table for partner-specific configurations
CREATE TABLE IF NOT EXISTS partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL UNIQUE,
  default_policy_id uuid,
  default_approval_workflow_id uuid,
  rate_limit_per_hour integer DEFAULT 1000,
  max_wallets_per_user integer,
  allowed_transaction_types text[] DEFAULT ARRAY['disbursement', 'withdrawal'],
  notification_preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_partner_api_keys_partner ON partner_api_keys(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_api_keys_active ON partner_api_keys(partner_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_partner_users_partner ON partner_users(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_external ON partner_users(partner_id, external_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_wallet ON partner_users(wallet_id) WHERE wallet_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners table
CREATE POLICY "Service role can manage all partners"
  ON partners
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view own details"
  ON partners
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for partner_api_keys table
CREATE POLICY "Service role can manage all API keys"
  ON partner_api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view own API keys"
  ON partner_api_keys
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for partner_users table
CREATE POLICY "Service role can manage all partner users"
  ON partner_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own partner user records"
  ON partner_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Partners can view their users"
  ON partner_users
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for partner_settings table
CREATE POLICY "Service role can manage all partner settings"
  ON partner_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view own settings"
  ON partner_settings
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for partners table
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();

-- Create trigger for partner_users table
CREATE TRIGGER update_partner_users_updated_at
  BEFORE UPDATE ON partner_users
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();

-- Create trigger for partner_settings table
CREATE TRIGGER update_partner_settings_updated_at
  BEFORE UPDATE ON partner_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();
