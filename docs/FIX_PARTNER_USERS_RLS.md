# Fix: Infinite Recursion in partner_users RLS Policies

## Problem

The error `"infinite recursion detected in policy for relation \"partner_users\""` occurs when RLS policies on the `partner_users` table reference the same table in their conditions.

## Root Cause

A policy like this causes infinite recursion:

```sql
CREATE POLICY "Partners can view their users"
  ON partner_users
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );
```

**Why it recurses:**
1. User queries `partner_users` table
2. RLS checks: "Can user see this row?"
3. Policy executes: "Check if `partner_id IN (SELECT ... FROM partner_users ...)`"
4. That SELECT triggers RLS again: "Can user see rows in partner_users?"
5. Policy executes again → **Infinite loop**

## Solution

### Migration 1: Fix Policies (`20260127000000_fix_partner_users_rls_recursion.sql`)

This migration:
1. **Drops all existing policies** on `partner_users`
2. **Recreates simple, non-recursive policies:**
   - Service role: Full access
   - Users: Can view/update/delete their own records (`user_id = auth.uid()`)
   - **Removes the recursive "Partners can view their users" policy**

### Migration 2: Helper Function (`20260127000001_create_partner_access_function.sql`)

Creates a `SECURITY DEFINER` function for application-level partner access checks:

```sql
SELECT check_user_partner_access(user_id, partner_id);
```

This function bypasses RLS, so it can safely query `partner_users` without recursion.

## How to Apply

1. **Apply Migration 1** (fixes the immediate issue):
   ```sql
   -- Run in Supabase SQL Editor
   -- Copy contents of: 20260127000000_fix_partner_users_rls_recursion.sql
   ```

2. **Apply Migration 2** (optional, for application-level checks):
   ```sql
   -- Run in Supabase SQL Editor  
   -- Copy contents of: 20260127000001_create_partner_access_function.sql
   ```

## After Fix

- ✅ No more infinite recursion errors
- ✅ Users can view their own `partner_users` records
- ✅ Service role can access everything
- ⚠️ Partner admins can't directly query all users in their org via RLS
- ✅ Use application logic or the helper function for partner admin access

## Alternative: Partner Admin Access

If you need partner admins to see all users in their organization:

### Option 1: Use Helper Function in Application
```typescript
// In your API/application code
const { data } = await supabase.rpc('check_user_partner_access', {
  p_user_id: userId,
  p_partner_id: partnerId
});
```

### Option 2: Create a View with SECURITY DEFINER
```sql
CREATE VIEW partner_users_admin AS
SELECT * FROM partner_users;

-- Grant access to authenticated users
GRANT SELECT ON partner_users_admin TO authenticated;
```

### Option 3: Use Service Role for Admin Operations
Use the service role key for partner admin operations that need to see all users.

## Verification

After applying the fix, test:

```sql
-- Should work (user viewing own record)
SELECT * FROM partner_users WHERE user_id = auth.uid();

-- Should work (service role)
-- (Use service role key)

-- Should NOT cause recursion error
SELECT * FROM partner_users;
```

## Related Tables

Check these tables for similar recursive policy issues:
- `partners` - May have policies checking `partner_users`
- `partner_settings` - May have policies checking `partner_users`
- Any table with policies that query `partner_users`

---

**Status**: ✅ Fixed
**Date**: January 27, 2026
