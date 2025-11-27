-- Create bank_comparison table in Supabase
-- This table stores the comparison between Paystack and SafeHaven banks

CREATE TABLE IF NOT EXISTS bank_comparison (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  paystack_code TEXT NOT NULL,
  safehaven_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('Available in SafeHaven', 'Paystack Only')),
  provider TEXT NOT NULL CHECK (provider IN ('SafeHaven', 'Paystack')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_comparison_paystack_code ON bank_comparison(paystack_code);
CREATE INDEX IF NOT EXISTS idx_bank_comparison_safehaven_code ON bank_comparison(safehaven_code);
CREATE INDEX IF NOT EXISTS idx_bank_comparison_status ON bank_comparison(status);
CREATE INDEX IF NOT EXISTS idx_bank_comparison_bank_name ON bank_comparison(bank_name);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE bank_comparison ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (adjust based on your needs)
CREATE POLICY "Allow public read access" ON bank_comparison
  FOR SELECT
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bank_comparison_updated_at
  BEFORE UPDATE ON bank_comparison
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

