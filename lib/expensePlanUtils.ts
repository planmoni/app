/**
 * Calculate days remaining until start_date (or end_date if no start_date)
 */
export function getDaysRemaining(startDate: string | undefined, endDate: string | undefined): number | null {
  if (!startDate && !endDate) {
    return null;
  }

  const targetDate = startDate || endDate;
  if (!targetDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calculate duration in days when budget has started
 */
export function getBudgetDuration(startDate: string | undefined, endDate: string | undefined): number | null {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  
  return diffDays;
}

/**
 * Check if budget period has started
 */
export function isBudgetStarted(startDate: string | undefined): boolean {
  if (!startDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  return today >= start;
}

/**
 * Alias for maturity checks in the single-date vault model.
 */
export function isVaultMatured(maturityDate: string | undefined): boolean {
  return isBudgetStarted(maturityDate);
}

/**
 * Format maturity date as "Dec 12, 2025"
 */
export function formatMaturityDate(maturityDate: string | undefined): string | null {
  if (!maturityDate) {
    return null;
  }

  const date = new Date(maturityDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format date range as "Dec 12, 2025 to Dec 22, 2025"
 */
export function formatDateRange(startDate: string | undefined, endDate: string | undefined): string | null {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const startMonth = months[start.getMonth()];
  const startDay = start.getDate();
  const startYear = start.getFullYear();
  
  const endMonth = months[end.getMonth()];
  const endDay = end.getDate();
  const endYear = end.getFullYear();
  
  return `${startMonth} ${startDay}, ${startYear} to ${endMonth} ${endDay}, ${endYear}`;
}

/**
 * Format days remaining text
 */
export function formatDaysRemaining(days: number | null): string | null {
  if (days === null) {
    return null;
  }

  if (days < 0) {
    return `Started ${Math.abs(days)} days ago`;
  }

  if (days === 0) {
    return 'Starts today';
  }

  if (days === 1) {
    return 'in 1 Day';
  }

  return `in ${days} Days`;
}

/**
 * Calculate hours remaining until expiry for unfunded plans (24 hours from creation)
 * @param createdAt - The creation timestamp of the plan
 * @param currentTime - Optional current time (defaults to now)
 */
export function getExpiryHoursRemaining(createdAt: string, currentTime?: Date): number | null {
  if (!createdAt) {
    return null;
  }

  const now = currentTime || new Date();
  const created = new Date(createdAt);
  const expiryTime = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24 hours from creation
  
  const diffTime = expiryTime.getTime() - now.getTime();
  const diffHours = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60)));
  
  return diffHours;
}

/**
 * Format expiry countdown text
 */
export function formatExpiryCountdown(hours: number | null): string | null {
  if (hours === null) {
    return null;
  }

  if (hours <= 0) {
    return 'Expired';
  }

  if (hours < 1) {
    const minutes = Math.ceil(hours * 60);
    return minutes === 1 ? 'Expires in 1 minute' : `Expires in ${minutes} minutes`;
  }

  if (hours === 1) {
    return 'Expires in 1 hour';
  }

  return `Expires in ${hours} hours`;
}

/**
 * Determine the resume step for a draft plan based on what data exists
 * Flow order: plan-details -> amount -> dates -> buckets -> funding-choice -> fund-budget -> name-expense
 * 
 * If last_step is saved in metadata, use that. Otherwise, calculate based on plan data.
 */
export function getDraftResumeStep(plan: {
  id: string;
  buckets?: Array<any>;
  start_date?: string | null;
  end_date?: string | null;
  total_locked?: number;
  name?: string;
  total_budget?: number;
  metadata?: any;
}): string {
  // First, check if last_step is saved in metadata
  if (plan.metadata?.last_step) {
    return plan.metadata.last_step;
  }
  // Step 1: If no budget, resume at amount page (expense-planner/index)
  if (!plan.total_budget || plan.total_budget === 0) {
    return '/expense-planner';
  }

  // Step 2: If no dates, check if we need to go to dates or plan-details
  // If we have budget but no dates, we need dates first
  if (!plan.start_date) {
    // If we have buckets, it means categories were selected, so go to dates
    // If no buckets, go to plan-details to select categories first
    if (!plan.buckets || plan.buckets.length === 0) {
      return '/expense-planner/create/plan-details';
    }
    return '/expense-planner/create/dates';
  }

  // Step 3: If dates exist, check buckets
  // Buckets are only saved when user allocates amounts in buckets screen
  // If no buckets, user needs to go to buckets to allocate amounts
  // But buckets screen requires subCategories, which aren't stored in plan
  // So if no buckets exist, we need to go back to plan-details to re-select categories
  // OR we could go to buckets and let the user re-select there
  // For now, if dates exist but no buckets, go to plan-details to re-select categories
  // (This ensures we have subCategories for the buckets screen)
  if (!plan.buckets || plan.buckets.length === 0) {
    // If dates exist, user went through plan-details already, but buckets weren't saved
    // We need subCategories for buckets screen, so go back to plan-details
    // The plan-details screen will load with existing budget/dates and allow re-selection
    return '/expense-planner/create/plan-details';
  }

  // Check if buckets have been allocated (have target_amount > 0)
  const hasAllocatedBuckets = plan.buckets.some(bucket => 
    bucket.target_amount && bucket.target_amount > 0
  );

  if (!hasAllocatedBuckets) {
    // Buckets exist but have 0 target_amount, go to buckets to allocate
    return '/expense-planner/create/buckets';
  }

  // Step 4: If buckets are allocated but no locked funds, go to funding-choice
  if (!plan.total_locked || plan.total_locked === 0) {
    return '/expense-planner/create/funding-choice';
  }

  // Step 5: If locked funds but name is missing or "Untitled Plan", resume at name-expense
  if (!plan.name || plan.name === 'Untitled Plan') {
    return '/expense-planner/create/name-expense';
  }

  // Otherwise, go to the plan detail page
  return `/expense-planner/${plan.id}`;
}

