/*
  # Create get_due_payout_plans function
  
  This migration creates the get_due_payout_plans function that returns
  all payout plans that are due for processing.
  
  The function returns payout plans with their essential information,
  casting next_payout_date to date as expected by the function signature.
*/

-- Drop all existing versions of the function to avoid overloading conflicts
-- Dynamically drop all overloaded versions
DO $$ 
DECLARE
  func_record record;
BEGIN
  -- Loop through all versions of the function and drop them
  FOR func_record IN 
    SELECT oid::regprocedure as func_sig
    FROM pg_proc 
    WHERE proname = 'get_due_payout_plans'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_sig || ' CASCADE';
  END LOOP;
END $$;

-- Create the function with correct return types
-- Column 6 (next_payout_date) must be date, not timestamptz
CREATE OR REPLACE FUNCTION get_due_payout_plans()
RETURNS TABLE(
  plan_id uuid,
  user_id uuid,
  name text,
  payout_amount numeric,
  payout_account_id uuid,
  next_payout_date date
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id::uuid as plan_id,
    pp.user_id::uuid,
    pp.name::text,
    pp.payout_amount::numeric,
    COALESCE(pp.payout_account_id, pp.bank_account_id)::uuid as payout_account_id,
    (pp.next_payout_date AT TIME ZONE 'UTC')::date as next_payout_date
  FROM payout_plans pp
  WHERE pp.status = 'active'
    AND pp.next_payout_date IS NOT NULL
    AND (pp.next_payout_date AT TIME ZONE 'UTC')::date <= CURRENT_DATE
    AND (pp.payout_account_id IS NOT NULL OR pp.bank_account_id IS NOT NULL)
  ORDER BY pp.next_payout_date ASC;
END;
$$;

