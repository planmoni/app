type NotificationData = Record<string, any> | null | undefined;

const TYPE_ROUTE_MAP: Record<string, string> = {
  payout_completed: '/all-payouts',
  payout_scheduled: '/all-payouts',
  disbursement_failed: '/all-payouts',
  deposit_successful: '/(tabs)/',
  deposit_failed: '/(tabs)/',
  transaction_completed: '/transactions',
  transaction_failed: '/transactions',
  security_alert: '/profile',
  login_alert: '/profile',
  suspicious_activity: '/profile',
  payout: '/all-payouts',
  transaction: '/transactions',
  security: '/profile',
  payout_ready: '/all-payouts',
  payout_failed: '/all-payouts',
  plan_expiry_reminder: '/all-payouts',
  daily_digest: '/(tabs)/',
  re_engagement: '/(tabs)/',
  no_plan_yet: '/create-payout/amount',
  deposit_no_plan: '/create-payout/amount',
  zero_balance_reminder: '/(tabs)/',
  streak: '/(tabs)/insights',
  vault_schedule_created: '/(tabs)?activeBalanceTab=plans',
  vault_payout_completed: '/(tabs)?activeBalanceTab=plans',
  vault_low_balance: '/(tabs)?activeBalanceTab=plans',
  vault_unfunded_reminder: '/(tabs)?activeBalanceTab=plans',
  vault_abandon_reminder: '/expense-planner',
  payout_abandon_reminder: '/create-payout/amount',
};

const PLAN_SCOPED_TYPES = new Set([
  'payout_ready',
  'payout_failed',
  'plan_expiry_reminder',
  'mid_plan',
  'before_end_plan',
  'plan_ending_today',
  'first_payout_reminder',
  'plan_completed',
]);

export function getRouteFromNotificationData(data: NotificationData): string {
  if (!data) return '/(tabs)/';
  if (typeof data.route === 'string' && data.route.trim()) return data.route;

  const type = (data.type ?? data.eventType ?? data.notificationType) as
    | string
    | undefined;
  const planId = data.plan_id as string | undefined;
  if (type && planId && PLAN_SCOPED_TYPES.has(type)) {
    return `/view-payout/${planId}`;
  }

  if (type && TYPE_ROUTE_MAP[type]) return TYPE_ROUTE_MAP[type];
  return '/(tabs)/';
}

