/*
  # Fix Duplicate calculate_next_payout_date Function
  
  1. Problem
    - Multiple definitions of calculate_next_payout_date function exist
    - PostgreSQL can't choose between overloaded versions
    - Function signature conflict with 3 vs 4 parameters
  
  2. Solution
    - Drop all existing versions with comprehensive cleanup
    - Create single canonical version with proper signature
    - Ensure no ambiguity in function calls
*/

-- Comprehensive cleanup: Drop all possible versions of the function
-- This includes checking multiple schemas and parameter combinations
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, integer);
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, integer, integer);
DROP FUNCTION IF EXISTS public.calculate_next_payout_date(date, text, integer);
DROP FUNCTION IF EXISTS public.calculate_next_payout_date(date, text, integer, integer);

-- Also drop any potential variations with different parameter types
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, bigint);
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, varchar, integer);
DROP FUNCTION IF EXISTS calculate_next_payout_date(timestamp, text, integer);

-- Create the canonical version with 3 parameters (the one currently being used)
CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer
)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_frequency
    WHEN 'weekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN p_start_date;
  END CASE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_next_payout_date TO authenticated, service_role;
