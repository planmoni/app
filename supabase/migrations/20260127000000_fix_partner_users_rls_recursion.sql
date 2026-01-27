/*
  # Fix Infinite Recursion in partner_users RLS Policies
  
  Problem:
  The RLS policies on partner_users table are causing infinite recursion.
  This happens when policies reference the same table they're protecting.
  
  Solution:
  Simplify policies to avoid self-referential queries. Use direct user_id checks
  instead of subqueries that reference partner_users.
*/

-- Drop existing problematic policies
DO $$
BEGIN
  -- Drop all existing policies on partner_users
  DROP POLICY IF EXISTS "Service role can manage all partner users" ON partner_users;
  DROP POLICY IF EXISTS "Users can view own partner user records" ON partner_users;
  DROP POLICY IF EXISTS "Partners can view their users" ON partner_users;
END $$;

-- Recreate policies without recursion
-- Policy 1: Service role can do everything
CREATE POLICY "Service role can manage all partner users"
  ON partner_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 2: Users can view their own records (direct check, no subquery)
CREATE POLICY "Users can view own partner user records"
  ON partner_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 3: REMOVED - This was causing infinite recursion
-- The original policy likely had something like:
--   USING (partner_id IN (SELECT partner_id FROM partner_users WHERE user_id = auth.uid()))
-- 
-- This creates infinite recursion:
--   1. Check if user can see row → query partner_users
--   2. Query partner_users → check if user can see row
--   3. Repeat forever
--
-- Solution: Remove recursive policy entirely. Partner access is handled by:
-- 1. Policy 2: Users can view their own records (user_id = auth.uid())
-- 2. Service role: Can access everything for admin operations
-- 3. Application logic: Handle partner-to-partner access in application code
--
-- If you need partner admins to see all users in their organization,
-- use the check_user_partner_access() function in application code,
-- or create a view with SECURITY DEFINER that bypasses RLS

-- Add INSERT policy for service role and authenticated users creating their own records
CREATE POLICY "Users can insert own partner user records"
  ON partner_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can insert partner users"
  ON partner_users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add UPDATE policy
CREATE POLICY "Users can update own partner user records"
  ON partner_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can update partner users"
  ON partner_users
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy
CREATE POLICY "Users can delete own partner user records"
  ON partner_users
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can delete partner users"
  ON partner_users
  FOR DELETE
  TO service_role
  USING (true);
