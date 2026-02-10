-- Add fee and total_charged columns to mono_directpay_payments
-- fee = Mono DirectPay fee charged on top of the deposit amount
-- total_charged = deposit amount + fee (what Mono actually charges)

ALTER TABLE mono_directpay_payments ADD COLUMN IF NOT EXISTS fee numeric DEFAULT 0;
ALTER TABLE mono_directpay_payments ADD COLUMN IF NOT EXISTS total_charged numeric;

COMMENT ON COLUMN mono_directpay_payments.fee IS 'Mono DirectPay fee charged on top of the deposit amount (Naira)';
COMMENT ON COLUMN mono_directpay_payments.total_charged IS 'Total amount charged via Mono (deposit + fee) in Naira';
