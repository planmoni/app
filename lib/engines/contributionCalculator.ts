/**
 * Contribution Calculator Engine
 * Calculates required contribution per payout cycle and per day
 */

export type PayoutSchedule = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ContributionCalculation {
  requiredPerCycle: number;
  requiredPerDay: number;
  cyclesRemaining: number;
  daysRemaining: number;
  schedule: PayoutSchedule;
  message: string;
}

/**
 * Calculate days between two dates
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / oneDay);
}

/**
 * Get number of cycles until deadline based on schedule
 */
function getCyclesUntilDeadline(
  startDate: Date,
  endDate: Date,
  schedule: PayoutSchedule
): number {
  const daysRemaining = getDaysBetween(startDate, endDate);
  
  switch (schedule) {
    case 'daily':
      return Math.max(1, daysRemaining);
    case 'weekly':
      return Math.max(1, Math.ceil(daysRemaining / 7));
    case 'biweekly':
      return Math.max(1, Math.ceil(daysRemaining / 14));
    case 'monthly':
      // Approximate months as 30 days
      return Math.max(1, Math.ceil(daysRemaining / 30));
    default:
      return 1;
  }
}

/**
 * Calculate required contribution
 */
export function calculateRequiredContribution(
  targetAmount: number,
  startDate: Date,
  endDate: Date | null,
  schedule: PayoutSchedule,
  currentBalance: number = 0
): ContributionCalculation {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Use today as start if start date is in the past
  const effectiveStartDate = startDate < today ? today : startDate;
  
  // If no end date (ongoing), we can't calculate - return defaults
  if (!endDate) {
    return {
      requiredPerCycle: 0,
      requiredPerDay: 0,
      cyclesRemaining: 0,
      daysRemaining: 0,
      schedule,
      message: 'Ongoing plans require manual contribution management',
    };
  }

  const remainingAmount = Math.max(0, targetAmount - currentBalance);
  const daysRemaining = getDaysBetween(effectiveStartDate, endDate);
  const cyclesRemaining = getCyclesUntilDeadline(effectiveStartDate, endDate, schedule);
  
  const requiredPerCycle = cyclesRemaining > 0 ? remainingAmount / cyclesRemaining : 0;
  const requiredPerDay = daysRemaining > 0 ? remainingAmount / daysRemaining : 0;

  // Generate message
  const scheduleLabel = schedule === 'daily' ? 'day' :
                        schedule === 'weekly' ? 'week' :
                        schedule === 'biweekly' ? '2 weeks' :
                        'month';
  
  const formattedAmount = Math.ceil(requiredPerCycle).toLocaleString('en-US');
  const formattedDate = endDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const message = `You should receive ₦${formattedAmount} every ${scheduleLabel} from your budget to carry out this plan by ${formattedDate}.`;

  return {
    requiredPerCycle: Number(requiredPerCycle.toFixed(2)),
    requiredPerDay: Number(requiredPerDay.toFixed(2)),
    cyclesRemaining,
    daysRemaining,
    schedule,
    message,
  };
}

/**
 * Recalculate contribution if target amount changes
 */
export function recalculateWithNewAmount(
  originalCalculation: ContributionCalculation,
  newTargetAmount: number,
  currentBalance: number = 0
): ContributionCalculation {
  const remainingAmount = Math.max(0, newTargetAmount - currentBalance);
  const requiredPerCycle = originalCalculation.cyclesRemaining > 0 
    ? remainingAmount / originalCalculation.cyclesRemaining 
    : 0;
  const requiredPerDay = originalCalculation.daysRemaining > 0 
    ? remainingAmount / originalCalculation.daysRemaining 
    : 0;

  const scheduleLabel = originalCalculation.schedule === 'daily' ? 'day' :
                        originalCalculation.schedule === 'weekly' ? 'week' :
                        originalCalculation.schedule === 'biweekly' ? '2 weeks' :
                        'month';

  // We need the end date for the message, but we don't have it here
  // So we'll create a generic message
  const formattedAmount = Math.ceil(requiredPerCycle).toLocaleString('en-US');
  const message = `You must set aside ₦${formattedAmount} every ${scheduleLabel} to reach your target.`;

  return {
    ...originalCalculation,
    requiredPerCycle: Math.ceil(requiredPerCycle),
    requiredPerDay: Math.ceil(requiredPerDay),
    message,
  };
}
