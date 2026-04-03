/**
 * Canonical lifecycle funnel event names (Postgres + Edge retargeting).
 * Keep in sync with supabase/functions/process-lifecycle-retargeting.
 */

export const LifecycleEventName = {
  /** User viewed Vaults (home tab or vault list). */
  VAULT_FLOW_OPENED: 'vault_flow_opened',
  /** User opened vault creation (first create screen). */
  VAULT_FLOW_STARTED: 'vault_flow_started',
  /** User progressed past early details (e.g. amount / naming). */
  VAULT_FLOW_STEP_DETAILS: 'vault_flow_step_details',
  /** User reached review / confirm step. */
  VAULT_FLOW_STEP_CONFIRM: 'vault_flow_step_confirm',
  /** Vault creation finished successfully. */
  VAULT_FLOW_COMPLETED: 'vault_flow_completed',

  PAYOUT_PLAN_FLOW_STARTED: 'payout_plan_flow_started',
  PAYOUT_PLAN_FLOW_STEP_DETAILS: 'payout_plan_flow_step_details',
  PAYOUT_PLAN_FLOW_COMPLETED: 'payout_plan_flow_completed',
} as const;

export type LifecycleEventNameType =
  (typeof LifecycleEventName)[keyof typeof LifecycleEventName];
