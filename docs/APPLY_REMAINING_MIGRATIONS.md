# Apply Remaining Migrations

## Current Status

✅ **7 out of 9 migrations applied successfully!**

### ✅ Applied Migrations:
1. Partners System
2. Restricted Wallets  
3. Partner Context
4. Policy Engine Functions
5. Approval Workflows
6. Audit Ledger
7. Ledger Functions

### ❌ Remaining Migrations:
1. **Webhook Deliveries** (`20260126122927_create_webhook_deliveries.sql`)
2. **Usage Tracking** (`20260126122928_create_usage_tracking.sql`)

## Quick Apply (Recommended)

### Option 1: Use Combined SQL File

A combined SQL file has been generated for you:

**File:** `supabase/migrations/REMAINING_MIGRATIONS.sql`

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** > **New Query**
3. Open the file: `supabase/migrations/REMAINING_MIGRATIONS.sql`
4. Copy the entire content
5. Paste into SQL Editor
6. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

### Option 2: Apply Individually

Apply each migration file separately:

1. **Webhook Deliveries:**
   - Open: `supabase/migrations/20260126122927_create_webhook_deliveries.sql`
   - Copy SQL → Paste in SQL Editor → Execute

2. **Usage Tracking:**
   - Open: `supabase/migrations/20260126122928_create_usage_tracking.sql`
   - Copy SQL → Paste in SQL Editor → Execute

## What These Migrations Create

### Webhook Deliveries Migration:
- `webhook_configurations` table - Partner webhook settings
- `webhook_deliveries` table - Webhook delivery tracking
- RLS policies for security
- Triggers for updated_at timestamps

### Usage Tracking Migration:
- `api_usage_logs` table - API call logging
- `partner_rate_limits` table - Rate limit configuration
- `check_rate_limit()` function - Rate limiting logic
- RLS policies for security

## Verification

After applying, verify with:

```bash
node scripts/verify-paas-migrations.js
```

Or check manually:

```sql
-- Check webhook tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('webhook_configurations', 'webhook_deliveries');

-- Check usage tracking tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('api_usage_logs', 'partner_rate_limits');

-- Check rate limit function
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'check_rate_limit';
```

## Troubleshooting

### Error: "relation already exists"
- ✅ Safe to ignore - migration handles this

### Error: "constraint already exists"  
- ✅ Safe to ignore - migration checks before adding

### Error: "permission denied"
- Check you're using service role key or have proper permissions

## Next Steps

After applying:
1. ✅ Verify all 9 migrations are applied
2. ✅ Test webhook configuration API
3. ✅ Test rate limiting
4. ✅ Start using PaaS features!
