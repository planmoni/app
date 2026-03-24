/*
  # Fix Helper Functions for Weekly_Specific Support
  
  This migration updates the helper functions to handle weekly_specific frequency
  gracefully, even though they cannot fully support it without day_of_week parameter.
  
  Strategy:
  1. Add weekly_specific case with fallback to weekly calculation
  2. Add deprecation comments warning against direct use
  3. Add logging to track function calls during deprecation period
  4. Maintain backward compatibility
  5. Document that update_payout_plan_progress() is preferred
  
  This migration is idempotent and transactional.
*/

BEGIN;

-- Create optional monitoring table for deprecated function calls (if it doesn't exist)
-- This table helps track who is still calling deprecated functions
CREATE TABLE IF NOT EXISTS public.deprecated_function_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now(),
  parameters jsonb,
  caller_info text,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_deprecated_function_calls_function_name ON public.deprecated_function_calls(function_name, called_at);
CREATE INDEX IF NOT EXISTS idx_deprecated_function_calls_called_at ON public.deprecated_function_calls(called_at DESC);

-- Add comment
COMMENT ON TABLE public.deprecated_function_calls IS 'Tracks calls to deprecated functions for monitoring and migration planning. Used during deprecation period to identify callers before removal.';

-- Fix calculate_next_payout_date_with_time to handle weekly_specific
-- DEPRECATED: This function is deprecated. Use update_payout_plan_progress() instead.
-- Logging is enabled to track callers during deprecation period.
CREATE OR REPLACE FUNCTION calculate_next_payout_date_with_time(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer,
  p_existing_next_payout_date timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
  v_caller_info text;
BEGIN
  -- DEPRECATION WARNING: Log function usage for monitoring
  -- Get caller information from stack trace
  BEGIN
    v_caller_info := format(
      'DEPRECATED FUNCTION CALL: calculate_next_payout_date_with_time() called with frequency=%s, completed_payouts=%s. Caller: %s',
      p_frequency,
      p_completed_payouts,
      COALESCE(
        (SELECT regexp_replace(pg_backend_pid()::text || ':' || current_setting('application_name', true), '^$', 'unknown', 'g')),
        'unknown'
      )
    );
    
    -- Log to PostgreSQL logs (visible in server logs)
    RAISE WARNING '%', v_caller_info;
    
    -- Also log to a monitoring table if it exists (optional, won't fail if table doesn't exist)
    BEGIN
      INSERT INTO public.deprecated_function_calls (
        function_name,
        called_at,
        parameters,
        caller_info
      ) VALUES (
        'calculate_next_payout_date_with_time',
        now(),
        jsonb_build_object(
          'frequency', p_frequency,
          'completed_payouts', p_completed_payouts,
          'start_date', p_start_date::text
        ),
        v_caller_info
      );
    EXCEPTION
      WHEN undefined_table THEN
        -- Table doesn't exist yet, skip (optional monitoring)
        NULL;
      WHEN OTHERS THEN
        -- Don't fail the function if logging fails
        NULL;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      -- Don't fail the function if logging fails
      NULL;
  END;

  -- Extract payout time from existing next_payout_date if available, otherwise default to 9:00 AM
  IF p_existing_next_payout_date IS NOT NULL THEN
    v_payout_time := p_existing_next_payout_date::time;
    -- Only use the time if it's not midnight (likely a real time, not just a date)
    IF v_payout_time = '00:00:00'::time THEN
      v_payout_time := '09:00:00'::time;
    END IF;
  ELSE
    v_payout_time := '09:00:00'::time; -- Default to 9:00 AM
  END IF;

  -- Calculate the next payout date based on start_date and completed_payouts count
  -- The first payout (completed_payouts = 0) should happen on start_date
  -- Subsequent payouts are calculated as start_date + (completed_payouts * frequency_interval)
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'weekly_specific' THEN
      -- DEPRECATED: This function cannot fully support weekly_specific without day_of_week parameter.
      -- Falls back to weekly calculation (start_date + completed_payouts * 7 days).
      -- For proper weekly_specific support, use update_payout_plan_progress() instead,
      -- which has access to the full plan row including day_of_week.
      RAISE WARNING 'calculate_next_payout_date_with_time: weekly_specific frequency detected but day_of_week not available. Falling back to weekly calculation.';
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency or unknown, return start_date with time
      v_next_date := p_start_date;
  END CASE;
  
  -- Combine the date with the payout time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$;

-- Fix calculate_next_payout_date_from_existing to handle weekly_specific
-- DEPRECATED: This function is deprecated. Use update_payout_plan_progress() instead.
-- Logging is enabled to track callers during deprecation period.
CREATE OR REPLACE FUNCTION calculate_next_payout_date_from_existing(
  p_frequency text,
  p_start_date date,
  p_existing_next_payout_date timestamptz,
  p_completed_payouts integer
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
  v_caller_info text;
BEGIN
  -- DEPRECATION WARNING: Log function usage for monitoring
  -- Get caller information from stack trace
  BEGIN
    v_caller_info := format(
      'DEPRECATED FUNCTION CALL: calculate_next_payout_date_from_existing() called with frequency=%s, completed_payouts=%s. Caller: %s',
      p_frequency,
      p_completed_payouts,
      COALESCE(
        (SELECT regexp_replace(pg_backend_pid()::text || ':' || current_setting('application_name', true), '^$', 'unknown', 'g')),
        'unknown'
      )
    );
    
    -- Log to PostgreSQL logs (visible in server logs)
    RAISE WARNING '%', v_caller_info;
    
    -- Also log to a monitoring table if it exists (optional, won't fail if table doesn't exist)
    BEGIN
      INSERT INTO public.deprecated_function_calls (
        function_name,
        called_at,
        parameters,
        caller_info
      ) VALUES (
        'calculate_next_payout_date_from_existing',
        now(),
        jsonb_build_object(
          'frequency', p_frequency,
          'completed_payouts', p_completed_payouts,
          'start_date', p_start_date::text
        ),
        v_caller_info
      );
    EXCEPTION
      WHEN undefined_table THEN
        -- Table doesn't exist yet, skip (optional monitoring)
        NULL;
      WHEN OTHERS THEN
        -- Don't fail the function if logging fails
        NULL;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      -- Don't fail the function if logging fails
      NULL;
  END;

  -- Extract the time component from the existing next_payout_date
  v_payout_time := p_existing_next_payout_date::time;
  
  -- Calculate the next date based on frequency
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'weekly_specific' THEN
      -- DEPRECATED: This function cannot fully support weekly_specific without day_of_week parameter.
      -- Falls back to weekly calculation (start_date + completed_payouts * 7 days).
      -- For proper weekly_specific support, use update_payout_plan_progress() instead,
      -- which has access to the full plan row including day_of_week.
      RAISE WARNING 'calculate_next_payout_date_from_existing: weekly_specific frequency detected but day_of_week not available. Falling back to weekly calculation.';
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN NULL;
  END CASE;
  
  -- Combine the date with the extracted time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$;

-- Grant execute permissions (idempotent)
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date_with_time(date, text, integer, timestamptz) TO authenticated;
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date_with_time(date, text, integer, timestamptz) TO service_role;
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date_from_existing(text, date, timestamptz, integer) TO authenticated;
  GRANT EXECUTE ON FUNCTION calculate_next_payout_date_from_existing(text, date, timestamptz, integer) TO service_role;
EXCEPTION
  WHEN OTHERS THEN
    -- If grants already exist, continue (idempotent)
    NULL;
END;
$$;

-- Update comments with deprecation notice
COMMENT ON FUNCTION calculate_next_payout_date_with_time(date, text, integer, timestamptz) IS 
  'DEPRECATED: Use update_payout_plan_progress() instead for proper weekly_specific support. This function provides basic support but cannot fully handle weekly_specific without day_of_week parameter (falls back to weekly calculation). All calls are logged to deprecated_function_calls table and PostgreSQL logs for monitoring. Calculates next payout datetime preserving time component from existing next_payout_date. Supports daily, weekly, weekly_specific (fallback), biweekly, and monthly frequencies.';

COMMENT ON FUNCTION calculate_next_payout_date_from_existing(text, date, timestamptz, integer) IS 
  'DEPRECATED: Use update_payout_plan_progress() instead for proper weekly_specific support. This function provides basic support but cannot fully handle weekly_specific without day_of_week parameter (falls back to weekly calculation). All calls are logged to deprecated_function_calls table and PostgreSQL logs for monitoring. Calculates next payout date preserving the time component from existing next_payout_date. Supports daily, weekly, weekly_specific (fallback), biweekly, and monthly frequencies.';

-- Create helper view for easy monitoring of deprecated function calls
CREATE OR REPLACE VIEW public.deprecated_function_calls_summary AS
SELECT 
  main.function_name,
  main.call_count,
  main.first_called_at,
  main.last_called_at,
  main.days_with_calls,
  COALESCE(freq.frequency_breakdown, '{}'::jsonb) as frequency_breakdown
FROM (
  SELECT 
    function_name,
    COUNT(*) as call_count,
    MIN(called_at) as first_called_at,
    MAX(called_at) as last_called_at,
    COUNT(DISTINCT DATE(called_at)) as days_with_calls
  FROM public.deprecated_function_calls
  GROUP BY function_name
) main
LEFT JOIN (
  SELECT 
    function_name,
    jsonb_object_agg(
      frequency,
      call_count
    ) as frequency_breakdown
  FROM (
    SELECT 
      function_name,
      parameters->>'frequency' as frequency,
      COUNT(*) as call_count
    FROM public.deprecated_function_calls
    WHERE parameters->>'frequency' IS NOT NULL
    GROUP BY function_name, parameters->>'frequency'
  ) freq_counts
  GROUP BY function_name
) freq ON main.function_name = freq.function_name;

COMMENT ON VIEW public.deprecated_function_calls_summary IS 'Summary view of deprecated function calls for easy monitoring. Shows call counts, date ranges, and frequency breakdown.';

COMMIT;
