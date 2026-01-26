/**
 * Planmoni Client
 * 
 * Main client class for interacting with Planmoni Platform API.
 */

import { Wallets } from './resources/wallets';
import { Disbursements } from './resources/disbursements';
import { Policies } from './resources/policies';
import { Approvals } from './resources/approvals';
import { Audit } from './resources/audit';
import { Partners } from './resources/partners';

export interface PlanmoniClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class PlanmoniClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  public wallets: Wallets;
  public disbursements: Disbursements;
  public policies: Policies;
  public approvals: Approvals;
  public audit: Audit;
  public partners: Partners;

  constructor(config: PlanmoniClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.planmoni.com';
    this.timeout = config.timeout || 30000;

    // Initialize resources
    this.wallets = new Wallets(this);
    this.disbursements = new Disbursements(this);
    this.policies = new Policies(this);
    this.approvals = new Approvals(this);
    this.audit = new Audit(this);
    this.partners = new Partners(this);
  }

  /**
   * Make API request
   */
  async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Unknown error',
          message: `HTTP ${response.status}`,
        }));
        throw new Error(error.message || `API request failed: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}
