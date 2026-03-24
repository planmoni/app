/**
 * Plan Insights Calculator
 * Generates insights about user's expense plan behavior
 */

import { ExpensePlan } from '@/types/expense-planner';

export interface PlanInsight {
  type: 'completion_rate' | 'underfunding' | 'overspending' | 'income_allocation' | 'goals_completed';
  title: string;
  description: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
}

export interface PlanInsights {
  completionRate: {
    alwaysFinish: number;
    completionPercentage: number;
  };
  underfunding: {
    repeatedUnderfunded: number;
    categories: string[];
  };
  overspending: {
    chronicOverspending: number;
    categories: string[];
  };
  incomeAllocation: {
    percentage: number;
    totalAllocated: number;
  };
  goalsCompleted: {
    last12Months: number;
    totalCompleted: number;
  };
}

/**
 * Calculate plan insights
 */
export function calculatePlanInsights(plans: ExpensePlan[]): PlanInsights {
  const completedPlans = plans.filter(p => p.status === 'completed');
  const activePlans = plans.filter(p => p.status === 'active');
  const archivedPlans = plans.filter(p => p.status === 'archived');
  
  // Calculate completion rate
  const totalNonDraftPlans = completedPlans.length + activePlans.length + archivedPlans.length;
  const completionPercentage = totalNonDraftPlans > 0 
    ? (completedPlans.length / totalNonDraftPlans) * 100 
    : 0;
  
  // Plans that always finish (completed plans that reached 100% of target)
  const alwaysFinish = completedPlans.filter(p => {
    const percentage = p.total_budget > 0 ? (p.total_spent / p.total_budget) * 100 : 0;
    return percentage >= 100;
  }).length;

  // Underfunded plans (active plans with low balance)
  const underfundedPlans = activePlans.filter(p => {
    const currentBalance = (p as any).current_balance || 0;
    const percentageFunded = p.total_budget > 0 ? (currentBalance / p.total_budget) * 100 : 0;
    return percentageFunded < 50; // Less than 50% funded
  });

  // Get categories from underfunded plans
  const underfundedCategories = new Set<string>();
  underfundedPlans.forEach(plan => {
    plan.buckets?.forEach(bucket => {
      underfundedCategories.add(bucket.category_id);
    });
  });

  // Overspending (plans where spent > budget)
  const overspentPlans = plans.filter(p => p.total_spent > p.total_budget);
  const overspentCategories = new Set<string>();
  overspentPlans.forEach(plan => {
    plan.buckets?.forEach(bucket => {
      if (bucket.amount_spent > bucket.target_amount) {
        overspentCategories.add(bucket.category_id);
      }
    });
  });

  // Income allocation
  const totalAllocated = activePlans.reduce((sum, plan) => {
    const requiredPerCycle = (plan as any).required_per_cycle || 0;
    const payoutSchedule = (plan as any).payout_schedule || 'weekly';
    const cyclesPerMonth = payoutSchedule === 'daily' ? 30 :
                           payoutSchedule === 'weekly' ? 4 :
                           payoutSchedule === 'biweekly' ? 2 : 1;
    return sum + (requiredPerCycle * cyclesPerMonth);
  }, 0);

  // Goals completed in last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const goalsCompletedLast12Months = completedPlans.filter(p => {
    const completedDate = new Date(p.updated_at || p.created_at);
    return completedDate >= twelveMonthsAgo;
  }).length;

  return {
    completionRate: {
      alwaysFinish,
      completionPercentage,
    },
    underfunding: {
      repeatedUnderfunded: underfundedPlans.length,
      categories: Array.from(underfundedCategories),
    },
    overspending: {
      chronicOverspending: overspentPlans.length,
      categories: Array.from(overspentCategories),
    },
    incomeAllocation: {
      percentage: 0, // Will be calculated with actual income
      totalAllocated,
    },
    goalsCompleted: {
      last12Months: goalsCompletedLast12Months,
      totalCompleted: completedPlans.length,
    },
  };
}

/**
 * Generate insight messages
 */
export function generateInsightMessages(insights: PlanInsights, monthlyIncome?: number): PlanInsight[] {
  const messages: PlanInsight[] = [];

  // Completion rate
  if (insights.completionRate.completionPercentage > 0) {
    messages.push({
      type: 'completion_rate',
      title: 'Plans staying on budget',
      description: `${insights.completionRate.alwaysFinish} plan${insights.completionRate.alwaysFinish !== 1 ? 's' : ''} stayed within budget pace`,
      value: `${Math.round(insights.completionRate.completionPercentage)}%`,
      trend: insights.completionRate.completionPercentage >= 80 ? 'up' : 'down',
    });
  }

  // Underfunding
  if (insights.underfunding.repeatedUnderfunded > 0) {
    messages.push({
      type: 'underfunding',
      title: 'Budgets at risk',
      description: `${insights.underfunding.repeatedUnderfunded} budget${insights.underfunding.repeatedUnderfunded !== 1 ? 's' : ''} often fall behind pace`,
      value: insights.underfunding.repeatedUnderfunded,
      trend: 'down',
    });
  }

  // Overspending
  if (insights.overspending.chronicOverspending > 0) {
    messages.push({
      type: 'overspending',
      title: 'Overspending categories',
      description: `Chronic overspending in: ${insights.overspending.categories.slice(0, 3).join(', ')}`,
      value: insights.overspending.chronicOverspending,
      trend: 'down',
    });
  }

  // Income allocation
  if (monthlyIncome && insights.incomeAllocation.totalAllocated > 0) {
    const percentage = (insights.incomeAllocation.totalAllocated / monthlyIncome) * 100;
    messages.push({
      type: 'income_allocation',
      title: 'Income to structured budgets',
      description: `Share of income dedicated to category budgets`,
      value: `${Math.round(percentage)}%`,
      trend: percentage > 30 ? 'up' : 'stable',
    });
  }

  // Goals completed
  if (insights.goalsCompleted.totalCompleted > 0) {
    messages.push({
      type: 'goals_completed',
      title: 'Goals Completed',
      description: `Number of goals completed in last 12 months`,
      value: insights.goalsCompleted.last12Months,
      trend: 'up',
    });
  }

  return messages;
}
