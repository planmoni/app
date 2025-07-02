-- 1. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES profiles(id) NOT NULL,
  referred_id uuid REFERENCES profiles(id) NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'qualified', 'rewarded'
  created_at timestamptz DEFAULT now()
);

-- 2. Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

-- 3. Wallets Table (if not exists)
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL UNIQUE,
  balance numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Transactions Table (if not exists)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  type text NOT NULL, -- 'deposit', 'reward', etc.
  amount numeric NOT NULL,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

-- 5. RLS Policies
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view their referrals" ON referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());
CREATE POLICY "User can view their deposits" ON deposits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "User can view their wallet" ON wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "User can view their transactions" ON transactions FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can update referrals" ON referrals FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role can update deposits" ON deposits FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role can update wallets" ON wallets FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role can insert transactions" ON transactions FOR INSERT USING (auth.role() = 'service_role');

-- 6. Atomic Wallet Update Function
CREATE OR REPLACE FUNCTION increment_wallet_balance(user_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE wallets SET balance = balance + amount, updated_at = now() WHERE wallets.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 