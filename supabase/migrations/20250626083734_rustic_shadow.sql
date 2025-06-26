/*
  # Fix send_otp_email function overload conflict

  1. Database Changes
    - Drop the conflicting send_otp_email function that takes both p_email and p_otp parameters
    - This resolves the function overloading issue that prevents Supabase from choosing the correct function
    - The verify_otp function should be used for OTP verification instead

  2. Security
    - No changes to RLS policies needed
    - Maintains existing function permissions
*/

-- Drop the conflicting send_otp_email function that takes both p_email and p_otp
-- This function is redundant since we have a separate verify_otp function for verification
DROP FUNCTION IF EXISTS send_otp_email(p_email text, p_otp text);

-- Ensure we still have the correct send_otp_email function that only takes p_email
-- This should already exist, but we'll verify its signature is correct
-- The function should only take p_email parameter for sending OTP emails