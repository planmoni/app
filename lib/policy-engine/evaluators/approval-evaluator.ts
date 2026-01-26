/**
 * Approval Evaluator
 * 
 * Determines if a transaction requires approval based on policies and restrictions.
 */

import { PolicyDecision, RestrictionCheck, RestrictionType, RestrictionValue } from '../types';

export interface ApprovalContext {
  amount: number;
  transaction_type: string;
  purpose?: string;
  wallet_requires_approval?: boolean;
}

export function evaluateApprovalRequirement(
  restrictions: Array<{ type: RestrictionType; value: RestrictionValue }>,
  context: ApprovalContext
): { requires_approval: boolean; workflow_id?: string; threshold?: number } {
  // Check if wallet has global approval requirement
  if (context.wallet_requires_approval) {
    return { requires_approval: true };
  }

  // Check approval_required restrictions
  for (const restriction of restrictions) {
    if (restriction.type === 'approval_required') {
      const threshold = restriction.value.threshold;
      
      // If threshold is set and amount exceeds it, require approval
      if (threshold !== undefined && context.amount >= threshold) {
        return {
          requires_approval: true,
          workflow_id: restriction.value.workflow_id,
          threshold,
        };
      }
      
      // If no threshold but workflow_id is set, always require approval
      if (threshold === undefined && restriction.value.workflow_id) {
        return {
          requires_approval: true,
          workflow_id: restriction.value.workflow_id,
        };
      }
    }
  }

  return { requires_approval: false };
}

export function checkApprovalRestriction(
  restriction: { type: RestrictionType; value: RestrictionValue },
  context: ApprovalContext
): RestrictionCheck {
  let passed = true;
  let message: string | undefined;

  if (restriction.type === 'approval_required') {
    const threshold = restriction.value.threshold;
    
    if (threshold !== undefined && context.amount >= threshold) {
      passed = false;
      message = `Amount ${context.amount} exceeds approval threshold ${threshold}`;
    } else if (threshold === undefined) {
      // Always requires approval
      passed = false;
      message = 'Approval required for this transaction';
    }
  }

  return {
    restriction_id: '',
    restriction_type: restriction.type,
    passed,
    message,
  };
}
