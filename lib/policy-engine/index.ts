/**
 * Policy Engine Core
 * 
 * Main policy evaluation engine that controls money access in the
 * Platform-as-a-Service model. All transactions must pass through
 * policy evaluation before execution.
 */

import { PolicyEvaluationResult, PolicyEvaluationContext, PolicyRule, PolicyDecision, PolicyCondition } from './types';
import { evaluateBalanceCondition, checkBalanceRestrictions, BalanceContext } from './evaluators/balance-evaluator';
import { evaluateLimitCondition, checkDailyLimit, LimitContext } from './evaluators/limit-evaluator';
import { evaluateTimeCondition, checkTimeRestriction, TimeContext } from './evaluators/time-evaluator';
import { evaluateApprovalRequirement, ApprovalContext } from './evaluators/approval-evaluator';

export class PolicyEngine {
  /**
   * Evaluate a policy rule against the given context
   */
  private evaluateRule(rule: PolicyRule, context: PolicyEvaluationContext): boolean {
    return this.evaluateCondition(rule.condition, context);
  }

  /**
   * Recursively evaluate a policy condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
    // Handle combined conditions
    if (condition.type === 'combined' && condition.conditions) {
      const results = condition.conditions.map(c => this.evaluateCondition(c, context));
      
      if (condition.logic === 'AND') {
        return results.every(r => r === true);
      } else if (condition.logic === 'OR') {
        return results.some(r => r === true);
      }
      return false;
    }

    // Evaluate based on condition type
    switch (condition.type) {
      case 'balance':
        return evaluateBalanceCondition(condition, {
          current_balance: 0, // Will be populated from wallet
          available_balance: 0,
          locked_balance: 0,
          transaction_amount: context.amount,
        });

      case 'amount':
        return evaluateLimitCondition(condition, {
          transaction_amount: context.amount,
        });

      case 'time':
        return evaluateTimeCondition(condition, {
          current_time: new Date(),
          transaction_time: new Date(),
        });

      case 'frequency':
        return evaluateLimitCondition(condition, {
          transaction_amount: context.amount,
        });

      case 'purpose':
        if (condition.operator === 'in' && Array.isArray(condition.value)) {
          return condition.value.includes(context.purpose || '');
        }
        if (condition.operator === 'not_in' && Array.isArray(condition.value)) {
          return !condition.value.includes(context.purpose || '');
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Evaluate policies and restrictions for a transaction
   */
  async evaluate(
    context: PolicyEvaluationContext,
    policies: PolicyRule[],
    restrictions: Array<{ id: string; type: string; value: any }>,
    walletData: {
      balance: number;
      available_balance: number;
      locked_balance: number;
      daily_total?: number;
    }
  ): Promise<PolicyEvaluationResult> {
    const result: PolicyEvaluationResult = {
      decision: 'allow',
      matched_rules: [],
      restrictions_checked: [],
      requires_approval: false,
    };

    // Sort policies by priority (higher priority first)
    const sortedPolicies = [...policies].sort((a, b) => b.priority - a.priority);

    // Evaluate each policy rule
    for (const rule of sortedPolicies) {
      if (this.evaluateRule(rule, context)) {
        result.matched_rules.push(rule);
        
        // If rule matches and action is deny, stop evaluation
        if (rule.action === 'deny') {
          result.decision = 'deny';
          result.policy_id = rule.id;
          result.reason = `Policy rule "${rule.name}" denied the transaction`;
          return result;
        }
        
        // If rule requires approval, mark it
        if (rule.action === 'require_approval') {
          result.requires_approval = true;
          result.decision = 'require_approval';
          result.policy_id = rule.id;
        }
      }
    }

    // Check restrictions
    const balanceContext: BalanceContext = {
      current_balance: walletData.balance,
      available_balance: walletData.available_balance,
      locked_balance: walletData.locked_balance,
      transaction_amount: context.amount,
    };

    const balanceChecks = checkBalanceRestrictions(
      restrictions.map(r => ({ type: r.type as any, value: r.value })),
      balanceContext
    );

    // Check daily limits
    const dailyLimitRestriction = restrictions.find(r => r.type === 'daily_limit');
    if (dailyLimitRestriction) {
      const dailyCheck = checkDailyLimit(
        { type: dailyLimitRestriction.type as any, value: dailyLimitRestriction.value },
        {
          transaction_amount: context.amount,
          daily_total: walletData.daily_total || 0,
        }
      );
      balanceChecks.push(dailyCheck);
    }

    // Check time restrictions
    const timeRestriction = restrictions.find(r => r.type === 'time_restriction');
    if (timeRestriction) {
      const timeCheck = checkTimeRestriction(
        { type: timeRestriction.type as any, value: timeRestriction.value },
        { current_time: new Date() }
      );
      balanceChecks.push(timeCheck);
    }

    // Add restriction IDs
    balanceChecks.forEach((check, index) => {
      if (restrictions[index]) {
        check.restriction_id = restrictions[index].id;
      }
    });

    result.restrictions_checked = balanceChecks;

    // Check if any restriction failed
    const failedRestrictions = balanceChecks.filter(c => !c.passed);
    if (failedRestrictions.length > 0) {
      result.decision = 'deny';
      result.reason = failedRestrictions.map(r => r.message).join('; ');
      return result;
    }

    // Check approval requirements
    const approvalContext: ApprovalContext = {
      amount: context.amount,
      transaction_type: context.transaction_type,
      purpose: context.purpose,
    };

    const approvalCheck = evaluateApprovalRequirement(
      restrictions.map(r => ({ type: r.type as any, value: r.value })),
      approvalContext
    );

    if (approvalCheck.requires_approval) {
      result.requires_approval = true;
      result.decision = 'require_approval';
      result.approval_workflow_id = approvalCheck.workflow_id;
    }

    return result;
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
