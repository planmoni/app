/**
 * Policies Resource
 * 
 * Policy management operations.
 */

import { PlanmoniClient } from '../client';

export interface Policy {
  id: string;
  partner_id?: string;
  name: string;
  description?: string;
  policy_rules: any;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePolicyParams {
  name: string;
  description?: string;
  policy_rules: any;
  is_default?: boolean;
}

export class Policies {
  constructor(private client: PlanmoniClient) {}

  /**
   * List policies
   */
  async list(): Promise<{ policies: Policy[] }> {
    return this.client.get('/api/v1/policies');
  }

  /**
   * Get policy by ID
   */
  async get(id: string): Promise<{ policy: Policy }> {
    return this.client.get(`/api/v1/policies/${id}`);
  }

  /**
   * Create policy
   */
  async create(params: CreatePolicyParams): Promise<{ policy: Policy }> {
    return this.client.post('/api/v1/policies', params);
  }

  /**
   * Update policy
   */
  async update(id: string, updates: Partial<Policy>): Promise<{ policy: Policy }> {
    return this.client.patch(`/api/v1/policies/${id}`, updates);
  }

  /**
   * Delete policy
   */
  async delete(id: string): Promise<void> {
    return this.client.delete(`/api/v1/policies/${id}`);
  }
}
