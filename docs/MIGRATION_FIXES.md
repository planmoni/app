# Migration Fixes Applied

## Issues Fixed

### Problem
Migrations were failing because they tried to create foreign key constraints to the `partners` table before it existed, or when applying migrations out of order.

### Solution
Updated all migrations to:
1. Check if the `partners` table exists before adding foreign key constraints
2. Create tables without foreign keys first, then add constraints separately
3. Use `DO $$` blocks to handle conditional logic safely

## Fixed Migrations

### 1. `20260126122921_create_restricted_wallets.sql`
- **Fixed**: `wallets.partner_id` column addition now checks for partners table
- **Fixed**: `wallet_policies` table creation handles missing partners table

### 2. `20260126122922_add_partner_context.sql`
- **Fixed**: All `partner_id` column additions now check for partners table first
- **Fixed**: Foreign key constraints added separately after column creation

### 3. `20260126122924_create_approval_workflows.sql`
- **Fixed**: `approval_workflows` and `approval_requests` tables handle missing partners table

### 4. `20260126122925_create_audit_ledger.sql`
- **Fixed**: `audit_ledger` and `audit_events` tables handle missing partners table

### 5. `20260126122927_create_webhook_deliveries.sql`
- **Fixed**: `webhook_configurations` and `webhook_deliveries` handle missing partners table

### 6. `20260126122928_create_usage_tracking.sql`
- **Fixed**: `api_usage_logs` and `partner_rate_limits` handle missing partners table

## How It Works Now

1. **First Migration** (`create_partners_system.sql`): Creates partners table - must run first
2. **Subsequent Migrations**: Check if partners exists before adding foreign keys
3. **Foreign Keys**: Added separately after table/column creation
4. **Safe Re-runs**: Migrations can be run multiple times safely

## Applying Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to SQL Editor
2. Apply migrations in order (1-9)
3. Each migration will now handle missing dependencies gracefully

### Option 2: Supabase CLI
```bash
supabase db push
```

### Option 3: Script (if you have Management API access)
```bash
node scripts/apply-migrations-safe.js
```

## Verification

After applying, verify with:
```bash
node scripts/verify-paas-migrations.js
```

## Common Errors and Solutions

### Error: "relation 'partners' does not exist"
- **Solution**: Make sure migration 1 (`create_partners_system.sql`) is applied first

### Error: "constraint already exists"
- **Solution**: This is safe to ignore - the migration handles this with `IF NOT EXISTS`

### Error: "column already exists"
- **Solution**: This is safe to ignore - migrations use `ADD COLUMN IF NOT EXISTS`

## Next Steps

1. ✅ Apply migration 1 first (creates partners table)
2. ✅ Apply remaining migrations in order
3. ✅ Verify with verification script
4. ✅ Test API endpoints

All migrations are now safe to apply and can handle missing dependencies!
