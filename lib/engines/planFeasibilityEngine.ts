/**
 * Plan Feasibility Engine
 * Validates if a plan can be achieved with current income/obligations
 */

export interface PlanConfig {
  targetAmount: number;
  startDate: Date;
  endDate: Date | null;
  requiredPerCycle: number;
  payoutSchedule: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  currentBalance: number;
}

export interface UserFinancials {
  monthlyIncome: number;
  mandatoryExpenses: number;
  availableForPlans: number;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  status: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  percentageBehind: number;
  recommendedAction: string;
  requiredAdjustment: {
    increaseBy?: number;
    extendByDays?: number;
  };
  message: string;
}

/**
 * Calculate plan feasibility
 */
export function checkPlanFeasibility(
  plan: PlanConfig,
  userFinancials: UserFinancials
): FeasibilityResult {
  if (!plan.endDate) {
    // Ongoing plans - check if current income can sustain required per cycle
    const cyclesPerMonth = getCyclesPerMonth(plan.payoutSchedule);
    const requiredPerMonth = plan.requiredPerCycle * cyclesPerMonth;
    
    if (requiredPerMonth > userFinancials.availableForPlans) {
      const shortfall = requiredPerMonth - userFinancials.availableForPlans;
      return {
        isFeasible: false,
        status: 'unachievable',
        percentageBehind: 100,
        recommendedAction: `Increase monthly income by ₦${Math.ceil(shortfall).toLocaleString('en-US')} or reduce required contribution.`,
        requiredAdjustment: {
          increaseBy: Math.ceil(shortfall / cyclesPerMonth),
        },
        message: `With your income and current obligations, this plan cannot be sustained. Increase your contribution by ₦${Math.ceil(shortfall / cyclesPerMonth).toLocaleString('en-US')} per ${plan.payoutSchedule === 'daily' ? 'day' : plan.payoutSchedule === 'weekly' ? 'week' : plan.payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or increase your income.`,
      };
    }

    return {
      isFeasible: true,
      status: 'on_track',
      percentageBehind: 0,
      recommendedAction: 'Plan is feasible. Continue as planned.',
      requiredAdjustment: {},
      message: 'Your plan is achievable with your current income structure.',
    };
  }

  // Calculate remaining amount needed
  const remainingAmount = Math.max(0, plan.targetAmount - plan.currentBalance);
  
  // Calculate days remaining
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(plan.endDate);
  endDate.setHours(0, 0, 0, 0);
  
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining <= 0) {
    return {
      isFeasible: false,
      status: 'unachievable',
      percentageBehind: 100,
      recommendedAction: 'Deadline has passed. Please extend the deadline.',
      requiredAdjustment: {
        extendByDays: 30, // Suggest 30 days extension
      },
      message: 'This plan deadline has passed. Please extend the deadline.',
    };
  }

  // Calculate cycles remaining
  const cyclesRemaining = getCyclesUntilDeadline(today, endDate, plan.payoutSchedule);
  
  // Calculate total required based on cycles
  const totalRequired = plan.requiredPerCycle * cyclesRemaining;
  
  // Calculate if user can afford this
  const cyclesPerMonth = getCyclesPerMonth(plan.payoutSchedule);
  const requiredPerMonth = plan.requiredPerCycle * cyclesPerMonth;
  
  // Check if monthly requirement exceeds available
  if (requiredPerMonth > userFinancials.availableForPlans) {
    const shortfall = requiredPerMonth - userFinancials.availableForPlans;
    const increaseBy = Math.ceil(shortfall / cyclesPerMonth);
    const extendByDays = Math.ceil((shortfall * 30) / (userFinancials.availableForPlans / cyclesPerMonth));
    
    return {
      isFeasible: false,
      status: 'unachievable',
      percentageBehind: 100,
      recommendedAction: `Increase contribution by ₦${increaseBy.toLocaleString('en-US')} per ${plan.payoutSchedule === 'daily' ? 'day' : plan.payoutSchedule === 'weekly' ? 'week' : plan.payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or extend deadline by ${extendByDays} days.`,
      requiredAdjustment: {
        increaseBy,
        extendByDays,
      },
      message: `With your income and current obligations, this plan cannot be completed by the selected date. Increase your contribution by ₦${increaseBy.toLocaleString('en-US')} per ${plan.payoutSchedule === 'daily' ? 'day' : plan.payoutSchedule === 'weekly' ? 'week' : plan.payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or extend by ${Math.ceil(extendByDays / 30)} months.`,
    };
  }

  // Check if total required exceeds remaining amount (plan is overfunded or on track)
  if (totalRequired >= remainingAmount) {
    // Check if on track based on timeline
    const expectedProgress = (today.getTime() - new Date(plan.startDate).getTime()) / (endDate.getTime() - new Date(plan.startDate).getTime());
    const actualProgress = plan.currentBalance / plan.targetAmount;
    
    const percentageBehind = Math.max(0, (expectedProgress - actualProgress) * 100);
    
    if (percentageBehind < 5) {
      return {
        isFeasible: true,
        status: 'on_track',
        percentageBehind: 0,
        recommendedAction: 'Plan is on track. Continue as planned.',
        requiredAdjustment: {},
        message: 'Your plan is progressing well. Keep it up!',
      };
    } else if (percentageBehind < 20) {
      return {
        isFeasible: true,
        status: 'slightly_behind',
        percentageBehind,
        recommendedAction: `You are ${Math.round(percentageBehind)}% behind. Consider increasing your contribution slightly.`,
        requiredAdjustment: {
          increaseBy: Math.ceil(plan.requiredPerCycle * 0.1), // 10% increase
        },
        message: `You are ${Math.round(percentageBehind)}% behind schedule. Increase weekly allocation by ₦${Math.ceil(plan.requiredPerCycle * 0.1).toLocaleString('en-US')} or extend your deadline by ${Math.ceil(percentageBehind / 100 * daysRemaining)} days.`,
      };
    } else if (percentageBehind < 50) {
      return {
        isFeasible: true,
        status: 'at_risk',
        percentageBehind,
        recommendedAction: `You are ${Math.round(percentageBehind)}% behind. Significantly increase your contribution or extend the deadline.`,
        requiredAdjustment: {
          increaseBy: Math.ceil(plan.requiredPerCycle * 0.25), // 25% increase
          extendByDays: Math.ceil(percentageBehind / 100 * daysRemaining),
        },
        message: `You are ${Math.round(percentageBehind)}% behind. Increase weekly allocation by ₦${Math.ceil(plan.requiredPerCycle * 0.25).toLocaleString('en-US')} or extend your deadline by ${Math.ceil(percentageBehind / 100 * daysRemaining)} days.`,
      };
    } else {
      return {
        isFeasible: false,
        status: 'unachievable',
        percentageBehind,
        recommendedAction: `You are ${Math.round(percentageBehind)}% behind. This plan may not be achievable.`,
        requiredAdjustment: {
          increaseBy: Math.ceil(plan.requiredPerCycle * 0.5), // 50% increase
          extendByDays: Math.ceil(percentageBehind / 100 * daysRemaining),
        },
        message: `You are ${Math.round(percentageBehind)}% behind. This plan cannot be completed by the selected date. Increase your contribution by ₦${Math.ceil(plan.requiredPerCycle * 0.5).toLocaleString('en-US')} per ${plan.payoutSchedule === 'daily' ? 'day' : plan.payoutSchedule === 'weekly' ? 'week' : plan.payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or extend by ${Math.ceil(percentageBehind / 100 * daysRemaining)} days.`,
      };
    }
  }

  // If we get here, plan seems feasible
  return {
    isFeasible: true,
    status: 'on_track',
    percentageBehind: 0,
    recommendedAction: 'Plan is feasible. Continue as planned.',
    requiredAdjustment: {},
    message: 'Your plan is achievable with your current income structure.',
  };
}

function getCyclesPerMonth(schedule: 'daily' | 'weekly' | 'biweekly' | 'monthly'): number {
  switch (schedule) {
    case 'daily':
      return 30;
    case 'weekly':
      return 4;
    case 'biweekly':
      return 2;
    case 'monthly':
      return 1;
    default:
      return 4;
  }
}

function getCyclesUntilDeadline(
  startDate: Date,
  endDate: Date,
  schedule: 'daily' | 'weekly' | 'biweekly' | 'monthly'
): number {
  const daysRemaining = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  switch (schedule) {
    case 'daily':
      return Math.max(1, daysRemaining);
    case 'weekly':
      return Math.max(1, Math.ceil(daysRemaining / 7));
    case 'biweekly':
      return Math.max(1, Math.ceil(daysRemaining / 14));
    case 'monthly':
      return Math.max(1, Math.ceil(daysRemaining / 30));
    default:
      return 1;
  }
}
