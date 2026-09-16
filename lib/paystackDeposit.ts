/**
 * Shared Paystack fee helpers — keep in sync with checkout + verify + webhook.
 * Fee is calculated on the amount the user wants credited (not on total paid).
 */

export const PAYSTACK_MIN_CREDIT = 500;
export const PAYSTACK_MAX_CREDIT = 5_000_000;

/** Fee on intended credit amount (matches app/paystack-payment.tsx). */
export function calculatePaystackFee(amountToCredit: number): number {
  if (amountToCredit <= 0) return 0;
  const percentageFee = amountToCredit * 0.015;
  if (amountToCredit < 2500) {
    return Math.round(percentageFee * 100) / 100;
  }
  return Math.min(Math.round((percentageFee + 100) * 100) / 100, 2000);
}

export function totalPaystackCharge(amountToCredit: number): number {
  return amountToCredit + calculatePaystackFee(amountToCredit);
}

/**
 * Resolve how much to credit the wallet from a successful Paystack charge.
 * Never credits more than paid. Prefers metadata.amount_to_credit for checkout.
 */
export function resolvePaystackCreditAmount(opts: {
  paidNaira: number;
  metadata?: Record<string, unknown> | null;
}): { amountToCredit: number; fee: number; source: string } {
  const paid = Number(opts.paidNaira) || 0;
  const meta = opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {};

  const parseNum = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  let amountToCredit =
    parseNum(meta.amount_to_credit) ??
    parseNum(meta.amountToCredit) ??
    null;

  let fee = parseNum(meta.fee) ?? parseNum(meta.fees) ?? null;
  const paymentType = String(meta.payment_type || '');

  // custom_fields fallback
  const customFields = (meta as { custom_fields?: Array<{ variable_name?: string; value?: unknown }> }).custom_fields;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (field.variable_name === 'amount_to_credit' && amountToCredit == null) {
        amountToCredit = parseNum(field.value);
      }
      if (field.variable_name === 'fee' && fee == null) {
        fee = parseNum(field.value);
      }
    }
  }

  if (amountToCredit != null && amountToCredit > 0) {
    // Never credit more than Paystack actually collected
    const credit = Math.min(amountToCredit, paid);
    const resolvedFee = fee != null ? fee : Math.max(0, Math.round((paid - credit) * 100) / 100);
    return { amountToCredit: credit, fee: resolvedFee, source: 'metadata' };
  }

  // Checkout-style charge without metadata: reverse fee using the same formula
  if (paymentType === 'paystack_checkout' || paid >= 2500) {
    // Try uncapped reverse: paid = C + min(C*0.015+100, 2000)
    // Prefer reverse of 1.5%+100 when paid is large enough
    let candidate = Math.round(((paid - 100) / 1.015) * 100) / 100;
    if (candidate > 0 && candidate < 2500) {
      candidate = Math.round((paid / 1.015) * 100) / 100;
    }
    const feeForCandidate = calculatePaystackFee(candidate);
    if (Math.abs(candidate + feeForCandidate - paid) <= 1.5) {
      return {
        amountToCredit: Math.min(candidate, paid),
        fee: feeForCandidate,
        source: 'reverse_fee',
      };
    }
  }

  // Virtual account / USSD / unknown: credit full amount paid
  return { amountToCredit: paid, fee: 0, source: 'paid_in_full' };
}
