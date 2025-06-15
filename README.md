# Planmoni

A React Native Expo app for financial planning and monitoring.

## Database Migrations

Since this project runs in WebContainer, the Supabase CLI is not available. To apply database migrations:

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of each migration file from `supabase/migrations/` in chronological order
4. Execute each migration manually

### Option 2: Programmatic Migration
The migrations can be applied programmatically using the Supabase client. See the migration files in `supabase/migrations/` for the SQL to execute.

## ⚠️ URGENT: Fix Required for lock_funds Function

**There is currently a critical database error that needs to be resolved immediately.**

The `lock_funds` function has conflicting definitions causing function overloading errors. To fix this:

1. **Go to your Supabase Dashboard** → SQL Editor
2. **Copy and paste the entire contents** of `supabase/migrations/20250615135506_proud_coral.sql`
3. **Execute the SQL** to resolve the function conflict

**This migration MUST be applied before the app can function properly.**

## Available Migrations
- `20250605200539_silent_bar.sql`
- `20250605200543_broad_field.sql`
- `20250605200546_crimson_stream.sql`
- `20250605200551_morning_violet.sql`
- `20250605200557_copper_rice.sql`
- `20250605200600_small_flame.sql`
- `20250605200604_lingering_union.sql`
- `20250605203724_crystal_silence.sql`
- `20250605204341_ancient_portal.sql`
- `20250605215648_dark_mud.sql`
- `20250606120128_pink_lantern.sql`
- `20250606123054_soft_trail.sql`
- `20250606124133_violet_thunder.sql`
- `20250611200454_jade_shadow.sql`
- `20250614164613_foggy_garden.sql`
- `20250614164637_old_swamp.sql`
- `20250614164923_late_valley.sql`
- `20250614170800_sunny_term.sql`
- `20250614185753_wispy_darkness.sql`
- `20250615123429_bright_prism.sql`
- **`20250615135506_proud_coral.sql` ← APPLY THIS IMMEDIATELY**

## Development

```bash
npm install
npm run dev
```

## Environment Setup

Make sure to configure your `.env` file with the necessary Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```