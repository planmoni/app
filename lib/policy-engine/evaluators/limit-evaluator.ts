/**
 * Limit Evaluator
 * 
 * Evaluates transaction limit and frequency-based restrictions.
 */

import { PolicyCondition, RestrictionCheck, RestrictionType, RestrictionValue } from '../types';

export interface LimitContext {
  transaction_amount: number;
  daily_total?: number;
  weekly_total?: number;
  monthly_total?: number;
  transaction_count_today?: number;
}

export function evaluateLimitCondition(
  condition: PolicyCondition,
  context: LimitContext
): boolean {
  const { type, operator, value } = condition;

  if (type !== 'amount' && type !== 'frequency') {
    return false;
  }

  let compareValue: number;
  let fieldValue: number;

  if (type === 'amount') {
    fieldValue = context.transaction_amount;
    compareValue = typeof value === 'number' ? value : 0;
  } else {
    // Frequency-based: use daily_total, weekly_total, or monthly_total
    const period = condition.field || 'daily';
    fieldValue = 
      period === 'weekly' ? (context.weekly_total || 0) :
      period === 'monthly' ? (context.monthly_total || 0) :
      (context.daily_total || 0);
    compareValue = typeof value === 'number' ? value : 0;
  }

  switch (operator) {
    case 'gt':
      return fieldValue > compareValue;
    case 'gte':
      return fieldValue >= compareValue;
    case 'lt':
      return fieldValue < compareValue;
    case 'lte':
      return fieldValue <= compareValue;
    case 'eq':
      return fieldValue === compareValue;
    case 'neq':
      return fieldValue !== compareValue;
    case 'between':
      if (typeof value === 'object' && 'min' in value && 'max' in value) {
        return fieldValue >= value.min && fieldValue <= value.max;
      }
      return false;
    default:
      return false;
  }
}

export function checkDailyLimit(
  restriction: { type: RestrictionType; value: RestrictionValue },
  context: LimitContext
): RestrictionCheck {
  let passed = true;
  let message: string | undefined;
  let violationValue: any;

  if (restriction.type === 'daily_limit' && restriction.value.daily_amount !== undefined) {
    const dailyLimit = restriction.value.daily_amount;
    const currentDaily = context.daily_total || 0;
    const projectedTotal = currentDaily + context.transaction_amount;

    if (projectedTotal > dailyLimit) {
      passed = false;
      message = `Daily limit exceeded: ${dailyLimit}. Current: ${currentDaily}, Requested: ${context.transaction_amount}`;
      violationValue = projectedTotal;
    }
  }

  return {
    restriction_id: '',
    restriction_type: restriction.type,
    passed,
    message,
    violation_value: violationValue,
  };
}
