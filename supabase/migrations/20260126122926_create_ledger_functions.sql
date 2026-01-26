/*
  # Create Ledger Functions
  
  Functions for appending entries to the audit ledger and verifying integrity.
*/

-- Function to calculate entry hash
CREATE OR REPLACE FUNCTION calculate_entry_hash(
  p_entry_number bigint,
  p_wallet_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_balance_before numeric,
  p_balance_after numeric,
  p_previous_hash text,
  p_metadata jsonb
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash_input text;
  v_hash text;
BEGIN
  -- Create hash input from entry data
  v_hash_input := format(
    '%s|%s|%s|%s|%s|%s|%s|%s',
    p_entry_number,
    COALESCE(p_wallet_id::text, ''),
    p_entry_type,
    COALESCE(p_amount::text, ''),
    p_balance_before::text,
    p_balance_after::text,
    COALESCE(p_previous_hash, ''),
    p_metadata::text
  );
  
  -- Calculate SHA-256 hash
  v_hash := encode(digest(v_hash_input, 'sha256'), 'hex');
  
  RETURN v_hash;
END;
$$;

-- Function to append ledger entry
CREATE OR REPLACE FUNCTION append_ledger_entry(
  p_wallet_id uuid,
  p_partner_id uuid DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL,
  p_entry_type text,
  p_amount numeric DEFAULT NULL,
  p_balance_before numeric,
  p_balance_after numeric,
  p_currency text DEFAULT 'NGN',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_number bigint;
  v_previous_hash text;
  v_entry_hash text;
  v_entry_id uuid;
BEGIN
  -- Get the last entry number and hash for this wallet
  SELECT ledger_entry_number, entry_hash INTO v_entry_number, v_previous_hash
  FROM audit_ledger
  WHERE wallet_id = p_wallet_id
  ORDER BY ledger_entry_number DESC
  LIMIT 1;
  
  -- If no previous entry, start at 1
  IF v_entry_number IS NULL THEN
    v_entry_number := 0;
    v_previous_hash := NULL;
  END IF;
  
  -- Increment entry number
  v_entry_number := v_entry_number + 1;
  
  -- Calculate hash for this entry
  v_entry_hash := calculate_entry_hash(
    v_entry_number,
    p_wallet_id,
    p_entry_type,
    p_amount,
    p_balance_before,
    p_balance_after,
    v_previous_hash,
    p_metadata
  );
  
  -- Insert ledger entry
  INSERT INTO audit_ledger (
    wallet_id,
    partner_id,
    transaction_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    currency,
    metadata,
    previous_hash,
    entry_hash
  ) VALUES (
    p_wallet_id,
    p_partner_id,
    p_transaction_id,
    p_entry_type,
    p_amount,
    p_balance_before,
    p_balance_after,
    p_currency,
    p_metadata,
    v_previous_hash,
    v_entry_hash
  ) RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$;

-- Function to verify ledger integrity for a wallet
CREATE OR REPLACE FUNCTION verify_ledger_integrity(p_wallet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry RECORD;
  v_previous_hash text := NULL;
  v_calculated_hash text;
  v_integrity_ok boolean := true;
  v_violations jsonb := '[]'::jsonb;
BEGIN
  -- Check each entry in sequence
  FOR v_entry IN
    SELECT * FROM audit_ledger
    WHERE wallet_id = p_wallet_id
    ORDER BY ledger_entry_number ASC
  LOOP
    -- Calculate expected hash
    v_calculated_hash := calculate_entry_hash(
      v_entry.ledger_entry_number,
      v_entry.wallet_id,
      v_entry.entry_type,
      v_entry.amount,
      v_entry.balance_before,
      v_entry.balance_after,
      v_previous_hash,
      v_entry.metadata
    );
    
    -- Verify hash matches
    IF v_calculated_hash != v_entry.entry_hash THEN
      v_integrity_ok := false;
      v_violations := v_violations || jsonb_build_object(
        'entry_number', v_entry.ledger_entry_number,
        'expected_hash', v_calculated_hash,
        'actual_hash', v_entry.entry_hash,
        'message', 'Hash mismatch detected'
      );
    END IF;
    
    -- Verify previous_hash matches
    IF v_previous_hash IS NOT NULL AND v_entry.previous_hash != v_previous_hash THEN
      v_integrity_ok := false;
      v_violations := v_violations || jsonb_build_object(
        'entry_number', v_entry.ledger_entry_number,
        'expected_previous_hash', v_previous_hash,
        'actual_previous_hash', v_entry.previous_hash,
        'message', 'Previous hash mismatch - chain broken'
      );
    END IF;
    
    v_previous_hash := v_entry.entry_hash;
  END LOOP;
  
  RETURN jsonb_build_object(
    'integrity_ok', v_integrity_ok,
    'violations', v_violations,
    'total_entries', (SELECT COUNT(*) FROM audit_ledger WHERE wallet_id = p_wallet_id)
  );
END;
$$;

-- Function to get ledger history
CREATE OR REPLACE FUNCTION get_ledger_history(
  p_wallet_id uuid,
  p_from_date timestamptz DEFAULT NULL,
  p_to_date timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entries jsonb;
  v_total bigint;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM audit_ledger
  WHERE wallet_id = p_wallet_id
    AND (p_from_date IS NULL OR created_at >= p_from_date)
    AND (p_to_date IS NULL OR created_at <= p_to_date);
  
  -- Get entries
  SELECT jsonb_agg(
    jsonb_build_object(
      'entry_number', ledger_entry_number,
      'entry_type', entry_type,
      'amount', amount,
      'balance_before', balance_before,
      'balance_after', balance_after,
      'currency', currency,
      'metadata', metadata,
      'entry_hash', entry_hash,
      'created_at', created_at
    ) ORDER BY ledger_entry_number DESC
  ) INTO v_entries
  FROM audit_ledger
  WHERE wallet_id = p_wallet_id
    AND (p_from_date IS NULL OR created_at >= p_from_date)
    AND (p_to_date IS NULL OR created_at <= p_to_date)
  ORDER BY ledger_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
  
  RETURN jsonb_build_object(
    'entries', COALESCE(v_entries, '[]'::jsonb),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION append_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION verify_ledger_integrity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_ledger_integrity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_ledger_history(uuid, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ledger_history(uuid, timestamptz, timestamptz, integer, integer) TO service_role;
