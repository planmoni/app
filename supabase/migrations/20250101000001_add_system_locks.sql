/*
  # Add system_locks table
  
  This table is used to prevent multiple simultaneous executions of edge functions
  and other background processes.
  
  1. New Tables
    - system_locks
      - lock_key (text, primary key)
      - expires_at (timestamptz)
      - created_at (timestamptz)
  
  2. Indexes
    - Index on expires_at for cleanup
*/

CREATE TABLE IF NOT EXISTS system_locks (
  lock_key text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_system_locks_expires_at ON system_locks(expires_at);

-- Create a function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM system_locks WHERE expires_at < now();
END;
$$;

-- Create a cron job to clean up expired locks every hour
SELECT cron.schedule(
  'cleanup-expired-locks',
  '0 * * * *', -- Every hour
  'SELECT cleanup_expired_locks();'
); 