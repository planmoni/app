/*
  # Create Webhook Delivery System
  
  This migration creates tables for tracking webhook deliveries with
  retry logic and delivery status.
  
  1. New Tables
    - webhook_deliveries - Track webhook delivery attempts
    - webhook_configurations - Partner webhook configurations
*/

-- Create webhook_configurations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_configurations') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE webhook_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL UNIQUE,
        url text NOT NULL,
        secret text,
        events text[] NOT NULL,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    ELSE
      CREATE TABLE webhook_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL UNIQUE,
        url text NOT NULL,
        secret text,
        events text[] NOT NULL,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'webhook_configurations' 
      AND constraint_name = 'webhook_configurations_partner_id_fkey'
    ) THEN
      ALTER TABLE webhook_configurations 
      ADD CONSTRAINT webhook_configurations_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create webhook_deliveries table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_deliveries') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
        webhook_config_id uuid REFERENCES webhook_configurations(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        event_data jsonb NOT NULL,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
        attempt_count integer DEFAULT 0,
        max_attempts integer DEFAULT 5,
        next_retry_at timestamptz,
        delivered_at timestamptz,
        response_status integer,
        response_body text,
        error_message text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    ELSE
      CREATE TABLE webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL,
        webhook_config_id uuid REFERENCES webhook_configurations(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        event_data jsonb NOT NULL,
        status text DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
        attempt_count integer DEFAULT 0,
        max_attempts integer DEFAULT 5,
        next_retry_at timestamptz,
        delivered_at timestamptz,
        response_status integer,
        response_body text,
        error_message text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'webhook_deliveries' 
      AND constraint_name = 'webhook_deliveries_partner_id_fkey'
    ) THEN
      ALTER TABLE webhook_deliveries 
      ADD CONSTRAINT webhook_deliveries_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_partner ON webhook_configurations(partner_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_active ON webhook_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_partner ON webhook_deliveries(partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id);

-- Enable Row Level Security
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webhook_configurations' 
    AND policyname = 'Service role can manage all webhook configurations'
  ) THEN
    CREATE POLICY "Service role can manage all webhook configurations"
      ON webhook_configurations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webhook_configurations' 
    AND policyname = 'Partners can view own webhook configurations'
  ) THEN
    CREATE POLICY "Partners can view own webhook configurations"
      ON webhook_configurations
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS Policies for webhook_deliveries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webhook_deliveries' 
    AND policyname = 'Service role can manage all webhook deliveries'
  ) THEN
    CREATE POLICY "Service role can manage all webhook deliveries"
      ON webhook_deliveries
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webhook_deliveries' 
    AND policyname = 'Partners can view own webhook deliveries'
  ) THEN
    CREATE POLICY "Partners can view own webhook deliveries"
      ON webhook_deliveries
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_webhook_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_webhook_configurations_updated_at'
  ) THEN
    CREATE TRIGGER update_webhook_configurations_updated_at
      BEFORE UPDATE ON webhook_configurations
      FOR EACH ROW
      EXECUTE FUNCTION update_webhook_configurations_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_webhook_deliveries_updated_at'
  ) THEN
    CREATE TRIGGER update_webhook_deliveries_updated_at
      BEFORE UPDATE ON webhook_deliveries
      FOR EACH ROW
      EXECUTE FUNCTION update_webhook_deliveries_updated_at();
  END IF;
END $$;
