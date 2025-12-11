/**
 * Daily Spend Guidance Calculator
 * Integrates expense plans into daily spending allowance calculations
 */

import { ExpensePlan } from '@/types/expense-planner';

export interface DailyAllowanceResult {
  dailyAllowance: number;
  freeToSpendPool: number;
  requiredFutureAllocations: number;
  flexiblePlanHeadroom: number;
  message: string;
  consequences?: {
    overspent: boolean;
    overspentAmount: number;
    affectedPlans: Array<{
      planId: string;
      planName: string;
      deadlineShiftDays: number;
    }>;
  };
}

/**
 * Calculate daily spending allowance with plan integration
 */
export function calculateDailyAllowance(
  freeToSpendPool: number,
  remainingDays: number,
  plans: ExpensePlan[],
  currentSpending: number = 0
): DailyAllowanceResult {
  // Calculate required future allocations from active plans
  const activePlans = plans.filter(plan => 
    plan.status === 'active' &&
    !(plan as any).is_paused &&
    (plan as any).funding_method !== 'manual' &&
    (plan as any).current_balance < plan.total_budget
  );

  let requiredFutureAllocations = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const plan of activePlans) {
    if (!plan.end_date) continue; // Skip ongoing plans for now

    const endDate = new Date(plan.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    if (endDate <= today) continue; // Skip expired plans

    const daysUntilDeadline = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const needed = plan.total_budget - ((plan as any).current_balance || 0);
    
    if (needed > 0 && daysUntilDeadline > 0) {
      // Calculate required per day for this plan
      const requiredPerDay = needed / daysUntilDeadline;
      requiredFutureAllocations += requiredPerDay;
    }
  }

  // Calculate flexible plan headroom (plans that are ahead of schedule)
  let flexiblePlanHeadroom = 0;
  for (const plan of activePlans) {
    if (!plan.end_date) continue;

    const endDate = new Date(plan.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    if (endDate <= today) continue;

    const daysUntilDeadline = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const currentBalance = (plan as any).current_balance || 0;
    const requiredPerDay = (plan as any).required_per_day || 0;
    
    // If plan is ahead (current balance > expected balance based on timeline)
    const expectedBalance = requiredPerDay * (plan.start_date 
      ? Math.max(0, Math.ceil((today.getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24)))
      : 0);
    
    if (currentBalance > expectedBalance && daysUntilDeadline > 0) {
      // Calculate headroom (excess balance / remaining days)
      const excess = currentBalance - expectedBalance;
      flexiblePlanHeadroom += excess / daysUntilDeadline;
    }
  }

  // Calculate daily allowance
  const baseAllowance = remainingDays > 0 ? freeToSpendPool / remainingDays : 0;
  const dailyAllowance = baseAllowance - requiredFutureAllocations + flexiblePlanHeadroom;

  // Check for overspending consequences
  const overspent = currentSpending > dailyAllowance;
  const overspentAmount = overspent ? currentSpending - dailyAllowance : 0;
  
  let affectedPlans: Array<{ planId: string; planName: string; deadlineShiftDays: number }> = [];
  
  if (overspent && overspentAmount > 0) {
    // Calculate how overspending affects each plan
    for (const plan of activePlans) {
      if (!plan.end_date) continue;

      const endDate = new Date(plan.end_date);
      const daysUntilDeadline = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const requiredPerDay = (plan as any).required_per_day || 0;
      
      if (requiredPerDay > 0) {
        // Calculate how many days the deadline needs to shift
        const deadlineShiftDays = Math.ceil(overspentAmount / requiredPerDay);
        affectedPlans.push({
          planId: plan.id,
          planName: plan.name,
          deadlineShiftDays,
        });
      }
    }
  }

  const message = dailyAllowance >= 0
    ? `You can spend ₦${Math.max(0, Math.floor(dailyAllowance)).toLocaleString('en-US')} today without affecting any plan.`
    : `Your daily spending exceeds your allowance by ₦${Math.abs(Math.floor(dailyAllowance)).toLocaleString('en-US')}.`;

  return {
    dailyAllowance: Math.max(0, dailyAllowance),
    freeToSpendPool,
    requiredFutureAllocations,
    flexiblePlanHeadroom,
    message,
    ...(overspent && {
      consequences: {
        overspent: true,
        overspentAmount,
        affectedPlans,
      },
    }),
  };
}

/**
 * Recalculate consequences after overspending
 */
export function recalculateConsequences(
  overspentAmount: number,
  plans: ExpensePlan[]
): string {
  if (overspentAmount <= 0) return '';

  const activePlans = plans.filter(plan => 
    plan.status === 'active' &&
    !(plan as any).is_paused &&
    plan.end_date
  );

  const consequences: string[] = [];

  for (const plan of activePlans) {
    const requiredPerDay = (plan as any).required_per_day || 0;
    if (requiredPerDay > 0) {
      const deadlineShiftDays = Math.ceil(overspentAmount / requiredPerDay);
      consequences.push(
        `Your ${plan.name} plan deadline will shift by ${deadlineShiftDays} day${deadlineShiftDays !== 1 ? 's' : ''} unless you adjust.`
      );
    }
  }

  if (consequences.length === 0) {
    return `You overspent by ₦${overspentAmount.toLocaleString('en-US')}. Consider adjusting your plans.`;
  }

  return `You overspent by ₦${overspentAmount.toLocaleString('en-US')}. ${consequences.join(' ')}`;
}
