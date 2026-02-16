-- Add purpose and purpose_other_text to payout_plans for plan creation flow.
-- purpose: stable value (e.g. personal_salary_allowance, transportation, others).
-- purpose_other_text: free text when purpose = 'others'. Nullable for existing rows.

ALTER TABLE payout_plans
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS purpose_other_text text;

COMMENT ON COLUMN payout_plans.purpose IS 'Plan purpose key from taxonomy (e.g. personal_salary_allowance, others)';
COMMENT ON COLUMN payout_plans.purpose_other_text IS 'Custom purpose text when purpose is others';
