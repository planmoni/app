/*
  # Add metadata column to payout_plans table
  
  1. Changes
    - Add a JSONB column called 'metadata' to the payout_plans table
    - This column will store additional information about the payout plan, such as:
      - Original frequency type (for special frequencies like weekly_specific)
      - Day of week for weekly_specific frequency
      - Other custom settings that don't fit into the existing schema
  
  2. Rationale
    - The database has a constraint that only allows certain values for the frequency column
    - This allows us to store additional frequency information while maintaining compatibility
*/

-- Add metadata column to payout_plans table
ALTER TABLE IF EXISTS public.payout_plans 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN public.payout_plans.metadata IS 'Additional metadata for the payout plan, such as original frequency type, day of week, etc.';