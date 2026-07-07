/**
 * Custom payout amount helpers — use real per-date amounts, not equal-split averages.
 */

export type CustomInstallment = {
  date: string;
  amount: number;
};

/** Build sorted installments from a date→amount map. */
export function getCustomInstallments(
  customAmounts: Record<string, number>
): CustomInstallment[] {
  return Object.entries(customAmounts)
    .map(([date, amount]) => ({ date, amount: Number(amount) || 0 }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Sum of the first `completedPayouts` installment amounts. */
export function completedCustomAmount(
  customAmounts: Record<string, number>,
  completedPayouts: number
): number {
  const installments = getCustomInstallments(customAmounts);
  return installments
    .slice(0, Math.max(0, completedPayouts))
    .reduce((sum, row) => sum + row.amount, 0);
}

/** Sum of unpaid installment amounts. */
export function remainingCustomAmount(
  customAmounts: Record<string, number>,
  completedPayouts: number
): number {
  const installments = getCustomInstallments(customAmounts);
  return installments
    .slice(Math.max(0, completedPayouts))
    .reduce((sum, row) => sum + row.amount, 0);
}

/** Next installment amount by plan progress or matching next payout date. */
export function nextCustomInstallmentAmount(
  customAmounts: Record<string, number>,
  completedPayouts: number,
  nextPayoutDate?: string | null
): number | null {
  const installments = getCustomInstallments(customAmounts);
  if (installments.length === 0) return null;

  if (nextPayoutDate) {
    const dateKey = nextPayoutDate.split('T')[0];
    const match = installments.find((row) => row.date === dateKey);
    if (match) return match.amount;
  }

  const next = installments[completedPayouts];
  return next ? next.amount : null;
}

/** Completed amount for any plan (custom or regular). */
export function calculatePlanCompletedAmount(
  frequency: string,
  completedPayouts: number,
  payoutAmount: number,
  customAmounts?: Record<string, number>
): number {
  if (frequency === 'custom' && customAmounts && Object.keys(customAmounts).length > 0) {
    return completedCustomAmount(customAmounts, completedPayouts);
  }
  return completedPayouts * payoutAmount;
}

/** True when a custom plan has per-date amounts configured. */
export function hasCustomPayoutAmounts(
  frequency: string,
  customDates: string[],
  customAmounts?: Record<string, number | string>
): boolean {
  if (frequency !== 'custom' || customDates.length === 0 || !customAmounts) return false;
  return customDates.some((date) => {
    const raw = customAmounts[date];
    const num = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw ?? 0);
    return !isNaN(num) && num > 0;
  });
}

/** Format a payout amount for display (₦ with 2 decimals). */
export function formatPayoutMoney(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
  if (isNaN(num)) return '₦0.00';
  return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Remaining payout value for display (custom uses sum of unpaid rows). */
export function calculatePlanRemainingAmount(
  frequency: string,
  completedPayouts: number,
  payoutAmount: number,
  netPayoutAmount: number,
  customAmounts?: Record<string, number>
): number {
  if (frequency === 'custom' && customAmounts && Object.keys(customAmounts).length > 0) {
    return remainingCustomAmount(customAmounts, completedPayouts);
  }
  return Math.max(0, netPayoutAmount - completedPayouts * payoutAmount);
}
