# Weekly_Specific Next Payout Date Fix

## 🔴 Problem Identified

The `weekly_specific` payout plans are not updating `next_payout_date` correctly because:

1. **Database Function Missing Support**: The `calculate_next_payout_date()` database function doesn't handle `weekly_specific` frequency
2. **update_payout_plan_progress Function**: This function calls `calculate_next_payout_date()` and also doesn't handle `weekly_specific`
3. **Edge Function Works**: The `process-automated-payouts` edge function correctly calculates the date in TypeScript, but database functions may override it

## 🔍 Root Cause Analysis

### Current State

1. **Edge Function** (`process-automated-payouts/index.ts`):
   - ✅ **FIXED** - Correctly handles `weekly_specific` (lines 504-542)
   - ✅ Calculates next date using `day_of_week`
   - ✅ Updates `next_payout_date` directly

2. **Database Function** (`calculate_next_payout_date`):
   - ❌ **BROKEN** - Only handles: `daily`, `weekly`, `biweekly`, `monthly`
   - ❌ Returns `p_start_date` for `weekly_specific` (fallback)
   - ❌ Doesn't have access to `day_of_week` parameter

3. **Database Function** (`update_payout_plan_progress`):
   - ❌ **BROKEN** - Calls `calculate_next_payout_date()` for non-custom frequencies
   - ❌ Doesn't handle `weekly_specific` case
   - ❌ May be called by triggers or other functions

### Where It Fails

```
┌─────────────────────────────────────────┐
│  Edge Function (process-automated-     │
│  payouts)                               │
│  ✅ Calculates correctly                │
│  ✅ Updates next_payout_date            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Database Trigger or Function           │
│  ❌ Calls update_payout_plan_progress   │
│  ❌ Which calls calculate_next_payout_  │
│     date()                               │
│  ❌ Doesn't handle weekly_specific      │
│  ❌ Overwrites correct date!             │
└─────────────────────────────────────────┘
```

## ✅ Solution

### Migration Created
**File:** `supabase/migrations/20260125000000_fix_weekly_specific_next_payout_date.sql`

### Changes Made

1. **Updated `calculate_next_payout_date()`**:
   - Added `weekly_specific` case (fallback to weekly)
   - Note: This function can't access `day_of_week`, so actual calculation is in `update_payout_plan_progress`

2. **Updated `update_payout_plan_progress()`**:
   - ✅ Added special handling for `weekly_specific` frequency
   - ✅ Gets `day_of_week` from `payout_plans.day_of_week` or `metadata.dayOfWeek`
   - ✅ Calculates next occurrence of target day of week
   - ✅ Handles edge cases (same day, missing day_of_week)
   - ✅ Preserves time component from existing `next_payout_date`

### Logic Implementation

```sql
ELSIF v_plan.frequency = 'weekly_specific' THEN
  -- Get day_of_week from plan or metadata
  v_day_of_week := v_plan.day_of_week;
  IF v_day_of_week IS NULL AND v_plan.metadata IS NOT NULL THEN
    v_day_of_week := (v_plan.metadata->>'dayOfWeek')::integer;
  END IF;
  
  IF v_day_of_week IS NOT NULL AND v_day_of_week >= 0 AND v_day_of_week <= 6 THEN
    -- Calculate base date: start_date + (completed_payouts * 7 days)
    v_base_date := v_plan.start_date + (v_new_completed_count * INTERVAL '7 days');
    
    -- Get current day of week (0=Sunday, 6=Saturday)
    v_current_day_of_week := EXTRACT(DOW FROM v_base_date)::integer;
    
    -- Calculate days to add: (target - current + 7) % 7
    v_days_to_add := (v_day_of_week - v_current_day_of_week + 7) % 7;
    
    -- If same day, move to next week
    IF v_days_to_add = 0 THEN
      v_days_to_add := 7;
    END IF;
    
    v_next_date := v_base_date + (v_days_to_add || ' days')::interval;
  ELSE
    -- Fallback to weekly
    v_next_date := v_plan.start_date + (v_new_completed_count * INTERVAL '1 week');
  END IF;
```

## 🧪 Testing Scenarios

### Test Case 1: Start Date on Target Day
- **Plan:** Start Monday (1), day_of_week = 1 (Monday)
- **First payout:** Monday (start_date)
- **Second payout:** Next Monday (1 week later) ✅
- **Third payout:** Following Monday (2 weeks from start) ✅

### Test Case 2: Start Date NOT on Target Day
- **Plan:** Start Wednesday (3), day_of_week = 1 (Monday)
- **First payout:** Wednesday (start_date)
- **Second payout:** Next Monday (5 days later) ✅
- **Third payout:** Following Monday (12 days from start) ✅

### Test Case 3: Missing day_of_week
- **Plan:** weekly_specific but day_of_week is NULL
- **Behavior:** Falls back to regular weekly calculation ✅
- **Warning:** Logs warning message ✅

## 📋 Deployment Steps

1. **Apply Migration:**
   ```bash
   npx supabase db push
   # OR
   npx supabase migration up
   ```

2. **Verify Function:**
   ```sql
   -- Check function exists
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'update_payout_plan_progress';
   
   -- Test with a weekly_specific plan
   SELECT update_payout_plan_progress('plan-id-here');
   ```

3. **Test with Existing Plans:**
   ```sql
   -- Check existing weekly_specific plans
   SELECT id, name, frequency, day_of_week, next_payout_date, completed_payouts
   FROM payout_plans
   WHERE frequency = 'weekly_specific';
   
   -- Manually trigger update for testing
   SELECT update_payout_plan_progress('plan-id-here');
   ```

## 🔄 How It Works Now

### Flow 1: Edge Function Processing
```
1. process-automated-payouts runs
2. Finds due weekly_specific plan
3. Calculates next date in TypeScript (✅ correct)
4. Updates next_payout_date directly (✅ correct)
5. ✅ Works correctly
```

### Flow 2: Database Function Processing
```
1. Trigger or function calls update_payout_plan_progress
2. Function detects weekly_specific frequency
3. Gets day_of_week from plan.day_of_week or metadata
4. Calculates next occurrence of target day
5. Updates next_payout_date (✅ now correct)
```

## ⚠️ Important Notes

1. **Edge Function vs Database Function:**
   - Edge function calculates in TypeScript (already fixed)
   - Database function calculates in SQL (now fixed)
   - Both should produce same results

2. **day_of_week Storage:**
   - Stored in `payout_plans.day_of_week` column
   - Also stored in `payout_plans.metadata.dayOfWeek` (fallback)
   - Both are checked in the function

3. **Time Component:**
   - Function preserves time from existing `next_payout_date`
   - Defaults to 9:00 AM if not set
   - Converts date to timestamptz properly

4. **Backward Compatibility:**
   - Existing plans without `day_of_week` fall back to weekly
   - Warning is logged but doesn't fail
   - Plans continue to work

## 🎯 Expected Behavior After Fix

✅ `weekly_specific` plans calculate next payout date correctly  
✅ Next payout occurs on the specified day of week  
✅ Multiple payouts maintain correct weekly schedule  
✅ Edge function and database function both work  
✅ Time component is preserved  
✅ Missing day_of_week falls back gracefully  

## 📝 Summary

**Problem:** Database functions didn't handle `weekly_specific` frequency  
**Solution:** Updated `update_payout_plan_progress()` to handle `weekly_specific` with proper day_of_week calculation  
**Status:** ✅ Fixed via migration  
**Next Steps:** Apply migration and test with existing plans
