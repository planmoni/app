/**
 * Paystack Transfer API Integration
 *
 * This module handles all Paystack transfer operations for automated payouts
 * including recipient management, transfer initiation, and status verification.
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export interface PaystackRecipient {
  type: "nuban";
  name: string;
  account_number: string;
  bank_code: string;
  currency: "NGN";
}

export interface PaystackTransfer {
  source: "balance";
  amount: number; // in kobo
  recipient: string; // recipient code
  reason: string;
  reference: string;
}

export interface TransferResponse {
  status: boolean;
  message: string;
  data?: {
    id: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    transfer_code: string;
    recipient: {
      recipient_code: string;
      name: string;
      account_number: string;
      bank_name: string;
    };
    created_at: string;
  };
}

export interface RecipientResponse {
  status: boolean;
  message: string;
  data?: {
    recipient_code: string;
    type: string;
    name: string;
    account_number: string;
    bank_code: string;
    bank_name: string;
    currency: string;
    active: boolean;
    created_at: string;
  };
}

/**
 * Create a transfer recipient on Paystack
 */
export async function createTransferRecipient(
  recipientData: PaystackRecipient
): Promise<RecipientResponse> {
  try {
    console.log("Creating Paystack transfer recipient:", recipientData);

    const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(recipientData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Failed to create recipient:", result);
      throw new Error(result.message || "Failed to create transfer recipient");
    }

    console.log(
      "Transfer recipient created successfully:",
      result.data?.recipient_code
    );
    return result;
  } catch (error) {
    console.error("Error creating transfer recipient:", error);
    throw error;
  }
}

/**
 * Initiate a transfer on Paystack
 */
export async function initiateTransfer(
  transferData: PaystackTransfer
): Promise<TransferResponse> {
  try {
    console.log("Initiating Paystack transfer:", {
      ...transferData,
      amount: transferData.amount / 100, // Log in naira for readability
    });

    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transferData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Failed to initiate transfer:", result);
      throw new Error(result.message || "Failed to initiate transfer");
    }

    console.log("Transfer initiated successfully:", result.data?.transfer_code);
    return result;
  } catch (error) {
    console.error("Error initiating transfer:", error);
    throw error;
  }
}

/**
 * Verify transfer status on Paystack
 */
export async function verifyTransfer(
  transferId: string
): Promise<TransferResponse> {
  try {
    console.log("Verifying transfer status:", transferId);

    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transfer/${transferId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Failed to verify transfer:", result);
      throw new Error(result.message || "Failed to verify transfer");
    }

    console.log("Transfer status:", result.data?.status);
    return result;
  } catch (error) {
    console.error("Error verifying transfer:", error);
    throw error;
  }
}

/**
 * Get list of banks supported by Paystack for transfers
 */
export async function getSupportedBanks(): Promise<any> {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to fetch banks");
    }

    return result;
  } catch (error) {
    console.error("Error fetching supported banks:", error);
    throw error;
  }
}

/**
 * Resolve account number to get account name and verify bank details
 */
export async function resolveAccountNumber(
  accountNumber: string,
  bankCode: string
): Promise<any> {
  try {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to resolve account");
    }

    return result;
  } catch (error) {
    console.error("Error resolving account:", error);
    throw error;
  }
}

/**
 * Get available Paystack balance for transfers
 */
export async function getPaystackBalance(): Promise<any> {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/balance`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to fetch balance");
    }

    return result;
  } catch (error) {
    console.error("Error fetching Paystack balance:", error);
    throw error;
  }
}

/**
 * Utility function to convert naira to kobo
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Utility function to convert kobo to naira
 */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/**
 * Generate unique transfer reference
 */
export function generateTransferReference(
  planId: string,
  date: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `payout_${planId}_${date}_${timestamp}_${random}`;
}