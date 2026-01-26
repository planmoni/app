/**
 * Disbursements API
 * 
 * Request controlled disbursements with policy validation and approval triggering.
 * This is the core API for controlled money access in the Platform-as-a-Service model.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
import { policyEngine } from '@/lib/policy-engine';
import { approvalEngine } from '@/lib/approval-engine';
import type { PolicyEvaluationContext, PolicyRule } from '@/lib/policy-engine/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const body = await request.json();
      const {
        wallet_id,
        amount,
        recipient_account_number,
        recipient_bank_code,
        recipient_account_name,
        purpose,
        metadata,
      } = body;

      // Validate required fields
      if (!wallet_id || !amount || amount <= 0) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'wallet_id and positive amount are required',
          },
          400
        );
      }

      if (!recipient_account_number || !recipient_bank_code) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'recipient_account_number and recipient_bank_code are required',
          },
          400
        );
      }

      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*, wallet_policies(*)')
        .eq('id', wallet_id)
        .single();

      if (walletError || !wallet) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Wallet not found',
          },
          404
        );
      }

      // Check access
      if (auth.partner_id && wallet.partner_id !== auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied to this wallet',
          },
          403
        );
      }

      // Check wallet balance
      const availableBalance = wallet.available_balance || (wallet.balance - wallet.locked_balance);
      if (availableBalance < amount) {
        return createErrorResponse(
          {
            error: ERROR_CODES.INSUFFICIENT_BALANCE,
            message: 'Insufficient balance',
            details: {
              available: availableBalance,
              requested: amount,
            },
          },
          400
        );
      }

      // Get wallet restrictions
      const { data: restrictions } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('wallet_id', wallet_id)
        .eq('is_active', true);

      // Check restrictions using database function
      const { data: restrictionCheck } = await supabase.rpc('check_wallet_restrictions', {
        p_wallet_id: wallet_id,
        p_transaction_type: 'disbursement',
        p_amount: amount,
        p_purpose: purpose || null,
      });

      if (restrictionCheck && !restrictionCheck.passed) {
        return createErrorResponse(
          {
            error: ERROR_CODES.POLICY_VIOLATION,
            message: 'Transaction violates wallet restrictions',
            details: restrictionCheck.violations,
          },
          400
        );
      }

      // Evaluate policies if wallet has a policy
      let policyEvaluation = null;
      if (wallet.policy_id) {
        const policy = wallet.wallet_policies as any;
        if (policy && policy.policy_rules) {
          const evaluationContext: PolicyEvaluationContext = {
            wallet_id,
            partner_id: wallet.partner_id || undefined,
            user_id: wallet.user_id,
            transaction_type: 'disbursement',
            amount,
            purpose,
            metadata,
          };

          const rules = (policy.policy_rules as any)?.rules || [];
          const policyRules: PolicyRule[] = rules.map((rule: any, index: number) => ({
            id: rule.id || `rule-${index}`,
            name: rule.name || 'Rule',
            condition: rule.condition,
            action: rule.action,
            priority: rule.priority || 0,
          }));

          policyEvaluation = await policyEngine.evaluate(
            evaluationContext,
            policyRules,
            (restrictions || []).map(r => ({
              id: r.id,
              type: r.restriction_type,
              value: r.restriction_value,
            })),
            {
              balance: wallet.balance,
              available_balance: availableBalance,
              locked_balance: wallet.locked_balance,
            }
          );

          // If policy denies, reject
          if (policyEvaluation.decision === 'deny') {
            return createErrorResponse(
              {
                error: ERROR_CODES.POLICY_VIOLATION,
                message: policyEvaluation.reason || 'Transaction denied by policy',
                details: policyEvaluation,
              },
              400
            );
          }
        }
      }

      // Check if approval is required
      const { data: approvalCheck } = await supabase.rpc('get_required_approvals', {
        p_wallet_id: wallet_id,
        p_transaction_type: 'disbursement',
        p_amount: amount,
      });

      const requiresApproval = approvalCheck?.requires_approval || 
                               policyEvaluation?.requires_approval || 
                               wallet.requires_approval;

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: wallet.user_id,
          partner_id: wallet.partner_id || null,
          type: 'disbursement',
          amount,
          status: requiresApproval ? 'pending' : 'pending',
          source: 'wallet',
          destination: `${recipient_bank_code} - ${recipient_account_number}`,
          reference: `DISP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: purpose || 'Controlled disbursement',
          metadata: {
            ...metadata,
            wallet_id: wallet_id,
            recipient_account_number,
            recipient_bank_code,
            recipient_account_name,
            policy_evaluation: policyEvaluation,
          },
        })
        .select()
        .single();

      if (txError) {
        console.error('Error creating transaction:', txError);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create transaction',
          },
          500
        );
      }

      // If approval required, create approval request
      let approvalRequest = null;
      if (requiresApproval) {
        const workflowId = approvalCheck?.workflow_id || null;
        
        try {
          approvalRequest = await approvalEngine.createRequest(
            workflowId,
            wallet_id,
            'disbursement',
            amount,
            transaction.id,
            wallet.partner_id || undefined,
            purpose,
            {
              ...metadata,
              recipient_account_number,
              recipient_bank_code,
              recipient_account_name,
            }
          );
        } catch (approvalError: any) {
          console.error('Error creating approval request:', approvalError);
          // Continue without approval if creation fails
        }
      }

      // If no approval required, process immediately
      // In production, this would trigger actual disbursement via Paystack/Mono
      // For now, we'll mark it as pending for manual processing
      if (!requiresApproval) {
        // TODO: Trigger actual disbursement via payment provider
        // For now, transaction remains in pending status
      }

      return createJsonResponse(
        {
          disbursement: {
            transaction_id: transaction.id,
            wallet_id,
            amount,
            status: requiresApproval ? 'pending_approval' : 'pending',
            approval_request_id: approvalRequest?.id || null,
            requires_approval: requiresApproval,
            policy_evaluation: policyEvaluation,
          },
        },
        201
      );
    } catch (error: any) {
      console.error('Disbursements POST error:', error);
      return createErrorResponse(
        {
          error: ERROR_CODES.INTERNAL_ERROR,
          message: error.message || 'Internal server error',
        },
        500
      );
    }
  });
}
