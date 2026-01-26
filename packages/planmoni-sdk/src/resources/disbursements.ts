/**
 * Disbursements Resource
 * 
 * Controlled disbursement operations.
 */

import { PlanmoniClient } from '../client';

export interface Disbursement {
  transaction_id: string;
  wallet_id: string;
  amount: number;
  status: string;
  approval_request_id?: string;
  requires_approval: boolean;
  policy_evaluation?: any;
}

export interface CreateDisbursementParams {
  wallet_id: string;
  amount: number;
  recipient_account_number: string;
  recipient_bank_code: string;
  recipient_account_name: string;
  purpose?: string;
  metadata?: any;
}

export class Disbursements {
  constructor(private client: PlanmoniClient) {}

  /**
   * Request disbursement
   */
  async create(params: CreateDisbursementParams): Promise<{ disbursement: Disbursement }> {
    return this.client.post('/api/v1/disbursements', params);
  }

  /**
   * Get disbursement status
   */
  async get(id: string): Promise<{ disbursement: Disbursement }> {
    return this.client.get(`/api/v1/disbursements/${id}`);
  }
}
