/**
 * Plan Progress Engine
 * Calculates plan progress and health status
 */

import { ExpensePlan } from '@/types/expense-planner';

export interface PlanProgressResult {
  status: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  percentageFunded: number;
  percentageBehind: number;
  daysRemaining: number;
  requiredPerCycle: number;
  requiredPerDay: number;
  recommendedAction: string;
  requiredAdjustment: {
    increaseBy?: number;
    extendByDays?: number;
  };
}

/**
 * Calculate plan progress and health
 */
export function calculatePlanProgress(plan: ExpensePlan): PlanProgressResult {
  const currentBalance = (plan as any).current_balance || 0;
  const targetAmount = plan.total_budget;
  const percentageFunded = targetAmount > 0 ? (currentBalance / targetAmount) * 100 : 0;

  // Calculate time-based progress
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!plan.start_date || !plan.end_date) {
    // Ongoing plan - can't calculate progress
    return {
      status: 'on_track',
      percentageFunded,
      percentageBehind: 0,
      daysRemaining: 0,
      requiredPerCycle: (plan as any).required_per_cycle || 0,
      requiredPerDay: (plan as any).required_per_day || 0,
      recommendedAction: 'Ongoing plan - continue regular contributions.',
      requiredAdjustment: {},
    };
  }

  const startDate = new Date(plan.start_date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(plan.end_date);
  endDate.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate expected progress based on timeline
  const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const actualProgress = percentageFunded;
  const percentageBehind = Math.max(0, expectedProgress - actualProgress);

  // Calculate required going forward
  const remainingAmount = Math.max(0, targetAmount - currentBalance);
  const payoutSchedule = (plan as any).payout_schedule || 'weekly';
  
  let cyclesRemaining = 0;
  if (payoutSchedule === 'daily') {
    cyclesRemaining = Math.max(1, daysRemaining);
  } else if (payoutSchedule === 'weekly') {
    cyclesRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  } else if (payoutSchedule === 'biweekly') {
    cyclesRemaining = Math.max(1, Math.ceil(daysRemaining / 14));
  } else if (payoutSchedule === 'monthly') {
    cyclesRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
  }

  const requiredPerCycle = cyclesRemaining > 0 ? remainingAmount / cyclesRemaining : 0;
  const requiredPerDay = daysRemaining > 0 ? remainingAmount / daysRemaining : 0;

  // Determine health status
  let status: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  let recommendedAction: string;
  let requiredAdjustment: { increaseBy?: number; extendByDays?: number } = {};

  if (percentageBehind < 5) {
    status = 'on_track';
    recommendedAction = 'Plan is on track. Continue as planned.';
  } else if (percentageBehind < 20) {
    status = 'slightly_behind';
    const increaseBy = Math.ceil(requiredPerCycle * 0.1); // 10% increase
    const extendByDays = Math.ceil(percentageBehind / 100 * daysRemaining);
    recommendedAction = `You are ${Math.round(percentageBehind)}% behind. Increase weekly allocation by ₦${increaseBy.toLocaleString('en-US')} or extend your deadline by ${extendByDays} days.`;
    requiredAdjustment = { increaseBy, extendByDays };
  } else if (percentageBehind < 50) {
    status = 'at_risk';
    const increaseBy = Math.ceil(requiredPerCycle * 0.25); // 25% increase
    const extendByDays = Math.ceil(percentageBehind / 100 * daysRemaining);
    recommendedAction = `You are ${Math.round(percentageBehind)}% behind. Significantly increase your contribution by ₦${increaseBy.toLocaleString('en-US')} per ${payoutSchedule === 'daily' ? 'day' : payoutSchedule === 'weekly' ? 'week' : payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or extend by ${Math.ceil(extendByDays / 7)} weeks.`;
    requiredAdjustment = { increaseBy, extendByDays };
  } else {
    status = 'unachievable';
    const increaseBy = Math.ceil(requiredPerCycle * 0.5); // 50% increase
    const extendByDays = Math.ceil(percentageBehind / 100 * daysRemaining);
    recommendedAction = `You are ${Math.round(percentageBehind)}% behind. This plan cannot be completed by the selected date. Increase your contribution by ₦${increaseBy.toLocaleString('en-US')} per ${payoutSchedule === 'daily' ? 'day' : payoutSchedule === 'weekly' ? 'week' : payoutSchedule === 'biweekly' ? '2 weeks' : 'month'} or extend by ${Math.ceil(extendByDays / 30)} months.`;
    requiredAdjustment = { increaseBy, extendByDays };
  }

  // Check if plan is actually unachievable based on required vs available
  // This would need user income data - for now, we'll use the percentage-based calculation

  return {
    status,
    percentageFunded,
    percentageBehind,
    daysRemaining,
    requiredPerCycle: Math.ceil(requiredPerCycle),
    requiredPerDay: Math.ceil(requiredPerDay),
    recommendedAction,
    requiredAdjustment,
  };
}

/**
 * Update plan health status in database
 */
export async function updatePlanHealth(planId: string, progressResult: PlanProgressResult): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  
  // Insert new health record
  await supabase
    .from('plan_health')
    .insert({
      plan_id: planId,
      status: progressResult.status,
      percentage_behind: progressResult.percentageBehind,
      recommended_action: progressResult.recommendedAction,
      required_adjustment: progressResult.requiredAdjustment,
    });

  // Update plan health_status
  await supabase
    .from('expense_plans')
    .update({
      health_status: progressResult.status,
    })
    .eq('id', planId);
}
