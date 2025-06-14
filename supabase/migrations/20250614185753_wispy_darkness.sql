/*
  # Create Payment Methods Table
  
  1. New Tables
    - `payment_methods`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text) - 'card', 'bank', etc.
      - `provider` (text) - 'paystack', 'flutterwave', etc.
      - `token` (text) - The tokenized payment method
      - `last_four` (text) - Last 4 digits of card or account
      - `exp_month` (text) - Expiration month for cards
      - `exp_year` (text) - Expiration year for cards
      - `card_type` (text) - Visa, Mastercard, etc.
      - `bank` (text) - Issuing bank name
      - `is_default` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'bank', 'ussd')),
  provider text NOT NULL,
  token text NOT NULL,
  last_four text,
  exp_month text,
  exp_year text,
  card_type text,
  bank text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
  ON payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON payment_methods
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON payment_methods
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default ON payment_methods(user_id, is_default);

-- Add trigger to update updated_at
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to set default payment method
CREATE OR REPLACE FUNCTION set_default_payment_method(p_method_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate that the payment method belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM payment_methods
    WHERE id = p_method_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Payment method not found or does not belong to user';
  END IF;

  -- Remove default from all payment methods for this user
  UPDATE payment_methods
  SET is_default = false
  WHERE user_id = p_user_id;

  -- Set the selected payment method as default
  UPDATE payment_methods
  SET 
    is_default = true,
    updated_at = now()
  WHERE id = p_method_id;
END;
$$;