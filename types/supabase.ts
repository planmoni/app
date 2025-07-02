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
      payout_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          total_amount: number
          payout_amount: number
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week: number | null
          duration: number
          start_date: string
          bank_account_id: string | null
          payout_account_id: string | null
          status: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts: number
          next_payout_date: string | null
          emergency_withdrawal_enabled: boolean
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          total_amount: number
          payout_amount: number
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week?: number | null
          duration: number
          start_date: string
          bank_account_id?: string | null
          payout_account_id?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          emergency_withdrawal_enabled?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          total_amount?: number
          payout_amount?: number
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          day_of_week?: number | null
          duration?: number
          start_date?: string
          bank_account_id?: string | null
          payout_account_id?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          emergency_withdrawal_enabled?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
      }
      custom_payout_dates: {
        Row: {
          id: string
          payout_plan_id: string
          payout_date: string
          created_at: string
        }
        Insert: {
          id?: string
          payout_plan_id: string
          payout_date: string
          created_at?: string
        }
        Update: {
          id?: string
          payout_plan_id?: string
          payout_date?: string
          created_at?: string
        }
      }
      bank_accounts: {
        Row: {
          id: string
          user_id: string
          bank_name: string
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
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string // 'deposit', 'reward', etc.
          amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          status?: string
          created_at?: string
        }
      }
      referrals: {
        Row: {
          id: string
          referrer_id: string
          referred_id: string
          status: string // 'pending', 'qualified', 'rewarded'
          created_at: string
        }
        Insert: {
          id?: string
          referrer_id: string
          referred_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          referrer_id?: string
          referred_id?: string
          status?: string
          created_at?: string
        }
      }
      deposits: {
        Row: {
          id: string
          user_id: string
          amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          status?: string
          created_at?: string
        }
      }
    }
  }
}