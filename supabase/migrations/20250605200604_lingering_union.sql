/*
  # Create events table
  
  1. New Tables
    - events
      - id (uuid)
      - user_id (uuid, references profiles)
      - type (text)
      - title (text)
      - description (text)
      - status (text)
      - payout_plan_id (uuid, references payout_plans)
      - transaction_id (uuid, references transactions)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('payout_completed', 'payout_scheduled', 'vault_created', 'disbursement_failed', 'security_alert')),
  title text NOT NULL,
  description text,
  status text CHECK (status IN ('unread', 'read')),
  payout_plan_id uuid REFERENCES payout_plans(id),
  transaction_id uuid REFERENCES transactions(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);