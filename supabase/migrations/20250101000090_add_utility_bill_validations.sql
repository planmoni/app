-- Create utility_bill_validations table
CREATE TABLE IF NOT EXISTS utility_bill_validations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    validation_result JSONB NOT NULL,
    validation_checks JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT false,
    user_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_utility_bill_validations_user_id ON utility_bill_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_utility_bill_validations_created_at ON utility_bill_validations(created_at);

-- Enable RLS
ALTER TABLE utility_bill_validations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own utility bill validations" ON utility_bill_validations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own utility bill validations" ON utility_bill_validations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_utility_bill_validations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_utility_bill_validations_updated_at
    BEFORE UPDATE ON utility_bill_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_utility_bill_validations_updated_at();

