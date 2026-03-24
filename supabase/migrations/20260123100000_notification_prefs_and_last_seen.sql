/*
  # Notification preferences and last_seen_at (Phase 2 retention)

  - Add last_seen_at to profiles for re-engagement and daily digest targeting.
  - Extend push_notifications with plan_reminders, daily_digest, mid_plan (add missing keys only).
*/

-- Add last_seen_at for "last app open" tracking (re-engagement, digest targeting)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN profiles.last_seen_at IS 'Last time the user opened the app; used for re-engagement and daily digest targeting';

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at) WHERE last_seen_at IS NOT NULL;

-- Extend push_notifications with new preference keys (only add if missing so we do not overwrite user choices)
UPDATE profiles
SET push_notifications = push_notifications
  || jsonb_build_object(
       'plan_reminders', COALESCE((push_notifications->>'plan_reminders')::boolean, true),
       'daily_digest',   COALESCE((push_notifications->>'daily_digest')::boolean, true),
       'mid_plan',       COALESCE((push_notifications->>'mid_plan')::boolean, true)
     )
WHERE push_notifications IS NOT NULL
  AND (
    (push_notifications ? 'plan_reminders') = false
    OR (push_notifications ? 'daily_digest') = false
    OR (push_notifications ? 'mid_plan') = false
  );
