-- Add end_of_month, quarterly, biannual, annually to calculate_next_payout_date.
-- update_payout_plan_progress uses this for all non-custom, non-weekly_specific plans,
-- so these frequencies will then advance correctly after each payout.

CREATE OR REPLACE FUNCTION calculate_next_payout_date(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer
)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_month_start date;
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'weekly_specific' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 month');
    WHEN 'end_of_month' THEN
      -- Last day of (start_month + completed_payouts)
      v_month_start := date_trunc('month', p_start_date)::date + (p_completed_payouts || ' months')::interval;
      RETURN (v_month_start + interval '1 month' - interval '1 day')::date;
    WHEN 'quarterly' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '3 months');
    WHEN 'biannual' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '6 months');
    WHEN 'annually' THEN
      RETURN p_start_date + (p_completed_payouts * INTERVAL '1 year');
    ELSE
      RETURN p_start_date;
  END CASE;
END;
$$;

COMMENT ON FUNCTION calculate_next_payout_date(date, text, integer) IS
  'Calculates the next payout date from start_date and completed_payouts. Supports daily, weekly, weekly_specific (fallback), biweekly, monthly, end_of_month, quarterly, biannual, annually.';
