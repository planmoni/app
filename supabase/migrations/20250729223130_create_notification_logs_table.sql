/*
  # Create Notification Logs Table

  This migration creates a table to log all push notification sending attempts
  for monitoring and analytics purposes.

  ## Changes:
  - Create notification_logs table
  - Add indexes for efficient querying
  - Enable RLS for security

  ## Security:
  - Only service role can access notification logs
  - Administrators can view logs through secure endpoints
*/

-- Create notification logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  total_recipients integer NOT NULL DEFAULT 0,
  successful_sends integer NOT NULL DEFAULT 0,
  failed_sends integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy - only service role can access
CREATE POLICY "Service role can manage notification logs"
  ON notification_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE notification_logs IS 'Logs of all push notification sending attempts';
COMMENT ON COLUMN notification_logs.notification_type IS 'Type of notification sent (payout_ready, deposit_received, etc.)';
COMMENT ON COLUMN notification_logs.total_recipients IS 'Total number of users the notification was intended for';
COMMENT ON COLUMN notification_logs.successful_sends IS 'Number of notifications successfully sent';
COMMENT ON COLUMN notification_logs.failed_sends IS 'Number of notifications that failed to send';

-- Create a function to get notification analytics (for admin dashboard)
CREATE OR REPLACE FUNCTION get_notification_analytics(
  start_date timestamptz DEFAULT now() - interval '30 days',
  end_date timestamptz DEFAULT now()
)
RETURNS TABLE(
  notification_type text,
  total_sent integer,
  success_rate numeric,
  total_recipients integer
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow service role to call this function
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied. This function can only be called by service role.';
  END IF;

  RETURN QUERY
  SELECT 
    nl.notification_type,
    SUM(nl.successful_sends)::integer as total_sent,
    CASE 
      WHEN SUM(nl.total_recipients) > 0 
      THEN ROUND((SUM(nl.successful_sends)::numeric / SUM(nl.total_recipients)::numeric) * 100, 2)
      ELSE 0
    END as success_rate,
    SUM(nl.total_recipients)::integer as total_recipients
  FROM notification_logs nl
  WHERE nl.sent_at BETWEEN start_date AND end_date
  GROUP BY nl.notification_type
  ORDER BY total_sent DESC;
END;
$$ LANGUAGE plpgsql;
