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
 * New order: plan-details -> amount -> dates -> buckets -> fund-budget -> name-expense
 */
export function getDraftResumeStep(plan: {
  id: string;
  buckets?: Array<any>;
  start_date?: string | null;
  end_date?: string | null;
  total_locked?: number;
  name?: string;
  total_budget?: number;
}): string {
  // If no budget, resume at amount page (expense-planner/index)
  if (!plan.total_budget || plan.total_budget === 0) {
    return '/expense-planner';
  }

  // If no buckets, resume at plan-details (category selection)
  if (!plan.buckets || plan.buckets.length === 0) {
    return '/expense-planner/create/plan-details';
  }

  // If budget and buckets exist but no dates, resume at dates
  if (!plan.start_date || !plan.end_date) {
    return '/expense-planner/create/dates';
  }

  // If dates exist but no locked funds, resume at fund-budget
  if (!plan.total_locked || plan.total_locked === 0) {
    return '/expense-planner/create/fund-budget';
  }

  // If locked funds but name is missing or "Untitled Plan", resume at name-expense
  if (!plan.name || plan.name === 'Untitled Plan') {
    return '/expense-planner/create/name-expense';
  }

  // Otherwise, go to the plan detail page
  return `/expense-planner/${plan.id}`;
}

