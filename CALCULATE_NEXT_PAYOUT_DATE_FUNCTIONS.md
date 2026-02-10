# Calculate Next Payout Date Functions

This document lists all the `calculate_next_payout_date` related functions found in the codebase.

## 📋 Functions Found

### 1. `calculate_next_payout_date_from_existing`
**File:** `supabase/migrations/20250104000002_remove_redundant_payout_time.sql`  
**Lines:** 65-97

**Purpose:** Calculates next payout date preserving the time component from existing `next_payout_date`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION calculate_next_payout_date_from_existing(
  p_frequency text,
  p_start_date date,
  p_existing_next_payout_date timestamptz,
  p_completed_payouts integer
) RETURNS timestamptz
```

**Full Definition:**
```sql
CREATE OR REPLACE FUNCTION calculate_next_payout_date_from_existing(
  p_frequency text,
  p_start_date date,
  p_existing_next_payout_date timestamptz,
  p_completed_payouts integer
) RETURNS timestamptz AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
BEGIN
  -- Extract the time component from the existing next_payout_date
  v_payout_time := p_existing_next_payout_date::time;
  
  -- Calculate the next date based on frequency
  CASE p_frequency
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency, we'll need to look at custom_payout_dates
      RETURN NULL;
  END CASE;
  
  -- Combine the date with the extracted time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$ LANGUAGE plpgsql;
```

**Features:**
- ✅ Extracts time from existing `next_payout_date`
- ✅ Supports: `weekly`, `biweekly`, `monthly`
- ❌ Does NOT support: `daily`, `weekly_specific`, `custom`
- ❌ Returns `NULL` for unsupported frequencies

**Used By:**
- `update_payout_plan_progress()` in migration `20250104000002_remove_redundant_payout_time.sql` (line 136)

---

### 2. `calculate_next_payout_date_with_time`
**File:** `supabase/migrations/20250116000001_fix_daily_frequency_next_payout_date.sql`  
**Lines:** 16-63

**Purpose:** Calculates next payout datetime preserving time component from existing `next_payout_date`. Supports daily frequency.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION calculate_next_payout_date_with_time(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer,
  p_existing_next_payout_date timestamptz DEFAULT NULL
) RETURNS timestamptz
```

**Full Definition:**
```sql
CREATE OR REPLACE FUNCTION calculate_next_payout_date_with_time(
  p_start_date date,
  p_frequency text,
  p_completed_payouts integer,
  p_existing_next_payout_date timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date date;
  v_payout_time time;
  v_next_datetime timestamptz;
BEGIN
  -- Extract payout time from existing next_payout_date if available, otherwise default to 9:00 AM
  IF p_existing_next_payout_date IS NOT NULL THEN
    v_payout_time := p_existing_next_payout_date::time;
    -- Only use the time if it's not midnight (likely a real time, not just a date)
    IF v_payout_time = '00:00:00'::time THEN
      v_payout_time := '09:00:00'::time;
    END IF;
  ELSE
    v_payout_time := '09:00:00'::time; -- Default to 9:00 AM
  END IF;

  -- Calculate the next payout date based on start_date and completed_payouts count
  -- The first payout (completed_payouts = 0) should happen on start_date
  -- Subsequent payouts are calculated as start_date + (completed_payouts * frequency_interval)
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 day');
    WHEN 'weekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
    WHEN 'biweekly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '2 weeks');
    WHEN 'monthly' THEN
      v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 month');
    ELSE
      -- For custom frequency or unknown, return start_date with time
      v_next_date := p_start_date;
  END CASE;
  
  -- Combine the date with the payout time
  v_next_datetime := (v_next_date + v_payout_time)::timestamptz;
  
  RETURN v_next_datetime;
END;
$$;
```

**Features:**
- ✅ Extracts time from existing `next_payout_date` (with fallback to 9:00 AM)
- ✅ Supports: `daily`, `weekly`, `biweekly`, `monthly`
- ✅ Handles midnight time (converts to 9:00 AM)
- ✅ Default time is 9:00 AM if not provided
- ❌ Does NOT support: `weekly_specific`, `custom` (returns start_date)

**Used By:**
- `update_payout_plan_progress()` in migration `20250116000001_fix_daily_frequency_next_payout_date.sql` (line 132)

---

## 📊 Comparison

| Feature | `calculate_next_payout_date_from_existing` | `calculate_next_payout_date_with_time` |
|---------|-------------------------------------------|----------------------------------------|
| **Parameters** | 4 (frequency, start_date, existing_date, completed) | 4 (start_date, frequency, completed, existing_date) |
| **Return Type** | `timestamptz` | `timestamptz` |
| **Time Handling** | Extracts from existing (no fallback) | Extracts with 9:00 AM fallback |
| **Daily** | ❌ Not supported | ✅ Supported |
| **Weekly** | ✅ Supported | ✅ Supported |
| **Biweekly** | ✅ Supported | ✅ Supported |
| **Monthly** | ✅ Supported | ✅ Supported |
| **Weekly_Specific** | ❌ Not supported | ❌ Not supported |
| **Custom** | ❌ Returns NULL | ❌ Returns start_date |
| **Default Time** | Uses extracted time only | 9:00 AM if missing/midnight |

---

## ⚠️ Issues Found

### 1. Missing `weekly_specific` Support
Both functions **do NOT support** `weekly_specific` frequency:
- `calculate_next_payout_date_from_existing`: Returns `NULL` for unsupported frequencies
- `calculate_next_payout_date_with_time`: Returns `start_date` for unsupported frequencies

### 2. Function Usage
These functions may be called by:
- `update_payout_plan_progress()` in older migrations
- Other database functions or triggers

### 3. Current State
The latest migration (`20260125000000_fix_weekly_specific_next_payout_date.sql`) handles `weekly_specific` directly in `update_payout_plan_progress()` instead of using these helper functions.

---

## 🔧 Recommendations

### Option 1: Update Both Functions (Recommended)
Add `weekly_specific` support to both functions:

```sql
-- For calculate_next_payout_date_with_time
WHEN 'weekly_specific' THEN
  -- Would need day_of_week parameter, but function doesn't have it
  -- So this function can't fully support weekly_specific
  v_next_date := p_start_date + (p_completed_payouts * INTERVAL '1 week');
```

**Problem:** These functions don't have access to `day_of_week`, so they can't properly calculate `weekly_specific` dates.

### Option 2: Keep Current Approach (Current)
The latest migration (`20260125000000_fix_weekly_specific_next_payout_date.sql`) handles `weekly_specific` directly in `update_payout_plan_progress()`, which has access to the full plan row including `day_of_week`.

**This is the correct approach** because:
- ✅ Has access to `day_of_week` from plan
- ✅ Can handle edge cases properly
- ✅ No need to modify function signatures

### Option 3: Deprecate These Functions
If these functions are no longer used, consider:
- Documenting them as deprecated
- Removing them in a future migration
- Ensuring no other code depends on them

---

## 🔍 Where They're Used

### `calculate_next_payout_date_from_existing`
- **Migration:** `20250104000002_remove_redundant_payout_time.sql`
- **Called by:** `update_payout_plan_progress()` (line 136)
- **Status:** May be superseded by newer migrations

### `calculate_next_payout_date_with_time`
- **Migration:** `20250116000001_fix_daily_frequency_next_payout_date.sql`
- **Called by:** `update_payout_plan_progress()` (line 132)
- **Status:** May be superseded by newer migrations

---

## 📝 Summary

Both functions exist but **do not support `weekly_specific`**. The latest migration handles `weekly_specific` directly in `update_payout_plan_progress()` which is the correct approach since it has access to the full plan data including `day_of_week`.

**Action Items:**
1. ✅ Verify if these functions are still being called
2. ✅ Check if newer migrations have replaced their usage
3. ⚠️ Consider updating them or documenting as deprecated
4. ✅ Current fix in `20260125000000_fix_weekly_specific_next_payout_date.sql` is correct
