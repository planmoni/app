/*
  Minimum supported app versions.

  ios_min_version / android_min_version are the oldest releases that may keep
  running. Clients below that version must update and cannot dismiss the prompt.
  Null means no minimum (optional updates only, unless force_update is set).
*/

ALTER TABLE public.app_versions
  ADD COLUMN IF NOT EXISTS ios_min_version text,
  ADD COLUMN IF NOT EXISTS android_min_version text;

COMMENT ON COLUMN public.app_versions.ios_min_version IS
  'Oldest iOS app version still allowed. Older installs must update.';

COMMENT ON COLUMN public.app_versions.android_min_version IS
  'Oldest Android app version still allowed. Older installs must update.';
