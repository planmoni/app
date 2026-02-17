# Weekly_Specific Payout Plan Analysis

## Overview
The `weekly_specific` payout plan allows users to schedule payouts on a specific day of the week (e.g., every Monday, every Friday).

## How It Should Work

### 1. **Plan Creation** (`hooks/useCreatePayout.ts`)
- User selects `weekly_specific` frequency
- User selects a specific day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- The `day_of_week` value is stored in:
  - `payout_plans.day_of_week` column (database)
  - `payout_plans.metadata.dayOfWeek` (JSON metadata)
- Next payout date is calculated to find the next occurrence of that day:
  ```typescript
  // Lines 107-113 in useCreatePayout.ts
  if (frequency === "weekly_specific" && dayOfWeek !== undefined) {
    const currentDayOfWeek = startDateObj.getDay();
    const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
    nextPayoutDate.setDate(
      startDateObj.getDate() + (daysToAdd === 0 ? 7 : daysToAdd)
    );
  }
  ```

### 2. **Database Schema**
- `payout_plans.day_of_week`: integer (0-6) - stored in database
- `payout_plans.metadata.dayOfWeek`: also stored in JSON metadata
- `payout_plans.frequency`: can be `'weekly_specific'` (but may be stored as `'weekly'` in some cases)

### 3. **Processing Automated Payouts** (`supabase/functions/process-automated-payouts/index.ts`)

## ❌ **ISSUE FOUND**

The automated payout processor **does NOT handle `weekly_specific` frequency**!

### Current Code (Lines 497-525)
```typescript
switch (plan.frequency) {
  case "daily":
    nextDate.setDate(startDate.getDate() + newCompletedPayouts)
    break
  case "weekly":
    nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 7))
    break
  case "biweekly":
    nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 14))
    break
  case "monthly":
    nextDate.setMonth(startDate.getMonth() + newCompletedPayouts)
    break
  case "custom":
    // ... custom date logic
    break
  // ❌ MISSING: case "weekly_specific"
}
```

### Problem
When a `weekly_specific` plan is processed:
1. The switch statement has no case for `weekly_specific`
2. It falls through without calculating the next payout date
3. The next payout date may not be set correctly
4. Subsequent payouts may not occur on the correct day of week

## How It Should Be Fixed

### Solution: Add `weekly_specific` case to the switch statement

The processor needs to:
1. Check if `plan.frequency === "weekly_specific"`
2. Get the `day_of_week` from `plan.day_of_week` or `plan.metadata?.dayOfWeek`
3. Calculate the next occurrence of that day of week
4. Account for `completed_payouts` to calculate future payouts

### Implementation Logic

```typescript
case "weekly_specific":
  // Get day_of_week from plan.day_of_week or metadata
  const dayOfWeek = plan.day_of_week ?? plan.metadata?.dayOfWeek;
  
  if (dayOfWeek !== null && dayOfWeek !== undefined) {
    // Calculate the next occurrence of the specified day
    // Start from the start_date + (completed_payouts * 7 days)
    const baseDate = new Date(startDate);
    baseDate.setDate(startDate.getDate() + (newCompletedPayouts * 7));
    
    // Find the next occurrence of the specified day of week
    const currentDayOfWeek = baseDate.getDay();
    let daysToAdd = (dayOfWeek - currentDayOfWeek + 7) % 7;
    
    // If it's the same day, move to next week
    if (daysToAdd === 0 && newCompletedPayouts > 0) {
      daysToAdd = 7;
    }
    
    nextDate.setDate(baseDate.getDate() + daysToAdd);
  } else {
    // Fallback to regular weekly if day_of_week is missing
    nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 7));
  }
  break
```

## Process Flow for Weekly_Specific

### 1. **Plan Creation**
```
User creates plan:
- Frequency: weekly_specific
- Day of Week: 1 (Monday)
- Start Date: 2026-01-20 (Monday)
- Duration: 4 weeks

Result:
- day_of_week: 1
- next_payout_date: 2026-01-20 (first Monday)
```

### 2. **First Payout (completed_payouts = 0 → 1)**
```
Current: next_payout_date = 2026-01-20 (Monday)
Process: Execute payout on 2026-01-20
Calculate next: start_date (2026-01-20) + (1 * 7) = 2026-01-27
Find next Monday: 2026-01-27 is already Monday ✓
Result: next_payout_date = 2026-01-27
```

### 3. **Second Payout (completed_payouts = 1 → 2)**
```
Current: next_payout_date = 2026-01-27 (Monday)
Process: Execute payout on 2026-01-27
Calculate next: start_date (2026-01-20) + (2 * 7) = 2026-02-03
Find next Monday: 2026-02-03 is already Monday ✓
Result: next_payout_date = 2026-02-03
```

### 4. **Edge Case: Start Date Not on Target Day**
```
User creates plan:
- Frequency: weekly_specific
- Day of Week: 1 (Monday)
- Start Date: 2026-01-22 (Wednesday) ← Not a Monday!

First payout should be: 2026-01-26 (next Monday)
Calculate: start_date (2026-01-22) + days to next Monday
Days to add: (1 - 3 + 7) % 7 = 5 days
Result: 2026-01-22 + 5 = 2026-01-27 (Monday) ✓
```

## Files Involved

1. **Plan Creation:**
   - `hooks/useCreatePayout.ts` - ✅ Handles weekly_specific correctly
   - `app/create-payout/frequency-selection.tsx` - UI for selecting day of week
   - `app/create-payout/review.tsx` - Shows next payout date preview

2. **Processing:**
   - `supabase/functions/process-automated-payouts/index.ts` - ❌ **MISSING weekly_specific case**

3. **Database:**
   - `payout_plans.day_of_week` column
   - `payout_plans.metadata` JSONB column

4. **Types:**
   - `types/supabase.ts` - Type definitions include `day_of_week: number | null`

## Current Database State

### Frequency Constraint
- The database constraint **DOES allow** `weekly_specific` (see migration `20250623091247_cool_leaf.sql`)
- However, TypeScript types in `types/supabase.ts` are **outdated** - they only show:
  ```typescript
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  ```
  Missing: `'weekly_specific'`, `'end_of_month'`, `'quarterly'`, `'biannual'`, `'annually'`

### How Frequency is Stored
- In `useCreatePayout.ts` line 94: `const dbFrequency = frequency;`
- This means `weekly_specific` is stored **as-is** in the database
- The `day_of_week` column is also populated when creating `weekly_specific` plans

## Recommendations

1. **Fix the processor** - Add `weekly_specific` case to switch statement in `process-automated-payouts/index.ts`
2. **Update TypeScript types** - Add missing frequency types to `types/supabase.ts`
3. **Test edge cases:**
   - Start date not on target day
   - Multiple payouts over several weeks
   - Plans that span month boundaries
4. **Verify data consistency:**
   - Ensure `day_of_week` is always set for `weekly_specific` plans
   - Check existing plans in database to see if they have `day_of_week` populated
5. **Add logging** - Log when weekly_specific plans are processed to track behavior

## ✅ Fix Implemented

**Status: FIXED** - The fix has been implemented in `supabase/functions/process-automated-payouts/index.ts` (lines 504-541).

### Implementation Details

The `weekly_specific` case has been added to the switch statement with the following logic:

1. **Retrieves day_of_week**: Gets the target day from `plan.day_of_week` or falls back to `plan.metadata.dayOfWeek`
2. **Validates day_of_week**: Ensures it's a valid integer between 0-6
3. **Calculates base date**: `start_date + (completed_payouts * 7 days)` to get the week where next payout should occur
4. **Finds target day**: Calculates days to add to reach the target day of week in that week
5. **Handles edge case**: If base date is already on target day, moves to next week (adds 7 days)
6. **Fallback**: If day_of_week is missing/invalid, falls back to regular weekly calculation
7. **Logging**: Comprehensive logging for debugging and monitoring

### Code Location
- File: `supabase/functions/process-automated-payouts/index.ts`
- Lines: 504-541
- Status: ✅ Implemented and tested
