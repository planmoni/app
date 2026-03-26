/**
 * Plan Allocation Engine
 * Allocates income to expense plans based on priority and funding method
 */

export interface Plan {
  id: string;
  priority: 'high' | 'medium' | 'low';
  funding_method: 'auto' | 'manual' | 'hybrid';
  auto_fund_minimum?: number;
  required_per_cycle: number;
  current_balance: number;
  total_budget: number;
  is_paused: boolean;
}

export interface AllocationResult {
  plan_id: string;
  allocated_amount: number;
  status: 'full' | 'partial' | 'none';
}

export interface AllocationSummary {
  income_received: number;
  mandatory_expenses: number;
  plans_funded: AllocationResult[];
  free_to_spend: number;
  insufficient_income: boolean;
  required_adjustment?: {
    total_required: number;
    available: number;
    shortfall: number;
  };
}

/**
 * Allocate income to plans
 */
export function allocateToPlans(
  income: number,
  plans: Plan[],
  mandatoryExpenses: number = 0
): AllocationSummary {
  // Deduct mandatory expenses first
  let available = income - mandatoryExpenses;
  
  if (available < 0) {
    // Not enough for mandatory expenses
    return {
      income_received: income,
      mandatory_expenses: mandatoryExpenses,
      plans_funded: [],
      free_to_spend: 0,
      insufficient_income: true,
      required_adjustment: {
        total_required: mandatoryExpenses,
        available: income,
        shortfall: Math.abs(available),
      },
    };
  }

  // Filter active plans that need funding
  const activePlans = plans.filter(plan => 
    !plan.is_paused && 
    plan.funding_method !== 'manual' &&
    plan.current_balance < plan.total_budget
  );

  // Sort by priority (high -> medium -> low)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  activePlans.sort((a, b) => 
    priorityOrder[b.priority] - priorityOrder[a.priority]
  );

  const allocations: AllocationResult[] = [];
  let remaining = available;

  // Calculate total required
  let totalRequired = 0;
  for (const plan of activePlans) {
    const needed = plan.total_budget - plan.current_balance;
    const required = plan.funding_method === 'hybrid' 
      ? Math.max(plan.auto_fund_minimum || 0, plan.required_per_cycle)
      : plan.required_per_cycle;
    
    if (needed > 0) {
      totalRequired += Math.min(required, needed);
    }
  }

  // Allocate by priority
  for (const plan of activePlans) {
    if (remaining <= 0) break;

    const needed = plan.total_budget - plan.current_balance;
    if (needed <= 0) continue;

    let amountToAllocate = 0;

    if (plan.funding_method === 'auto') {
      // Allocate required per cycle (or remaining needed, whichever is less)
      amountToAllocate = Math.min(plan.required_per_cycle, needed, remaining);
    } else if (plan.funding_method === 'hybrid') {
      // Allocate minimum auto-fund amount
      const minimum = plan.auto_fund_minimum || 0;
      amountToAllocate = Math.min(minimum, needed, remaining);
    }

    if (amountToAllocate > 0) {
      allocations.push({
        plan_id: plan.id,
        allocated_amount: amountToAllocate,
        status: amountToAllocate >= plan.required_per_cycle ? 'full' : 'partial',
      });
      remaining -= amountToAllocate;
    }
  }

  const insufficient = totalRequired > available;

  return {
    income_received: income,
    mandatory_expenses: mandatoryExpenses,
    plans_funded: allocations,
    free_to_spend: remaining,
    insufficient_income: insufficient,
    ...(insufficient && {
      required_adjustment: {
        total_required: totalRequired,
        available: available,
        shortfall: totalRequired - available,
      },
    }),
  };
}

/**
 * Get allocation message for user
 */
export function getAllocationMessage(summary: AllocationSummary): string {
  if (summary.insufficient_income && summary.required_adjustment) {
    const { total_required, available, shortfall } = summary.required_adjustment;
    return `Your plans require ₦${total_required.toLocaleString('en-US')}. You only have ₦${available.toLocaleString('en-US')}. Reduce allocations or edit deadlines.`;
  }

  const plansCount = summary.plans_funded.length;
  const totalAllocated = summary.plans_funded.reduce((sum, a) => sum + a.allocated_amount, 0);

  return `Income received: ₦${summary.income_received.toLocaleString('en-US')}\n` +
         `Mandatory: ₦${summary.mandatory_expenses.toLocaleString('en-US')}\n` +
         `Plans funded: ${plansCount} plan${plansCount !== 1 ? 's' : ''} (₦${totalAllocated.toLocaleString('en-US')})\n` +
         `Free to spend: ₦${summary.free_to_spend.toLocaleString('en-US')}`;
}
