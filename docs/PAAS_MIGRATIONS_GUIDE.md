# PaaS Database Migrations Guide

This guide explains how to apply the 9 database migrations for the Planmoni Platform-as-a-Service implementation.

## Migration Files

All migrations are located in `supabase/migrations/` and should be applied in this order:

1. **20260126122920_create_partners_system.sql**
   - Creates `partners`, `partner_api_keys`, `partner_users`, `partner_settings` tables
   - Sets up partner management infrastructure

2. **20260126122921_create_restricted_wallets.sql**
   - Creates `wallet_restrictions` and `wallet_policies` tables
   - Adds partner context to wallets table

3. **20260126122922_add_partner_context.sql**
   - Adds `partner_id` to `payout_plans`, `transactions`, `bank_accounts`
   - Maintains backward compatibility (all nullable)

4. **20260126122923_create_policy_engine_functions.sql**
   - Creates `check_wallet_restrictions()` function
   - Creates `get_required_approvals()` function
   - Creates `evaluate_wallet_policy()` function

5. **20260126122924_create_approval_workflows.sql**
   - Creates `approval_workflows`, `approval_requests`, `approval_actions` tables
   - Sets up approval workflow system

6. **20260126122925_create_audit_ledger.sql**
   - Creates `audit_ledger` and `audit_events` tables
   - Implements append-only audit trail

7. **20260126122926_create_ledger_functions.sql**
   - Creates `append_ledger_entry()` function
   - Creates `verify_ledger_integrity()` function
   - Creates `get_ledger_history()` function

8. **20260126122927_create_webhook_deliveries.sql**
   - Creates `webhook_configurations` and `webhook_deliveries` tables
   - Sets up webhook delivery tracking

9. **20260126122928_create_usage_tracking.sql**
   - Creates `api_usage_logs` and `partner_rate_limits` tables
   - Creates `check_rate_limit()` function

## Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** > **New Query**
3. For each migration file:
   - Open the file from `supabase/migrations/`
   - Copy the entire SQL content
   - Paste into the SQL Editor
   - Click **Run** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
4. Verify each migration completed successfully
5. Move to the next migration file

## Method 2: Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push

# Or push specific migration
supabase db push --file supabase/migrations/20260126122920_create_partners_system.sql
```

## Method 3: psql (Direct Database Access)

If you have direct database access:

```bash
# Connect to your database
psql -h aws-0-eu-west-2.pooler.supabase.com \
     -U postgres.rqmpnoaavyizlwzfngpr \
     -d postgres

# Then run each migration
\i supabase/migrations/20260126122920_create_partners_system.sql
\i supabase/migrations/20260126122921_create_restricted_wallets.sql
# ... continue for all 9 files
```

## Method 4: Programmatic (Node.js/TypeScript)

If you need to apply migrations programmatically, you can use the Supabase Management API or create a script that executes SQL via the REST API.

## Verification

After applying all migrations, verify by checking:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'partners', 
    'partner_api_keys', 
    'wallet_restrictions',
    'wallet_policies',
    'approval_workflows',
    'approval_requests',
    'audit_ledger',
    'webhook_configurations',
    'api_usage_logs'
  );

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_wallet_restrictions',
    'get_required_approvals',
    'append_ledger_entry',
    'verify_ledger_integrity',
    'check_rate_limit'
  );
```

## Rollback

If you need to rollback:

1. **Soft Rollback**: Deactivate features by setting `is_active = false` on relevant records
2. **Hard Rollback**: Drop tables (⚠️ **WARNING**: This will delete data)
   ```sql
   DROP TABLE IF EXISTS api_usage_logs CASCADE;
   DROP TABLE IF EXISTS webhook_deliveries CASCADE;
   DROP TABLE IF EXISTS webhook_configurations CASCADE;
   -- ... continue for all tables
   ```

## Troubleshooting

### Error: "relation already exists"
- Some tables might already exist. The migrations use `CREATE TABLE IF NOT EXISTS` to handle this.
- If you see this error, the migration is likely safe to skip.

### Error: "permission denied"
- Make sure you're using the service role key or have proper database permissions.
- Check that RLS policies allow your user to create tables.

### Error: "foreign key constraint"
- Make sure migrations are run in order.
- Check that referenced tables (like `profiles`, `wallets`) exist.

## Next Steps

After migrations are applied:

1. ✅ Verify all tables and functions exist
2. ✅ Test API endpoints
3. ✅ Create a test partner
4. ✅ Generate API keys
5. ✅ Test wallet creation
6. ✅ Test policy evaluation
7. ✅ Test approval workflows

## Support

If you encounter issues:
- Check Supabase logs in the Dashboard
- Verify environment variables are set correctly
- Ensure database has sufficient permissions
- Review migration SQL for syntax errors
