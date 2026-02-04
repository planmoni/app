import { supabase } from '@/lib/supabase';

export const PaymentService = {
  /**
   * Initiates a Mono payment via Supabase Edge Function (Stateless Flow).
   * @param amount Amount in Naira
   * @param description Payment description
   * @param userId User ID
   * @param email User Email
   * @param name User Full Name
   * @returns Object containing payment_link and reference
   */
  async initiateMonoPayment(amount: number, description: string, userId: string, email: string, name: string) {
    const { data, error } = await supabase.functions.invoke('initiate-plan-deposit', {
      body: { amount, description, userId, email, name },
    });

    if (error) {
      console.error("Supabase Function Error:", error);
      throw new Error(error.message || 'Failed to communicate with payment server');
    }

    if (data && data.error) {
        console.error("Payment Initiation Error:", data.error);
        throw new Error(data.error);
    }

    return data; // { payment_link: string, reference: string }
  },

  /**
   * Verifies a Mono transaction status.
   * @param reference Transaction reference
   * @returns Verification result
   */
  async verifyMonoPayment(reference: string) {
    const { data, error } = await supabase.functions.invoke('verify-mono-payment', {
      body: { reference },
    });

    if (error) {
       console.error("Verification Function Error:", error);
       throw new Error(error.message || "Failed to verify payment");
    }

    return data;
  },

  async exchangeMandate(code: string, userId: string) {
    const { data, error } = await supabase.functions.invoke('exchange-mono-mandate', {
      body: { code, userId },
    });

    if (error) throw new Error(error.message || "Failed to link bank");
    if (data.error) throw new Error(data.error);
    return data;
  },

  async chargeSavedBank(amount: number, userId: string, description?: string) {
    const { data, error } = await supabase.functions.invoke('charge-saved-bank', {
      body: { amount, userId, description },
    });

    if (error) throw new Error(error.message || "Failed to charge bank");
    if (data.error) throw new Error(data.error);
    return data;
  },

  async initiateMandateSetup(userId: string, email: string, name: string, amount?: number) {
    const { data, error } = await supabase.functions.invoke('initiate-mandate', {
      body: { userId, email, name, amount },
    });

    if (error) throw new Error(error.message || "Failed to initiate mandate");
    if (data.error) throw new Error(data.error);
    return data;
  },

  async prepareMonoUser(userId: string, email: string, name: string) {
    const { data, error } = await supabase.functions.invoke('prepare-mono-user', {
      body: { userId, email, name },
    });

    if (error) throw new Error(error.message || "Failed to prepare user");
    if (data.error) throw new Error(data.error);
    return data; // returns { customer_id: "..." }
  },

  async initiateInstantDeposit(amount: number, email: string, name: string, description?: string) {
    const { data, error } = await supabase.functions.invoke('initiate-direct-pay', {
      body: { amount, email, name, description },
    });

    if (error) throw new Error(error.message || "Failed to initiate deposit");
    if (data.error) throw new Error(data.error);
    return data; // { payment_link: "...", reference: "..." }
  },

  async verifyTransaction(reference: string) {
    const { data, error } = await supabase.functions.invoke('verify-transaction', {
      body: { reference },
    });

    if (error) throw new Error(error.message || "Verification failed");
    if (data.error) throw new Error(data.error);
    return data;
  }
};
