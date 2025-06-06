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
      payout_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          total_amount: number
          payout_amount: number
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          duration: number
          start_date: string
          bank_account_id: string
          status: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts: number
          next_payout_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          total_amount: number
          payout_amount: number
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          duration: number
          start_date: string
          bank_account_id: string
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          total_amount?: number
          payout_amount?: number
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          duration?: number
          start_date?: string
          bank_account_id?: string
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          completed_payouts?: number
          next_payout_date?: string | null
          created_at?: string
          updated_at?: string
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
    }
  }
}