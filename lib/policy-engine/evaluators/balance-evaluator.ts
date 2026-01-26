/**
 * Balance Evaluator
 * 
 * Evaluates balance-based policy rules and restrictions.
 */

import { PolicyCondition, PolicyDecision, RestrictionCheck, RestrictionType, RestrictionValue } from '../types';

export interface BalanceContext {
  current_balance: number;
  available_balance: number;
  locked_balance: number;
  transaction_amount: number;
}

export function evaluateBalanceCondition(
  condition: PolicyCondition,
  context: BalanceContext
): boolean {
  const { type, operator, value, field } = condition;
  
  if (type !== 'balance') {
    return false;
  }

  // Determine which balance field to check
  const balanceField = field === 'available' 
    ? context.available_balance 
    : field === 'locked'
    ? context.locked_balance
    : context.current_balance;

  const compareValue = typeof value === 'number' ? value : 0;

  switch (operator) {
    case 'gt':
      return balanceField > compareValue;
    case 'gte':
      return balanceField >= compareValue;
    case 'lt':
      return balanceField < compareValue;
    case 'lte':
      return balanceField <= compareValue;
    case 'eq':
      return balanceField === compareValue;
    case 'neq':
      return balanceField !== compareValue;
    default:
      return false;
  }
}

export function checkBalanceRestrictions(
  restrictions: Array<{ type: RestrictionType; value: RestrictionValue }>,
  context: BalanceContext
): RestrictionCheck[] {
  const checks: RestrictionCheck[] = [];

  for (const restriction of restrictions) {
    let passed = true;
    let message: string | undefined;
    let violationValue: any;

    switch (restriction.type) {
      case 'max_balance':
        if (restriction.value.amount !== undefined) {
          const maxBalance = restriction.value.amount;
          if (context.current_balance > maxBalance) {
            passed = false;
            message = `Balance exceeds maximum allowed: ${maxBalance}`;
            violationValue = context.current_balance;
          }
        }
        break;

      case 'min_balance':
        if (restriction.value.amount !== undefined) {
          const minBalance = restriction.value.amount;
          if (context.current_balance < minBalance) {
            passed = false;
            message = `Balance below minimum required: ${minBalance}`;
            violationValue = context.current_balance;
          }
        }
        break;

      case 'transaction_limit':
        if (restriction.value.amount !== undefined) {
          const maxTransaction = restriction.value.amount;
          if (context.transaction_amount > maxTransaction) {
            passed = false;
            message = `Transaction amount exceeds limit: ${maxTransaction}`;
            violationValue = context.transaction_amount;
          }
        }
        break;

      case 'withdrawal_limit':
        if (restriction.value.amount !== undefined) {
          const maxWithdrawal = restriction.value.amount;
          if (context.transaction_amount > maxWithdrawal) {
            passed = false;
            message = `Withdrawal amount exceeds limit: ${maxWithdrawal}`;
            violationValue = context.transaction_amount;
          }
        }
        break;
    }

    checks.push({
      restriction_id: '', // Will be set by caller
      restriction_type: restriction.type,
      passed,
      message,
      violation_value: violationValue,
    });
  }

  return checks;
}
