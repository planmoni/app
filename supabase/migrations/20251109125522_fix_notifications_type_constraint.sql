/*
  # Create notifications table with correct type constraint
  
  1. New Tables
    - notifications
      - id (uuid)
      - user_id (uuid, references profiles)
      - title (text)
      - message (text)
      - type (text) - CHECK constraint: ('transaction', 'payout', 'security', 'marketing', 'system')
      - data (jsonb)
      - is_read (boolean)
      - read_at (timestamptz)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Drop existing constraint if it exists and has wrong values
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'notifications'::regclass 
    AND conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

-- Add the correct constraint with all allowed types
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('transaction', 'payout', 'security', 'marketing', 'system'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

