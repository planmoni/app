/**
 * Audit Resource
 * 
 * Audit ledger and event queries.
 */

import { PlanmoniClient } from '../client';

export interface LedgerEntry {
  entry_number: number;
  entry_type: string;
  amount?: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  metadata: any;
  entry_hash: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  changes: any;
  metadata: any;
  created_at: string;
}

export class Audit {
  constructor(private client: PlanmoniClient) {}

  /**
   * Get ledger history
   */
  async getLedger(
    walletId: string,
    params?: {
      from_date?: string;
      to_date?: string;
      limit?: number;
      offset?: number;
      format?: 'json' | 'csv';
    }
  ): Promise<{ entries: LedgerEntry[]; total: number }> {
    const queryParams = new URLSearchParams();
    queryParams.append('wallet_id', walletId);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.format) queryParams.append('format', params.format);

    return this.client.get(`/api/v1/audit/ledger?${queryParams.toString()}`);
  }

  /**
   * Get audit events
   */
  async getEvents(params?: {
    partner_id?: string;
    wallet_id?: string;
    event_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.partner_id) queryParams.append('partner_id', params.partner_id);
    if (params?.wallet_id) queryParams.append('wallet_id', params.wallet_id);
    if (params?.event_type) queryParams.append('event_type', params.event_type);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.client.get(`/api/v1/audit/events${query ? `?${query}` : ''}`);
  }

  /**
   * Verify ledger integrity
   */
  async verifyIntegrity(walletId: string): Promise<{
    integrity: {
      integrity_ok: boolean;
      violations: any[];
      total_entries: number;
    };
  }> {
    return this.client.post('/api/v1/audit/integrity', { wallet_id: walletId });
  }
}
