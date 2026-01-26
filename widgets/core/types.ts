/**
 * Widget Core Types
 * 
 * Type definitions for embedded widgets.
 */

export interface WidgetConfig {
  partner_id: string;
  wallet_id?: string;
  external_user_id?: string;
  api_key?: string;
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;
  onEvent?: (event: WidgetEvent) => void;
}

export interface WidgetEvent {
  type: 'balance_updated' | 'disbursement_requested' | 'disbursement_completed' | 'error';
  data?: any;
  timestamp: string;
}

export type WidgetType = 'wallet-balance' | 'disbursement-request';

export interface WalletBalanceWidgetProps {
  wallet_id: string;
  show_restrictions?: boolean;
  show_history?: boolean;
}

export interface DisbursementRequestWidgetProps {
  wallet_id: string;
  default_amount?: number;
  show_purpose_field?: boolean;
}
