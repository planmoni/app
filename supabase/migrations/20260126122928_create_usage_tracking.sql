/*
  # Create API Usage Tracking
  
  This migration creates tables for tracking API usage per partner
  for rate limiting and analytics.
  
  1. New Tables
    - api_usage_logs - Track all API calls
    - partner_rate_limits - Partner-specific rate limit configuration
*/

-- Create api_usage_logs table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE api_usage_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
        endpoint text NOT NULL,
        method text NOT NULL,
        status_code integer,
        response_time_ms integer,
        request_size_bytes integer,
        response_size_bytes integer,
        user_agent text,
        ip_address text,
        created_at timestamptz DEFAULT now()
      );
    ELSE
      CREATE TABLE api_usage_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid,
        endpoint text NOT NULL,
        method text NOT NULL,
        status_code integer,
        response_time_ms integer,
        request_size_bytes integer,
        response_size_bytes integer,
        user_agent text,
        ip_address text,
        created_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'api_usage_logs' 
      AND constraint_name = 'api_usage_logs_partner_id_fkey'
    ) THEN
      ALTER TABLE api_usage_logs 
      ADD CONSTRAINT api_usage_logs_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create partner_rate_limits table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_rate_limits') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
      CREATE TABLE partner_rate_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL UNIQUE,
        requests_per_hour integer DEFAULT 1000,
        requests_per_minute integer DEFAULT 100,
        requests_per_second integer DEFAULT 10,
        burst_limit integer DEFAULT 20,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    ELSE
      CREATE TABLE partner_rate_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL UNIQUE,
        requests_per_hour integer DEFAULT 1000,
        requests_per_minute integer DEFAULT 100,
        requests_per_second integer DEFAULT 10,
        burst_limit integer DEFAULT 20,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    END IF;
  END IF;
  
  -- Add foreign key constraint if partners table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'partner_rate_limits' 
      AND constraint_name = 'partner_rate_limits_partner_id_fkey'
    ) THEN
      ALTER TABLE partner_rate_limits 
      ADD CONSTRAINT partner_rate_limits_partner_id_fkey 
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_partner ON api_usage_logs(partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
-- Note: Removed time-based partial index with now() as it's not IMMUTABLE
-- The partner_id + created_at index above will efficiently support time-range queries

-- Enable Row Level Security
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_usage_logs' 
    AND policyname = 'Service role can manage all usage logs'
  ) THEN
    CREATE POLICY "Service role can manage all usage logs"
      ON api_usage_logs
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
    WHERE tablename = 'api_usage_logs' 
    AND policyname = 'Partners can view own usage logs'
  ) THEN
    CREATE POLICY "Partners can view own usage logs"
      ON api_usage_logs
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'partner_rate_limits' 
    AND policyname = 'Service role can manage all rate limits'
  ) THEN
    CREATE POLICY "Service role can manage all rate limits"
      ON partner_rate_limits
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
    WHERE tablename = 'partner_rate_limits' 
    AND policyname = 'Partners can view own rate limits'
  ) THEN
    CREATE POLICY "Partners can view own rate limits"
      ON partner_rate_limits
      FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_partner_id uuid,
  p_window_seconds integer DEFAULT 3600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate_limit partner_rate_limits%ROWTYPE;
  v_request_count integer;
  v_limit integer;
  v_result jsonb;
BEGIN
  -- Get rate limit configuration
  SELECT * INTO v_rate_limit
  FROM partner_rate_limits
  WHERE partner_id = p_partner_id;

  -- If no custom limit, use defaults based on subscription tier
  IF NOT FOUND THEN
    SELECT 
      CASE subscription_tier
        WHEN 'standard' THEN 1000
        WHEN 'premium' THEN 5000
        WHEN 'enterprise' THEN 50000
        ELSE 1000
      END INTO v_limit
    FROM partners
    WHERE id = p_partner_id;
  ELSE
    v_limit := v_rate_limit.requests_per_hour;
  END IF;

  -- Count requests in the window
  SELECT COUNT(*) INTO v_request_count
  FROM api_usage_logs
  WHERE partner_id = p_partner_id
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  -- Return result
  v_result := jsonb_build_object(
    'allowed', v_request_count < v_limit,
    'current', v_request_count,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_request_count),
    'reset_at', now() + (p_window_seconds || ' seconds')::interval
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(uuid, integer) TO service_role;
