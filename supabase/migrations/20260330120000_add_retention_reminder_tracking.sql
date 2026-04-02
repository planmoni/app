/*
  # Add retention reminder tracking columns

  Tracks cooldown timestamps for:
  - zero-balance reminder
  - unfunded-vault reminder
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS zero_balance_reminder_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS unfunded_vault_reminder_sent_at timestamptz;

COMMENT ON COLUMN profiles.zero_balance_reminder_sent_at IS
  'Last time a zero-balance retention reminder was sent';

COMMENT ON COLUMN profiles.unfunded_vault_reminder_sent_at IS
  'Last time an unfunded-vault retention reminder was sent';

CREATE INDEX IF NOT EXISTS idx_profiles_zero_balance_reminder_sent_at
ON profiles(zero_balance_reminder_sent_at)
WHERE zero_balance_reminder_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_unfunded_vault_reminder_sent_at
ON profiles(unfunded_vault_reminder_sent_at)
WHERE unfunded_vault_reminder_sent_at IS NOT NULL;
