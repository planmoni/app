/**
 * SafeHaven Bank Code Mapper
 * 
 * Maps Paystack bank codes/names to SafeHaven bank codes
 * Compares banks to determine which provider to use (SafeHaven or Paystack)
 */

import safeHavenBanksData from './safehaven-banks.json';

interface SafeHavenBank {
  name: string;
  alias?: string[];
  routingKey: string;
  bankCode: string;
  categoryId: string;
}

interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  gateway?: string | null;
  pay_with_bank: boolean;
  supports_transfer: boolean;
  available_for_direct_debit: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const safeHavenBanks: SafeHavenBank[] = safeHavenBanksData.data;

// Import Paystack banks with error handling
let paystackBanks: PaystackBank[] = [];
try {
  const paystackBanksData = require('./paystack-banks.json') as { status: boolean; message: string; data: PaystackBank[] };
  if (paystackBanksData && paystackBanksData.data && Array.isArray(paystackBanksData.data)) {
    paystackBanks = paystackBanksData.data;
  }
} catch (e) {
  // File doesn't exist or is invalid - that's okay, we'll use empty array
  console.warn('Paystack banks file not found or empty. Run scripts/update-paystack-banks.js to populate it.');
  paystackBanks = [];
}

/**
 * Maps Paystack bank code to SafeHaven bank code
 * Uses a mapping table for common banks
 */
const PAYSTACK_TO_SAFEHAVEN_MAP: Record<string, string> = {
  // Commercial Banks
  '044': '000014', // Access Bank
  '063': '000005', // Access Bank (Diamond)
  '050': '000010', // Ecobank
  '070': '000017', // Fidelity Bank
  '011': '000016', // First Bank
  '214': '000003', // FCMB
  '058': '000013', // GTBank
  '030': '000004', // Heritage Bank
  '301': '000006', // Jaiz Bank
  '082': '000002', // Keystone Bank
  '526': '000001', // Sterling Bank
  '232': '000001', // Sterling Bank (alternative)
  '032': '000018', // Union Bank
  '033': '000004', // UBA
  '215': '000011', // Unity Bank
  '035': '000017', // Wema Bank
  '057': '000015', // Zenith Bank
  '101': '000023', // Providus Bank
  '102': '000025', // Titan Trust Bank
  '100': '000022', // Suntrust Bank
  '302': '000026', // Taj Bank
  '00103': '000027', // Globus Bank
  '303': '000029', // Lotus Bank
  '104': '000030', // Parallex Bank
  '105': '000031', // Premium Trust Bank
  '106': '000034', // Signature Bank
  '107': '000036', // Optimus Bank
  '076': '000008', // Polaris Bank
  '221': '000012', // Stanbic IBTC
  '068': '000021', // Standard Chartered
  '023': '000009', // Citi Bank
  
  // Microfinance and Digital Banks
  '50211': '090267', // Kuda
  '999992': '100004', // OPay
  '999991': '100033', // PalmPay
  '565': '100026', // Carbon
  '50515': '090405', // Moniepoint
  '090286': '090286', // Safe Haven MFB
};

/**
 * Normalizes bank name for comparison
 */
function normalizeBankName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Finds SafeHaven bank code by bank name
 */
export function getSafeHavenBankCodeByBankName(bankName: string): string | null {
  if (!bankName) return null;

  const normalizedName = normalizeBankName(bankName);

  // First, try exact match
  for (const bank of safeHavenBanks) {
    if (normalizeBankName(bank.name) === normalizedName) {
      return bank.bankCode;
    }
  }

  // Then, try alias match
  for (const bank of safeHavenBanks) {
    if (bank.alias && bank.alias.length > 0) {
      for (const alias of bank.alias) {
        if (normalizeBankName(alias) === normalizedName) {
          return bank.bankCode;
        }
      }
    }
  }

  // Finally, try partial match
  for (const bank of safeHavenBanks) {
    const bankNameNormalized = normalizeBankName(bank.name);
    if (bankNameNormalized.includes(normalizedName) || normalizedName.includes(bankNameNormalized)) {
      return bank.bankCode;
    }
    
    // Check aliases for partial match
    if (bank.alias && bank.alias.length > 0) {
      for (const alias of bank.alias) {
        const aliasNormalized = normalizeBankName(alias);
        if (aliasNormalized.includes(normalizedName) || normalizedName.includes(aliasNormalized)) {
          return bank.bankCode;
        }
      }
    }
  }

  return null;
}

/**
 * Gets SafeHaven bank code from Paystack bank code
 */
export function getSafeHavenBankCodeByPaystackCode(paystackCode: string): string | null {
  if (!paystackCode) return null;
  
  // Direct mapping
  if (PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode]) {
    return PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode];
  }
  
  return null;
}

/**
 * Gets SafeHaven bank code from either Paystack code or bank name
 */
export function getSafeHavenBankCode(
  paystackCode?: string | null,
  bankName?: string | null
): string | null {
  // Try Paystack code first (more reliable)
  if (paystackCode) {
    const code = getSafeHavenBankCodeByPaystackCode(paystackCode);
    if (code) return code;
  }

  // Fallback to bank name
  if (bankName) {
    return getSafeHavenBankCodeByBankName(bankName);
  }

  return null;
}

/**
 * Gets all SafeHaven banks
 */
export function getSafeHavenBanks(): SafeHavenBank[] {
  return safeHavenBanks;
}

/**
 * Gets all Paystack banks
 */
export function getPaystackBanks(): PaystackBank[] {
  return paystackBanks;
}

/**
 * Checks if a bank (by Paystack code or name) is available in SafeHaven
 * @param paystackCode - Paystack bank code
 * @param bankName - Bank name (optional, for fallback matching)
 * @returns true if bank is available in SafeHaven, false otherwise
 */
export function isBankAvailableInSafeHaven(
  paystackCode?: string | null,
  bankName?: string | null
): boolean {
  const safeHavenCode = getSafeHavenBankCode(paystackCode, bankName);
  return safeHavenCode !== null;
}

/**
 * Determines which provider to use for a bank transfer
 * @param paystackCode - Paystack bank code
 * @param bankName - Bank name (optional, for fallback matching)
 * @returns 'safehaven' if bank is available in SafeHaven, 'paystack' otherwise
 */
export function getProviderForBank(
  paystackCode?: string | null,
  bankName?: string | null
): 'safehaven' | 'paystack' {
  const isAvailable = isBankAvailableInSafeHaven(paystackCode, bankName);
  return isAvailable ? 'safehaven' : 'paystack';
}

/**
 * Gets banks that are only available in Paystack (not in SafeHaven)
 * @returns Array of Paystack banks that don't have a SafeHaven equivalent
 */
export function getPaystackOnlyBanks(): PaystackBank[] {
  return paystackBanks.filter(bank => {
    const safeHavenCode = getSafeHavenBankCode(bank.code, bank.name);
    return safeHavenCode === null;
  });
}

/**
 * Gets banks that are available in both Paystack and SafeHaven
 * @returns Array of objects with Paystack bank and corresponding SafeHaven code
 */
export function getBanksAvailableInBoth(): Array<{
  paystackBank: PaystackBank;
  safeHavenCode: string;
}> {
  const result: Array<{ paystackBank: PaystackBank; safeHavenCode: string }> = [];
  
  for (const bank of paystackBanks) {
    const safeHavenCode = getSafeHavenBankCode(bank.code, bank.name);
    if (safeHavenCode) {
      result.push({
        paystackBank: bank,
        safeHavenCode
      });
    }
  }
  
  return result;
}

