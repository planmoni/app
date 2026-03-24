/**
 * Mono DirectPay fee calculation
 *
 * Fee structure (charged ON TOP of the deposit amount):
 *
 *   For transactions < 1500 NGN:
 *     (0.5% capped at 500 NGN) + 7.5% VAT
 *
 *   For transactions >= 1500 NGN:
 *     ((0.5% capped at 500 NGN) + 60 NGN) + 7.5% VAT
 */

export interface MonoDirectPayFee {
  /** The base percentage fee (0.5% capped at 500) */
  baseFee: number;
  /** Stamp duty (60 NGN if amount >= 1500, else 0) */
  stamp: number;
  /** baseFee + stamp (before VAT) */
  subTotal: number;
  /** 7.5% VAT on subTotal */
  vat: number;
  /** Total fee (subTotal + vat) */
  fee: number;
  /** Total amount charged to the user (deposit + fee) */
  totalCharged: number;
}

const RATE = 0.005; // 0.5%
const CAP = 500; // Max base fee in Naira
const STAMP_THRESHOLD = 1500; // Stamp duty kicks in at >= 1500
const STAMP_DUTY = 60; // Stamp duty in Naira
const VAT_RATE = 0.075; // 7.5%

/**
 * Calculate Mono DirectPay fee for a given deposit amount in Naira.
 * Returns all fee components and the total that should be sent to Mono.
 */
export function calculateMonoDirectPayFee(amountNaira: number): MonoDirectPayFee {
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return { baseFee: 0, stamp: 0, subTotal: 0, vat: 0, fee: 0, totalCharged: 0 };
  }

  const baseFee = Math.min(amountNaira * RATE, CAP);
  const stamp = amountNaira >= STAMP_THRESHOLD ? STAMP_DUTY : 0;
  const subTotal = baseFee + stamp;
  const vat = subTotal * VAT_RATE;
  const fee = Math.round((subTotal + vat) * 100) / 100; // round to 2dp
  const totalCharged = Math.round((amountNaira + fee) * 100) / 100;

  return { baseFee: Math.round(baseFee * 100) / 100, stamp, subTotal: Math.round(subTotal * 100) / 100, vat: Math.round(vat * 100) / 100, fee, totalCharged };
}
