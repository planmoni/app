/*
  # Fix notification schedules (Expo push + Resend email crons)

  Issues fixed:
  1. app.settings.service_role_key was unset, so pg_cron jobs sent empty Bearer tokens.
  2. Many notification cron jobs were inactive.
  3. process_scheduled_notifications only marked admin campaigns as "sending" without dispatching.
  4. Broken check-new-transactions trigger on transactions sent {} to send-push-notification (400s).

  Service role key is read from vault secret `service_role_key` (created at deploy time) with
  fallback to app.settings.service_role_key when set in Dashboard SQL.
*/

-- ---------------------------------------------------------------------------
-- Internal auth helpers for pg_cron / triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_internal_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  key text;
BEGIN
  key := nullif(current_setting('app.settings.service_role_key', true), '');

  IF key IS NULL THEN
    SELECT decrypted_secret
    INTO key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  END IF;

  IF key IS NULL OR length(key) = 0 THEN
    RAISE EXCEPTION 'Service role key not configured. Create vault secret service_role_key or set app.settings.service_role_key.';
  END IF;

  RETURN key;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_supabase_auth_headers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || public.get_internal_service_role_key(),
    'apikey', public.get_internal_service_role_key()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_internal_supabase_url()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('app.settings.supabase_url', true), ''),
    'https://rqmpnoaavyizlwzfngpr.supabase.co'
  );
$$;

REVOKE ALL ON FUNCTION public.get_internal_service_role_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_internal_supabase_auth_headers() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Drop broken transaction trigger (fires send-push-notification with empty body)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS "check-new-transactions" ON public.transactions;

-- ---------------------------------------------------------------------------
-- Fix admin scheduled push dispatch (push_notifications table)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS TABLE(processed_count integer, notification_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_record RECORD;
  current_wat_time timestamptz;
  processed integer := 0;
  notification_id_array uuid[] := ARRAY[]::uuid[];
  request_body jsonb;
  base_url text;
BEGIN
  base_url := public.get_internal_supabase_url();
  current_wat_time := now() AT TIME ZONE 'Africa/Lagos';

  FOR notification_record IN
    SELECT
      id,
      title,
      body,
      data,
      target_type,
      target_user_ids,
      notification_type,
      scheduled_for
    FROM public.push_notifications
    WHERE status = 'scheduled'
      AND (
        scheduled_for IS NULL
        OR (scheduled_for AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos') <= current_wat_time
      )
    ORDER BY scheduled_for NULLS FIRST
    LIMIT 10
  LOOP
    UPDATE public.push_notifications
    SET status = 'sending',
        sent_at = now(),
        updated_at = now()
    WHERE id = notification_record.id
      AND status = 'scheduled';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    request_body := jsonb_build_object(
      'title', notification_record.title,
      'body', notification_record.body,
      'notification_type', coalesce(notification_record.notification_type, 'general'),
      'data', coalesce(notification_record.data, '{}'::jsonb)
    );

    IF notification_record.target_type = 'all' THEN
      request_body := request_body || jsonb_build_object('send_to_all', true);
    ELSIF notification_record.target_type = 'users'
      AND notification_record.target_user_ids IS NOT NULL
      AND cardinality(notification_record.target_user_ids) > 0 THEN
      request_body := request_body || jsonb_build_object(
        'user_ids',
        to_jsonb(notification_record.target_user_ids)
      );
    ELSE
      UPDATE public.push_notifications
      SET status = 'failed',
          failed_count = coalesce(failed_count, 0) + 1,
          updated_at = now()
      WHERE id = notification_record.id;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-push-notification',
      headers := public.get_internal_supabase_auth_headers(),
      body := request_body
    );

    UPDATE public.push_notifications
    SET status = 'sent',
        updated_at = now()
    WHERE id = notification_record.id
      AND status = 'sending';

    processed := processed + 1;
    notification_id_array := array_append(notification_id_array, notification_record.id);
  END LOOP;

  RETURN QUERY SELECT processed, notification_id_array;
END;
$$;

-- Re-dispatch admin campaigns stuck in "sending" (prior bug: marked sending, never sent)
CREATE OR REPLACE FUNCTION public.dispatch_stuck_sending_push_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_record RECORD;
  dispatched integer := 0;
  request_body jsonb;
  base_url text;
BEGIN
  base_url := public.get_internal_supabase_url();

  FOR notification_record IN
    SELECT
      id,
      title,
      body,
      data,
      target_type,
      target_user_ids,
      notification_type
    FROM public.push_notifications
    WHERE status = 'sending'
    ORDER BY coalesce(sent_at, created_at) ASC
    LIMIT 20
  LOOP
    request_body := jsonb_build_object(
      'title', notification_record.title,
      'body', notification_record.body,
      'notification_type', coalesce(notification_record.notification_type, 'general'),
      'data', coalesce(notification_record.data, '{}'::jsonb)
    );

    IF notification_record.target_type = 'all' THEN
      request_body := request_body || jsonb_build_object('send_to_all', true);
    ELSIF notification_record.target_type = 'users'
      AND notification_record.target_user_ids IS NOT NULL
      AND cardinality(notification_record.target_user_ids) > 0 THEN
      request_body := request_body || jsonb_build_object(
        'user_ids',
        to_jsonb(notification_record.target_user_ids)
      );
    ELSE
      UPDATE public.push_notifications
      SET status = 'failed',
          failed_count = coalesce(failed_count, 0) + 1,
          updated_at = now()
      WHERE id = notification_record.id;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-push-notification',
      headers := public.get_internal_supabase_auth_headers(),
      body := request_body
    );

    UPDATE public.push_notifications
    SET status = 'sent',
        sent_at = coalesce(sent_at, now()),
        updated_at = now()
    WHERE id = notification_record.id;

    dispatched := dispatched + 1;
  END LOOP;

  RETURN dispatched;
END;
$$;

-- ---------------------------------------------------------------------------
-- Re-enable and fix notification cron jobs
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- Queue worker: process pending push_notification_queue rows
  PERFORM cron.alter_job(
    job_id := 50,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-push-notifications',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Daily digest push (08:00 UTC)
  PERFORM cron.alter_job(
    job_id := 58,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-daily-digest',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Mid-plan push (09:00 UTC)
  PERFORM cron.alter_job(
    job_id := 59,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-mid-plan-push',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Re-engagement push
  PERFORM cron.alter_job(
    job_id := 60,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-re-engagement-push',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- No-plan nudge
  PERFORM cron.alter_job(
    job_id := 61,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-no-plan-nudge',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Deposit no-plan nudge
  PERFORM cron.alter_job(
    job_id := 62,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-deposit-no-plan-nudge',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Vault emails (Resend) - hourly
  PERFORM cron.alter_job(
    job_id := 66,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-vault-emails',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Vault retention push
  PERFORM cron.alter_job(
    job_id := 67,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-vault-retention-push',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Zero-balance reminder
  PERFORM cron.alter_job(
    job_id := 68,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-zero-balance-reminder',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Unfunded vault reminder
  PERFORM cron.alter_job(
    job_id := 69,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-unfunded-vault-reminder',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Lifecycle retargeting
  PERFORM cron.alter_job(
    job_id := 70,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/process-lifecycle-retargeting',
        headers := public.get_internal_supabase_auth_headers(),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Wallet summary emails (fix wrong project URL + auth)
  PERFORM cron.alter_job(
    job_id := 38,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-wallet-summaries',
        headers := public.get_internal_supabase_auth_headers(),
        body := jsonb_build_object('period', 'daily')
      );
    $cmd$
  );

  PERFORM cron.alter_job(
    job_id := 39,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-wallet-summaries',
        headers := public.get_internal_supabase_auth_headers(),
        body := jsonb_build_object('period', 'weekly')
      );
    $cmd$
  );

  PERFORM cron.alter_job(
    job_id := 40,
    active := true,
    command := $cmd$
      SELECT net.http_post(
        url := public.get_internal_supabase_url() || '/functions/v1/send-wallet-summaries',
        headers := public.get_internal_supabase_auth_headers(),
        body := jsonb_build_object('period', 'monthly')
      );
    $cmd$
  );
END;
$$;

-- Dispatch any campaigns stuck in "sending" from the prior bug
SELECT public.dispatch_stuck_sending_push_notifications();
