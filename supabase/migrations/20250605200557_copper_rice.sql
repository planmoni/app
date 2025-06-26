/*
  # Create custom payout dates table
  
  1. New Tables
    - custom_payout_dates
      - id (uuid)
      - payout_plan_id (uuid, references payout_plans)
      - payout_date (date)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS custom_payout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid REFERENCES payout_plans(id) ON DELETE CASCADE NOT NULL,
  payout_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custom_payout_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom payout dates"
  ON custom_payout_dates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payout_plans
      WHERE payout_plans.id = custom_payout_dates.payout_plan_id
      AND payout_plans.user_id = auth.uid()
    )
  );