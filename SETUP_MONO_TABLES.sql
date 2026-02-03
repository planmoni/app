-- 1. Ensure profiles has the mono_customer_id column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mono_customer_id text;

-- 2. Create the mono_mandates table
CREATE TABLE IF NOT EXISTS public.mono_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE NOT NULL,
  mono_account_id text NOT NULL,
  mono_mandate_id text UNIQUE,
  mono_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'failed')),
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  bank_code text,
  mandate_type text,
  max_amount numeric,
  expiry_date timestamptz,
  authorized_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  mono_webhook_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create the partial unique index
-- This ensures only one 'active' mandate exists per bank account
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_mandate_per_account 
ON public.mono_mandates (bank_account_id) 
WHERE status = 'active';

-- 4. Enable RLS
ALTER TABLE public.mono_mandates ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (wrapped in DO block to prevent errors if already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mono_mandates' AND policyname = 'Users can view own mandates') THEN
        CREATE POLICY "Users can view own mandates" ON public.mono_mandates FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mono_mandates' AND policyname = 'Users can insert own mandates') THEN
        CREATE POLICY "Users can insert own mandates" ON public.mono_mandates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mono_mandates' AND policyname = 'Users can update own mandates') THEN
        CREATE POLICY "Users can update own mandates" ON public.mono_mandates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS idx_mono_mandates_user_id ON public.mono_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_mono_mandates_bank_account_id ON public.mono_mandates(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mono_customer_id ON public.profiles(mono_customer_id) WHERE mono_customer_id IS NOT NULL;

-- 7. Add process_mono_deposit atomic function
CREATE OR REPLACE FUNCTION public.process_mono_deposit(
  arg_user_id uuid,
  arg_amount numeric,
  arg_reference text,
  arg_mono_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_event_id uuid;
  v_already_processed boolean := false;
BEGIN
  -- Check if transaction already exists (idempotency)
  SELECT EXISTS(
    SELECT 1 FROM public.transactions 
    WHERE reference = arg_reference 
    AND type = 'deposit'
    AND source IN ('mono_directpay', 'mono_directdebit')
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    SELECT id INTO v_transaction_id FROM public.transactions WHERE reference = arg_reference LIMIT 1;
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = arg_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'transaction_id', v_transaction_id,
      'new_balance', v_new_balance
    );
  END IF;
  
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets 
  WHERE user_id = arg_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', arg_user_id;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + arg_amount;
  
  -- Atomic update
  UPDATE public.wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet_id;
    
  -- Create transaction record
  INSERT INTO public.transactions (
    user_id, type, amount, status, source, destination, reference, description, metadata
  ) VALUES (
    arg_user_id, 'deposit', arg_amount, 'completed', 
    COALESCE(arg_mono_data->>'source', 'mono_directdebit'),
    'wallet', arg_reference, 
    CASE WHEN (arg_mono_data->>'source' = 'mono_directpay') THEN 'Mono DirectPay deposit' ELSE 'Mono DirectDebit deposit' END,
    arg_mono_data
  ) RETURNING id INTO v_transaction_id;
    
  -- Create event for notification
  INSERT INTO public.events (
    user_id, type, title, description, status, metadata
  ) VALUES (
    arg_user_id, 'deposit_successful', 'Deposit Successful',
    format('₦%s has been added to your wallet via Mono', to_char(arg_amount, 'FM999,999,999.00')),
    'unread',
    jsonb_build_object('transaction_id', v_transaction_id, 'amount', arg_amount, 'reference', arg_reference)
  ) RETURNING id INTO v_event_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount', arg_amount
  );
END;
$$;
