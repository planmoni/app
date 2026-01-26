/**
 * Approval Engine
 * 
 * Processes approval workflows for controlled money access.
 * Handles step progression, auto-approval, expiration, and notifications.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export interface ApprovalStep {
  step_number: number;
  approvers: string[]; // User IDs or role names
  required_approvals: number; // How many approvals needed (default: all)
  auto_approve_after?: number; // Hours until auto-approval
  conditions?: any; // Conditions for this step
}

export interface ApprovalWorkflow {
  id: string;
  partner_id?: string;
  name: string;
  workflow_type: string;
  steps: ApprovalStep[];
  auto_approve_rules?: any;
}

export interface ApprovalRequest {
  id: string;
  workflow_id?: string;
  wallet_id: string;
  transaction_id?: string;
  request_type: string;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  current_step: number;
  total_steps: number;
}

export class ApprovalEngine {
  /**
   * Create an approval request
   */
  async createRequest(
    workflowId: string | null,
    walletId: string,
    requestType: string,
    amount?: number,
    transactionId?: string,
    partnerId?: string,
    purpose?: string,
    metadata?: any
  ): Promise<ApprovalRequest> {
    let workflow: ApprovalWorkflow | null = null;
    let steps: ApprovalStep[] = [];
    let totalSteps = 1;

    // Get workflow if provided
    if (workflowId) {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        workflow = data as any;
        steps = workflow.steps as ApprovalStep[];
        totalSteps = steps.length;
      }
    }

    // Check auto-approval rules
    if (workflow?.auto_approve_rules) {
      const shouldAutoApprove = this.evaluateAutoApproveRules(
        workflow.auto_approve_rules,
        { amount, requestType, purpose }
      );

      if (shouldAutoApprove) {
        // Create approved request directly
        const { data: request, error } = await supabase
          .from('approval_requests')
          .insert({
            workflow_id: workflowId,
            wallet_id: walletId,
            transaction_id: transactionId,
            partner_id: partnerId,
            request_type: requestType,
            amount,
            purpose,
            status: 'approved',
            current_step: totalSteps,
            total_steps: totalSteps,
            metadata: { ...metadata, auto_approved: true },
            approved_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return request as ApprovalRequest;
      }
    }

    // Create pending approval request
    const expiresAt = workflow?.steps?.[0]?.auto_approve_after
      ? new Date(Date.now() + workflow.steps[0].auto_approve_after * 60 * 60 * 1000).toISOString()
      : null;

    const { data: request, error } = await supabase
      .from('approval_requests')
      .insert({
        workflow_id: workflowId,
        wallet_id: walletId,
        transaction_id: transactionId,
        partner_id: partnerId,
        request_type: requestType,
        amount,
        purpose,
        status: 'pending',
        current_step: 0,
        total_steps: totalSteps,
        metadata,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger notifications for first step approvers
    if (steps.length > 0) {
      await this.notifyApprovers(request.id, steps[0]);
    }

    return request as ApprovalRequest;
  }

  /**
   * Process approval action
   */
  async processApproval(
    requestId: string,
    approverId: string,
    action: 'approve' | 'reject' | 'request_changes',
    comments?: string
  ): Promise<ApprovalRequest> {
    // Get approval request
    const { data: request, error: reqError } = await supabase
      .from('approval_requests')
      .select('*, approval_workflows(*)')
      .eq('id', requestId)
      .single();

    if (reqError || !request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot process approval for ${request.status} request`);
    }

    // Get workflow steps
    const workflow = request.approval_workflows as any;
    const steps = workflow?.steps || [];
    const currentStep = steps[request.current_step];

    if (!currentStep) {
      throw new Error('Invalid approval step');
    }

    // Record approval action
    const { error: actionError } = await supabase
      .from('approval_actions')
      .insert({
        approval_request_id: requestId,
        approver_id: approverId,
        step_number: request.current_step,
        action,
        comments,
      });

    if (actionError) throw actionError;

    // Handle rejection
    if (action === 'reject') {
      const { data: updated, error } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return updated as ApprovalRequest;
    }

    // Handle approval
    if (action === 'approve') {
      const requiredApprovals = currentStep.required_approvals || currentStep.approvers.length;
      
      // Count existing approvals for this step
      const { count } = await supabase
        .from('approval_actions')
        .select('*', { count: 'exact', head: true })
        .eq('approval_request_id', requestId)
        .eq('step_number', request.current_step)
        .eq('action', 'approve');

      const approvalCount = (count || 0) + 1;

      // Check if step is complete
      if (approvalCount >= requiredApprovals) {
        // Move to next step or complete
        const nextStep = request.current_step + 1;

        if (nextStep >= request.total_steps) {
          // All steps complete - approve request
          const { data: updated, error } = await supabase
            .from('approval_requests')
            .update({
              status: 'approved',
              current_step: nextStep,
              approved_at: new Date().toISOString(),
            })
            .eq('id', requestId)
            .select()
            .single();

          if (error) throw error;
          return updated as ApprovalRequest;
        } else {
          // Move to next step
          const { data: updated, error } = await supabase
            .from('approval_requests')
            .update({
              current_step: nextStep,
            })
            .eq('id', requestId)
            .select()
            .single();

          if (error) throw error;

          // Notify next step approvers
          const nextStepData = steps[nextStep];
          if (nextStepData) {
            await this.notifyApprovers(requestId, nextStepData);
          }

          return updated as ApprovalRequest;
        }
      } else {
        // Step not complete yet - update request
        const { data: updated, error } = await supabase
          .from('approval_requests')
          .update({})
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        return updated as ApprovalRequest;
      }
    }

    return request as ApprovalRequest;
  }

  /**
   * Evaluate auto-approval rules
   */
  private evaluateAutoApproveRules(rules: any, context: any): boolean {
    // Simple auto-approval rule evaluation
    // Can be extended for complex logic
    if (rules.amount_threshold && context.amount) {
      return context.amount <= rules.amount_threshold;
    }
    return false;
  }

  /**
   * Notify approvers
   */
  private async notifyApprovers(requestId: string, step: ApprovalStep): Promise<void> {
    // TODO: Implement notification system
    // This would send notifications to approvers
    console.log(`Notifying approvers for request ${requestId}, step ${step.step_number}`);
  }

  /**
   * Check and expire old requests
   */
  async expireOldRequests(): Promise<void> {
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error expiring requests:', error);
    }
  }
}

// Export singleton instance
export const approvalEngine = new ApprovalEngine();
