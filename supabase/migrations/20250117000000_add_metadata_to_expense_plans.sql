/*
  # Add metadata column to expense_plans table
  
  This migration adds a metadata column to store additional information
  like the last step the user was on when creating a plan.
*/

-- Add metadata column to expense_plans table
ALTER TABLE expense_plans 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN expense_plans.metadata IS 'Stores additional metadata like last_step for resuming plan creation';

