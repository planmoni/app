/*
  # Payout plan sharing (pairing)
  
  1. payout_plans.share_code - unique shareable code for links
  2. payout_plan_pairings - join table for users who follow a plan (read-only)
  3. RLS: allow paired users to SELECT plans; extend transactions SELECT for Calendar
  4. get_plan_by_share_code RPC for accept-share screen preview
*/

-- 1. Add share_code to payout_plans
ALTER TABLE payout_plans
ADD COLUMN IF NOT EXISTS share_code text UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_plans_share_code
ON payout_plans(share_code)
WHERE share_code IS NOT NULL;

COMMENT ON COLUMN payout_plans.share_code IS 'Unique 8-char code for share link (e.g. https://planmoni.com/plan/<code>)';

-- 2. Function to generate unique share code for payout plans
CREATE OR REPLACE FUNCTION generate_payout_plan_share_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM payout_plans WHERE share_code = code) INTO exists;
    IF NOT exists THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_payout_plan_share_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payout_plan_share_code() TO anon;

-- 3. payout_plan_pairings table
CREATE TABLE IF NOT EXISTS payout_plan_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid NOT NULL REFERENCES payout_plans(id) ON DELETE CASCADE,
  paired_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(payout_plan_id, paired_user_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_plan_pairings_paired_user
ON payout_plan_pairings(paired_user_id);

CREATE INDEX IF NOT EXISTS idx_payout_plan_pairings_plan
ON payout_plan_pairings(payout_plan_id);

ALTER TABLE payout_plan_pairings ENABLE ROW LEVEL SECURITY;

-- RLS: plan owner can see all pairings for their plan; paired user can see own pairings
CREATE POLICY "Plan owner can view pairings for their plans"
  ON payout_plan_pairings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payout_plans pp
      WHERE pp.id = payout_plan_pairings.payout_plan_id AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Paired user can view own pairings"
  ON payout_plan_pairings
  FOR SELECT
  TO authenticated
  USING (paired_user_id = auth.uid());

CREATE POLICY "User can add self as paired (insert)"
  ON payout_plan_pairings
  FOR INSERT
  TO authenticated
  WITH CHECK (paired_user_id = auth.uid());

CREATE POLICY "Paired user can remove own pairing (delete)"
  ON payout_plan_pairings
  FOR DELETE
  TO authenticated
  USING (paired_user_id = auth.uid());

-- 4. Extend payout_plans SELECT so paired users can read plans they follow
DROP POLICY IF EXISTS "Users can view own payout plans" ON payout_plans;

CREATE POLICY "Users can view own or paired payout plans"
  ON payout_plans
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR id IN (
      SELECT payout_plan_id FROM payout_plan_pairings WHERE paired_user_id = auth.uid()
    )
  );

-- 5. get_plan_by_share_code RPC - minimal public fields for accept-share preview (no bank details)
CREATE OR REPLACE FUNCTION get_plan_by_share_code(p_share_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_name text;
  v_payout_amount numeric;
  v_frequency text;
  v_next_payout_date timestamptz;
  v_creator_first_name text;
  v_status text;
BEGIN
  IF p_share_code IS NULL OR trim(p_share_code) = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid code');
  END IF;

  SELECT pp.id, pp.name, pp.payout_amount, pp.frequency, pp.next_payout_date, pp.status,
         COALESCE(p.first_name, 'Someone')
  INTO v_plan_id, v_name, v_payout_amount, v_frequency, v_next_payout_date, v_status, v_creator_first_name
  FROM payout_plans pp
  LEFT JOIN profiles p ON p.id = pp.user_id
  WHERE pp.share_code = trim(p_share_code)
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Plan not found or link expired');
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('found', false, 'error', 'This plan is no longer active');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_plan_id,
    'name', v_name,
    'payout_amount', v_payout_amount,
    'frequency', v_frequency,
    'next_payout_date', v_next_payout_date,
    'creator_first_name', v_creator_first_name,
    'is_owner', (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM payout_plans WHERE id = v_plan_id AND user_id = auth.uid()))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_plan_by_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_by_share_code(text) TO anon;

-- Ensure plan has a share code (owner only); returns existing or newly set share_code
CREATE OR REPLACE FUNCTION ensure_payout_plan_share_code(p_plan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_code text;
  v_owner_id uuid;
BEGIN
  SELECT user_id, share_code INTO v_owner_id, v_share_code
  FROM payout_plans WHERE id = p_plan_id LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF auth.uid() IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Only the plan owner can generate share code';
  END IF;
  IF v_share_code IS NOT NULL THEN
    RETURN v_share_code;
  END IF;
  v_share_code := generate_payout_plan_share_code();
  UPDATE payout_plans SET share_code = v_share_code, updated_at = now() WHERE id = p_plan_id;
  RETURN v_share_code;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_payout_plan_share_code(uuid) TO authenticated;

-- 6. Optional: allow paired users to SELECT payout transactions for plans they follow (for Calendar completed events)
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Paired users can view payout transactions for shared plans"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    type = 'payout'
    AND payout_plan_id IS NOT NULL
    AND payout_plan_id IN (
      SELECT payout_plan_id FROM payout_plan_pairings WHERE paired_user_id = auth.uid()
    )
  );
