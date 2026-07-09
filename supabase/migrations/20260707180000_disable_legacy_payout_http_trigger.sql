-- Legacy payout_plans triggers call net.http_post → process-automated-payouts.
-- pg_net is not available in this project; the call aborts update_payout_plan_progress
-- and blocks complete_payout_installment. Processing is handled by process-due-payouts cron.

DROP TRIGGER IF EXISTS trigger_auto_process_payout ON public.payout_plans;
DROP TRIGGER IF EXISTS trigger_auto_process_payout_insert ON public.payout_plans;

CREATE OR REPLACE FUNCTION public.trigger_process_due_payout_improved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op: immediate HTTP payout dispatch removed. See process-due-payouts edge cron.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_process_due_payout_improved() IS
  'Legacy trigger stub. Payout processing is handled by the process-due-payouts cron, not pg_net HTTP.';
