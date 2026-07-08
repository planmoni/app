/*
  # Schedule account closure and automatic purge

  Users can request account closure from the app.
  We schedule deletion for 30 days, then a daily cron job permanently
  removes auth + public data for due accounts.
*/

-- Track account closure status on profile for app visibility/debugging.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_closure_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_closure_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS account_closure_status text
    CHECK (account_closure_status IN ('scheduled', 'cancelled', 'completed'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_closure_status
  ON public.profiles(account_closure_status, account_closure_scheduled_for);

-- Canonical schedule table.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  processed_at timestamptz,
  cancelled_at timestamptz,
  process_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_due
  ON public.account_deletion_requests(status, scheduled_for);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'account_deletion_requests'
      AND policyname = 'Users can view own account deletion request'
  ) THEN
    CREATE POLICY "Users can view own account deletion request"
      ON public.account_deletion_requests
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- User-triggered scheduling RPC (idempotent for already scheduled users).
CREATE OR REPLACE FUNCTION public.request_account_closure()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scheduled_for timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT scheduled_for
    INTO v_scheduled_for
  FROM public.account_deletion_requests
  WHERE user_id = v_user_id
    AND status = 'scheduled'
    AND scheduled_for > now()
  LIMIT 1;

  IF v_scheduled_for IS NULL THEN
    v_scheduled_for := now() + interval '30 days';

    INSERT INTO public.account_deletion_requests (
      user_id,
      requested_at,
      scheduled_for,
      status,
      updated_at
    )
    VALUES (
      v_user_id,
      now(),
      v_scheduled_for,
      'scheduled',
      now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      requested_at = EXCLUDED.requested_at,
      scheduled_for = EXCLUDED.scheduled_for,
      status = 'scheduled',
      cancelled_at = NULL,
      processed_at = NULL,
      process_notes = NULL,
      updated_at = now();
  END IF;

  UPDATE public.profiles
  SET
    account_closure_requested_at = now(),
    account_closure_scheduled_for = v_scheduled_for,
    account_closure_status = 'scheduled',
    updated_at = now()
  WHERE id = v_user_id;

  RETURN v_scheduled_for;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_closure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_closure() TO authenticated;

-- Hard-delete helper. We first delete rows in public tables that carry common
-- user reference columns, then remove auth.users (which cascades where FKs exist).
CREATE OR REPLACE FUNCTION public.purge_user_account_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rec record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Avoid concurrent purge of same user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 9917));

  FOR rec IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.udt_name = 'uuid'
      AND c.column_name IN ('user_id', 'created_by', 'updated_by', 'owner_id', 'profile_id')
      AND c.table_name NOT IN ('profiles', 'account_deletion_requests')
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE %I = $1',
      rec.table_schema,
      rec.table_name,
      rec.column_name
    )
    USING p_user_id;
  END LOOP;

  DELETE FROM public.account_deletion_requests WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_account_data(uuid) FROM PUBLIC;

-- Daily worker used by pg_cron.
CREATE OR REPLACE FUNCTION public.process_scheduled_account_deletions(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  processed integer := 0;
BEGIN
  FOR req IN
    SELECT id, user_id
    FROM public.account_deletion_requests
    WHERE status = 'scheduled'
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT greatest(coalesce(p_limit, 200), 1)
  LOOP
    BEGIN
      PERFORM public.purge_user_account_data(req.user_id);
      processed := processed + 1;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.account_deletion_requests
        SET process_notes = concat(
              'Last failure at ',
              now()::text,
              ': ',
              SQLERRM
            ),
            updated_at = now()
        WHERE id = req.id;
    END;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_scheduled_account_deletions(integer) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-account-deletions-daily') THEN
    PERFORM cron.unschedule('process-account-deletions-daily');
  END IF;

  PERFORM cron.schedule(
    'process-account-deletions-daily',
    '15 2 * * *',
    'SELECT public.process_scheduled_account_deletions(200);'
  );
END;
$$;
