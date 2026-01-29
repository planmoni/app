/*
  # Create Helper Function for Partner Access (Non-Recursive)
  
  This function helps check partner access without causing RLS recursion.
  It's marked as SECURITY DEFINER so it bypasses RLS when checking.
*/

-- Function to check if a user belongs to a partner organization
-- This avoids RLS recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION check_user_partner_access(
  p_user_id uuid,
  p_partner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user is associated with the partner
  -- Using SECURITY DEFINER bypasses RLS, preventing recursion
  RETURN EXISTS (
    SELECT 1 
    FROM partner_users
    WHERE user_id = p_user_id
      AND partner_id = p_partner_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_partner_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_partner_access(uuid, uuid) TO service_role;

-- Now we can use this function in policies (but still need to be careful)
-- Actually, let's not use it in policies - use it in application code instead
-- Policies should remain simple to avoid any recursion risk
