/**
 * Wallets Resource
 * 
 * Wallet management operations.
 */

import { PlanmoniClient } from '../client';

export interface Wallet {
  id: string;
  user_id: string;
  partner_id?: string;
  balance: number;
  available_balance: number;
  locked_balance: number;
  is_restricted: boolean;
  requires_approval: boolean;
  policy_id?: string;
  restrictions?: Restriction[];
  created_at: string;
}

export interface Restriction {
  id: string;
  restriction_type: string;
  restriction_value: any;
  is_active: boolean;
}

export interface CreateWalletParams {
  external_user_id?: string;
  user_id?: string;
  policy_id?: string;
  restrictions?: Array<{ type: string; value: any }>;
  is_restricted?: boolean;
  requires_approval?: boolean;
  metadata?: any;
}

export class Wallets {
  constructor(private client: PlanmoniClient) {}

  /**
   * List wallets
   */
  async list(params?: { external_user_id?: string }): Promise<{ wallets: Wallet[] }> {
    const queryParams = new URLSearchParams();
    if (params?.external_user_id) {
      queryParams.append('external_user_id', params.external_user_id);
    }
    const query = queryParams.toString();
    return this.client.get(`/api/v1/wallets${query ? `?${query}` : ''}`);
  }

  /**
   * Get wallet by ID
   */
  async get(id: string): Promise<{ wallet: Wallet }> {
    return this.client.get(`/api/v1/wallets/${id}`);
  }

  /**
   * Create wallet
   */
  async create(params: CreateWalletParams): Promise<{ wallet: Wallet }> {
    return this.client.post('/api/v1/wallets', params);
  }

  /**
   * Update wallet
   */
  async update(id: string, updates: Partial<Wallet>): Promise<{ wallet: Wallet }> {
    return this.client.patch(`/api/v1/wallets/${id}`, updates);
  }

  /**
   * Get wallet balance
   */
  async getBalance(id: string): Promise<{
    balance: {
      total: number;
      available: number;
      locked: number;
      restricted: number;
      currency: string;
    };
  }> {
    return this.client.get(`/api/v1/wallets/${id}/balance`);
  }

  /**
   * List wallet restrictions
   */
  async listRestrictions(walletId: string): Promise<{ restrictions: Restriction[] }> {
    return this.client.get(`/api/v1/wallets/${walletId}/restrictions`);
  }

  /**
   * Add restriction
   */
  async addRestriction(
    walletId: string,
    restriction: { restriction_type: string; restriction_value: any }
  ): Promise<{ restriction: Restriction }> {
    return this.client.post(`/api/v1/wallets/${walletId}/restrictions`, restriction);
  }

  /**
   * Remove restriction
   */
  async removeRestriction(walletId: string, restrictionId: string): Promise<void> {
    return this.client.delete(`/api/v1/wallets/${walletId}/restrictions/${restrictionId}`);
  }
}
