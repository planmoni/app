-- Ensure bank_accounts has columns required for Mono account linking
-- (mono-account-link Edge Function and linked-accounts flow)

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_code text;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS mono_account_id text;

COMMENT ON COLUMN bank_accounts.mono_account_id IS 'Mono Connect account ID for Direct Debit';
