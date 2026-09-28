export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          locked_balance: number
          available_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          locked_balance?: number
          available_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          locked_balance?: number
          available_balance?: number
          created_at?: string
          updated_at?: string
        }
      }
      vault_payout_schedules: {
        Row: {
          id: string
          user_id: string
          budget_plan_id: string
          payout_account_id: string
          total_amount: number
          payout_amount: number
          net_payout_amount: number
          fee_percentage: number | null
          fee_amount: number
          frequency: string
          duration: number
          start_date: string
          next_payout_date: string | null
          day_of_week: number | null
          payout_hour: number | null
          payout_minute: number | null
          completed_payouts: number
          status: 'active' | 'paused' | 'completed' | 'cancelled'
          plan_transaction_id: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          budget_plan_id: string
          payout_account_id: string
          total_amount: number
          payout_amount: number
          net_payout_amount: number
          fee_percentage?: number | null
          fee_amount?: number
          frequency: string
          duration: number
          start_date: string
          next_payout_date?: string | null
          day_of_week?: number | null
          payout_hour?: number | null
          payout_minute?: number | null
          completed_payouts?: number
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          plan_transaction_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          budget_plan_id?: string
          payout_account_id?: string
          total_amount?: number
          payout_amount?: number
          net_payout_amount?: number
          fee_percentage?: number | null
          fee_amount?: number
          frequency?: string
          duration?: number
          start_date?: string
          next_payout_date?: string | null
          day_of_week?: number | null
          payout_hour?: number | null
          payout_minute?: number | null
          completed_payouts?: number
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          plan_transaction_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      payout_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          total_amount: number
          payout_amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week: number | null
          duration: number
          start_date: string
          bank_account_id: string | null
          payout_account_id: string | null
          status: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts: number
          next_payout_date: string | null
          emergency_withdrawal_enabled: boolean
          fee_percentage: number | null
          fee_amount: number | null
          net_payout_amount: number | null
          created_at: string
          updated_at: string
          metadata: Json | null
          share_code: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          total_amount: number
          payout_amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week?: number | null
          duration: number
          start_date: string
          bank_account_id?: string | null
          payout_account_id?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          emergency_withdrawal_enabled?: boolean
          fee_percentage?: number | null
          fee_amount?: number | null
          net_payout_amount?: number | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          share_code?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          total_amount?: number
          payout_amount?: number
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week?: number | null
          duration?: number
          start_date?: string
          bank_account_id?: string | null
          payout_account_id?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          emergency_withdrawal_enabled?: boolean
          fee_percentage?: number | null
          fee_amount?: number | null
          net_payout_amount?: number | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          share_code?: string | null
        }
      }
      payout_plan_pairings: {
        Row: {
          id: string
          payout_plan_id: string
          paired_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          payout_plan_id: string
          paired_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          payout_plan_id?: string
          paired_user_id?: string
          created_at?: string
        }
      }
      payout_fees: {
        Row: {
          id: string
          frequency: string
          fee_percentage: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          frequency: string
          fee_percentage: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          frequency?: string
          fee_percentage?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      custom_payout_dates: {
        Row: {
          id: string
          payout_plan_id: string
          payout_date: string
          payout_time: string | null
          amount: number | null
          created_at: string
        }
        Insert: {
          id?: string
          payout_plan_id: string
          payout_date: string
          payout_time?: string | null
          amount?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          payout_plan_id?: string
          payout_date?: string
          payout_time?: string | null
          amount?: number | null
          created_at?: string
        }
      }
      bank_accounts: {
        Row: {
          id: string
          user_id: string
          bank_name: string
          bank_code: string | null
          account_number: string
          account_name: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bank_name: string
          bank_code?: string | null
          account_number: string
          account_name: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bank_name?: string
          bank_code?: string | null
          account_number?: string
          account_name?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      payout_accounts: {
        Row: {
          id: string
          user_id: string
          account_name: string
          account_number: string
          bank_name: string
          bank_code: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_name: string
          account_number: string
          bank_name: string
          bank_code?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_name?: string
          account_number?: string
          bank_name?: string
          bank_code?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      app_versions: {
        Row: {
          id: string
          android_version: string
          ios_version: string
          android_build: number
          ios_build: number
          android_update_url: string
          ios_update_url: string
          update_message: string
          force_update: boolean
          ios_min_version: string | null
          android_min_version: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          android_version?: string
          ios_version?: string
          android_build?: number
          ios_build?: number
          android_update_url?: string
          ios_update_url?: string
          update_message?: string
          force_update?: boolean
          ios_min_version?: string | null
          android_min_version?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          android_version?: string
          ios_version?: string
          android_build?: number
          ios_build?: number
          android_update_url?: string
          ios_update_url?: string
          update_message?: string
          force_update?: boolean
          ios_min_version?: string | null
          android_min_version?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}