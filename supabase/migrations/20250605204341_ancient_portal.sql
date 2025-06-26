/*
  # User Profile and Wallet Setup
  
  1. Add unique constraint for wallet user_id
  2. Insert user profile
  3. Create initial wallet for user
*/

-- First, add unique constraint to wallets table for user_id
ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);

-- Insert or update user profile
INSERT INTO profiles (id, first_name, last_name, email, created_at, updated_at)
VALUES (
  'a07e7c4d-f48c-4a9d-969e-f00064280cad',
  'John',
  'Doe',
  'john.doe@example.com',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET 
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  updated_at = now();

-- Create initial wallet for the user if it doesn't exist
INSERT INTO wallets (id, user_id, balance, locked_balance, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'a07e7c4d-f48c-4a9d-969e-f00064280cad',
  0,
  0,
  now(),
  now()
)
ON CONFLICT (user_id) DO NOTHING;