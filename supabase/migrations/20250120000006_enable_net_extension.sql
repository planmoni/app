/*
  # Enable net extension for HTTP calls
  
  This migration enables the net extension which allows PostgreSQL functions
  to make HTTP calls via net.http_post(). This is required for the database
  trigger to immediately call the send-push-notifications edge function.
*/

-- Enable the net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS net;

-- Verify extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'net'
  ) THEN
    RAISE EXCEPTION 'Failed to enable net extension';
  END IF;
END $$;

COMMENT ON EXTENSION net IS 'Enables HTTP calls from PostgreSQL functions via net.http_post()';

