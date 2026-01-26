/**
 * Approvals Resource
 * 
 * Approval workflow operations.
 */

import { PlanmoniClient } from '../client';

export interface ApprovalRequest {
  id: string;
  workflow_id?: string;
  wallet_id: string;
  transaction_id?: string;
  request_type: string;
  amount?: number;
  status: string;
  current_step: number;
  total_steps: number;
  created_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  partner_id?: string;
  name: string;
  workflow_type: string;
  steps: any[];
  is_active: boolean;
}

export class Approvals {
  constructor(private client: PlanmoniClient) {}

  /**
   * List approval requests
   */
  async listRequests(params?: { status?: string; wallet_id?: string }): Promise<{
    requests: ApprovalRequest[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.wallet_id) queryParams.append('wallet_id', params.wallet_id);
    const query = queryParams.toString();
    return this.client.get(`/api/v1/approvals${query ? `?${query}` : ''}`);
  }

  /**
   * Get approval request
   */
  async getRequest(id: string): Promise<{ request: ApprovalRequest }> {
    return this.client.get(`/api/v1/approvals/${id}`);
  }

  /**
   * Create approval request
   */
  async createRequest(params: {
    workflow_id?: string;
    wallet_id: string;
    request_type: string;
    amount?: number;
    purpose?: string;
    metadata?: any;
  }): Promise<{ request: ApprovalRequest }> {
    return this.client.post('/api/v1/approvals', params);
  }

  /**
   * Approve request
   */
  async approve(id: string, comments?: string): Promise<{ request: ApprovalRequest }> {
    return this.client.post(`/api/v1/approvals/${id}/approve`, { comments });
  }

  /**
   * Reject request
   */
  async reject(id: string, comments?: string): Promise<{ request: ApprovalRequest }> {
    return this.client.post(`/api/v1/approvals/${id}/reject`, { comments });
  }

  /**
   * List workflows
   */
  async listWorkflows(): Promise<{ workflows: ApprovalWorkflow[] }> {
    return this.client.get('/api/v1/approval-workflows');
  }

  /**
   * Create workflow
   */
  async createWorkflow(params: {
    name: string;
    description?: string;
    workflow_type: string;
    steps: any[];
    auto_approve_rules?: any;
  }): Promise<{ workflow: ApprovalWorkflow }> {
    return this.client.post('/api/v1/approval-workflows', params);
  }
}
