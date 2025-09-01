/*
  # Emergency Fix for Function Conflict
  
  This migration performs an aggressive cleanup of all possible variations
  of the calculate_next_payout_date function to resolve the ambiguity error.
*/

-- First, get a list of all functions with this name to understand what exists
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Log all existing function signatures for debugging
    FOR func_record IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as function_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'calculate_next_payout_date'
    LOOP
        RAISE NOTICE 'Found function: %.%(%) ', func_record.schema_name, func_record.function_name, func_record.function_args;
    END LOOP;
END $$;

-- Drop ALL possible variations of the function (aggressive approach)
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_next_payout_date(date, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_next_payout_date(date, text, integer, integer) CASCADE;

-- Also try variations with different type names
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, varchar, integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, character varying, integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_next_payout_date(timestamp, text, integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_next_payout_date(date, text, bigint) CASCADE;

-- Drop by OID if necessary (find and drop all instances)
DO $$
DECLARE
    func_oid oid;
BEGIN
    FOR func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'calculate_next_payout_date'
    LOOP
        EXECUTE format('DROP FUNCTION %s CASCADE', func_oid::regprocedure);
        RAISE NOTICE 'Dropped function with OID: %', func_oid;
    END LOOP;
END $$;

-- Now create the canonical version
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

-- Verify the function is unique now
DO $$
DECLARE
    func_count integer;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'calculate_next_payout_date';
    
    RAISE NOTICE 'Number of calculate_next_payout_date functions after cleanup: %', func_count;
    
    IF func_count != 1 THEN
        RAISE EXCEPTION 'Expected exactly 1 function, found %', func_count;
    END IF;
END $$;
