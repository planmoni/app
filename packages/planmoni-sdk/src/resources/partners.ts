/**
 * Partners Resource
 * 
 * Partner management operations.
 */

import { PlanmoniClient } from '../client';

export interface Partner {
  id: string;
  name: string;
  slug: string;
  partner_type: string;
  status: string;
  subscription_tier: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  name?: string;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface PartnerUser {
  id: string;
  external_user_id: string;
  user_id: string;
  wallet_id?: string;
  status: string;
  metadata: any;
}

export class Partners {
  constructor(private client: PlanmoniClient) {}

  /**
   * Get partner details
   */
  async get(id: string): Promise<{ partner: Partner }> {
    return this.client.get(`/api/v1/partners/${id}`);
  }

  /**
   * List API keys
   */
  async listApiKeys(partnerId: string): Promise<{ api_keys: ApiKey[] }> {
    return this.client.get(`/api/v1/partners/${partnerId}/api-keys`);
  }

  /**
   * Generate API key
   */
  async generateApiKey(
    partnerId: string,
    params?: { name?: string; expires_in_days?: number }
  ): Promise<{ api_key: ApiKey & { key: string }; warning: string }> {
    return this.client.post(`/api/v1/partners/${partnerId}/api-keys`, params);
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(partnerId: string, keyId: string): Promise<void> {
    return this.client.delete(`/api/v1/partners/${partnerId}/api-keys/${keyId}`);
  }

  /**
   * List partner users
   */
  async listUsers(partnerId: string, params?: { external_user_id?: string }): Promise<{
    users: PartnerUser[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.external_user_id) {
      queryParams.append('external_user_id', params.external_user_id);
    }
    const query = queryParams.toString();
    return this.client.get(`/api/v1/partners/${partnerId}/users${query ? `?${query}` : ''}`);
  }

  /**
   * Get user by external ID
   */
  async getUser(partnerId: string, externalUserId: string): Promise<{ user: PartnerUser }> {
    return this.client.get(`/api/v1/partners/${partnerId}/users/${externalUserId}`);
  }

  /**
   * Create partner user
   */
  async createUser(
    partnerId: string,
    params: { external_user_id: string; user_id: string; metadata?: any }
  ): Promise<{ user: PartnerUser }> {
    return this.client.post(`/api/v1/partners/${partnerId}/users`, params);
  }
}
