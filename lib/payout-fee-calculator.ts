/**
 * Central payout fee calculator: processing (1.5% capped ₦500), transaction (₦10.75 per payout), stamp duty (₦50 per payout when amount > ₦9,999).
 */

import {
  PLAN_CREATION_FEE_PERCENT,
  PLAN_CREATION_FEE_CAP_NAIRA,
  TRANSACTION_FEE_NAIRA,
  STAMP_DUTY_NAIRA,
  STAMP_DUTY_THRESHOLD_NAIRA,
} from '@/types/payout-fees';

export interface PayoutFeeResult {
  processingFee: number;
  stampDuty: number;
  transactionFee: number;
  totalFees: number;
  netPayoutAmount: number;
  perPayoutAmount: number;
}

function roundDownTo2(value: number): number {
  return Math.floor(value * 100) / 100;
}

/**
 * Calculate fees for a regular plan (frequency + duration).
 * Per-payout amount used for stamp duty is the net amount (after fees) per payout.
 */
export function calculatePayoutFees(
  totalAmount: number,
  numberOfPayouts: number
): PayoutFeeResult {
  if (numberOfPayouts < 1 || totalAmount <= 0) {
    return {
      processingFee: 0,
      stampDuty: 0,
      transactionFee: 0,
      totalFees: 0,
      netPayoutAmount: totalAmount,
      perPayoutAmount: numberOfPayouts > 0 ? totalAmount / numberOfPayouts : 0,
    };
  }

  const processingFee = roundDownTo2(
    Math.min(totalAmount * (PLAN_CREATION_FEE_PERCENT / 100), PLAN_CREATION_FEE_CAP_NAIRA)
  );
  const transactionFee = roundDownTo2(TRANSACTION_FEE_NAIRA * numberOfPayouts);

  // Stamp duty: ₦50 per payout where (net) per-payout amount > ₦9,999.
  // Net per-payout = (totalAmount - totalFees) / numberOfPayouts. We need one pass: assume no stamp, then check.
  const feesWithoutStamp = processingFee + transactionFee;
  const netIfNoStamp = totalAmount - feesWithoutStamp;
  const perPayoutIfNoStamp = netIfNoStamp / numberOfPayouts;
  const stampDuty =
    perPayoutIfNoStamp > STAMP_DUTY_THRESHOLD_NAIRA
      ? roundDownTo2(STAMP_DUTY_NAIRA * numberOfPayouts)
      : 0;

  const totalFees = roundDownTo2(processingFee + stampDuty + transactionFee);
  const netPayoutAmount = roundDownTo2(totalAmount - totalFees);
  const perPayoutAmount = roundDownTo2(netPayoutAmount / numberOfPayouts);

  return {
    processingFee,
    stampDuty,
    transactionFee,
    totalFees,
    netPayoutAmount,
    perPayoutAmount,
  };
}

/**
 * Calculate fees for a custom plan with explicit per-payout amounts.
 * Stamp duty is applied per payout where that payout's amount > ₦9,999.
 */
export function calculatePayoutFeesCustom(
  totalAmount: number,
  perPayoutAmounts: number[]
): PayoutFeeResult {
  const numberOfPayouts = perPayoutAmounts.length;
  if (numberOfPayouts < 1 || totalAmount <= 0) {
    return {
      processingFee: 0,
      stampDuty: 0,
      transactionFee: 0,
      totalFees: 0,
      netPayoutAmount: totalAmount,
      perPayoutAmount: numberOfPayouts > 0 ? totalAmount / numberOfPayouts : 0,
    };
  }

  const processingFee = roundDownTo2(
    Math.min(totalAmount * (PLAN_CREATION_FEE_PERCENT / 100), PLAN_CREATION_FEE_CAP_NAIRA)
  );
  const transactionFee = roundDownTo2(TRANSACTION_FEE_NAIRA * numberOfPayouts);
  const stampDutyCount = perPayoutAmounts.filter((a) => a > STAMP_DUTY_THRESHOLD_NAIRA).length;
  const stampDuty = roundDownTo2(STAMP_DUTY_NAIRA * stampDutyCount);

  const totalFees = roundDownTo2(processingFee + stampDuty + transactionFee);
  const netPayoutAmount = roundDownTo2(totalAmount - totalFees);
  const perPayoutAmount =
    numberOfPayouts > 0 ? roundDownTo2(netPayoutAmount / numberOfPayouts) : 0;

  return {
    processingFee,
    stampDuty,
    transactionFee,
    totalFees,
    netPayoutAmount,
    perPayoutAmount,
  };
}
