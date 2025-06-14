
export interface KYCData {
  id: string
  user_id: string
  bvn?: string
  nin?: string
  document_type: "passport" | "drivers_license" | "national_id"
  document_number: string
  document_front_url?: string
  document_back_url?: string
  selfie_url?: string
  mono_identity_id?: string
  verification_status: "pending" | "verified" | "rejected"
  created_at: string
}

export interface PaystackAccount {
  id: string
  user_id: string
  account_number: string
  account_name: string
  bank_name: string
  customer_code: string
  is_active: boolean
  created_at: string
}
