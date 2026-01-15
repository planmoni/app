/*
  # Create helper function to get payout fee
  
  This function returns the active fee percentage for a given frequency.
  Returns 0 if no fee is found (fallback).
*/

CREATE OR REPLACE FUNCTION get_payout_fee(frequency_type text)
RETURNS numeric AS $$
DECLARE
  fee_percent numeric;
BEGIN
  SELECT fee_percentage INTO fee_percent
  FROM payout_fees
  WHERE frequency = frequency_type
    AND is_active = true
  LIMIT 1;
  
  -- Return 0 if no fee found (fallback)
  RETURN COALESCE(fee_percent, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION get_payout_fee(text) IS 'Returns the active fee percentage for a given frequency type. Returns 0 if not found.';
