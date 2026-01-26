# PaaS Migrations - Quick Start

## ✅ Migration Files Created

All 9 migration files have been created in `supabase/migrations/`:

1. `20260126122920_create_partners_system.sql`
2. `20260126122921_create_restricted_wallets.sql`
3. `20260126122922_add_partner_context.sql`
4. `20260126122923_create_policy_engine_functions.sql`
5. `20260126122924_create_approval_workflows.sql`
6. `20260126122925_create_audit_ledger.sql`
7. `20260126122926_create_ledger_functions.sql`
8. `20260126122927_create_webhook_deliveries.sql`
9. `20260126122928_create_usage_tracking.sql`

## 🚀 Apply Migrations

### Method 1: Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Open each migration file from `supabase/migrations/`
3. Copy the SQL content
4. Paste into SQL Editor
5. Click **Run**
6. Repeat for all 9 files in order

### Method 2: Supabase CLI

```bash
# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

## ✅ Verify Migrations

After applying migrations, verify they were successful:

```bash
# Make sure environment variables are set
export EXPO_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run verification script
node scripts/verify-paas-migrations.js
```

Or use TypeScript:

```bash
npx tsx scripts/verify-paas-migrations.ts
```

## 📖 Full Documentation

See `docs/PAAS_MIGRATIONS_GUIDE.md` for detailed instructions and troubleshooting.

## 🎯 What Gets Created

- **15 new tables** for partners, wallets, approvals, audit, webhooks, and usage tracking
- **8 database functions** for policy evaluation, approvals, ledger, and rate limiting
- **Partner context** added to existing tables (backward compatible)
- **RLS policies** for security
- **Indexes** for performance

## ⚠️ Important Notes

- All migrations use `IF NOT EXISTS` - safe to run multiple times
- `partner_id` columns are nullable - B2C functionality preserved
- Migrations are ordered and should be run sequentially
- No data loss - all existing data is preserved

## 🆘 Need Help?

- Check `docs/PAAS_MIGRATIONS_GUIDE.md` for troubleshooting
- Verify environment variables are set correctly
- Check Supabase dashboard logs for errors
- Ensure you have proper database permissions
