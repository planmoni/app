# Payout Time Scheduling Implementation

## Overview

This document describes the implementation of time-based payout scheduling, allowing users to specify exact times when payouts should be executed.

## Database Changes

### New Fields Added

1. **`payout_time`** (time type, default: '09:00:00')
   - Stores the time of day when payouts should be executed
   - Format: HH:MM:SS (24-hour format)
   - Example: '14:30:00' for 2:30 PM

2. **`next_payout_date`** (updated to timestamptz)
   - Changed from `date` to `timestamptz` to support exact time scheduling
   - Now stores both date and time for precise execution

### New Functions

1. **`calculate_next_payout_date()`**
   - Updated to handle time scheduling
   - Combines calculated date with specified payout time

2. **`update_payout_plan_progress()`**
   - Updated to work with timestamptz
   - Maintains time consistency across payout cycles

3. **`process_payout()`**
   - Updated to check exact time (not just date)
   - Ensures payouts execute at the specified time

4. **`get_payouts_due_now()`**
   - Returns all payouts due at the current time
   - Used by automated processing systems

5. **`schedule_payout_for_time()`**
   - Allows updating payout time for existing plans
   - Recalculates next payout date with new time

## Migration Application

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20250104000000_add_payout_time_scheduling.sql`
4. Paste and execute the SQL

### Option 2: Supabase CLI

```bash
# Make sure you're in the project directory
cd /Users/apple/Planmoni-Seb/app-1

# Link to your Supabase project (if not already linked)
supabase link --project-ref rqmpnoaavyizlwzfngpr

# Apply the migration
supabase db push
```

### Option 3: Manual Application

Copy the SQL from the migration file and run it in your preferred PostgreSQL client.

## Usage Examples

### Creating a Payout Plan with Specific Time

```sql
INSERT INTO payout_plans (
  user_id,
  name,
  total_amount,
  payout_amount,
  frequency,
  duration,
  start_date,
  bank_account_id,
  payout_time
) VALUES (
  'user-uuid',
  'Monthly Salary',
  100000,
  100000,
  'monthly',
  1,
  '2025-01-15',
  'bank-account-uuid',
  '09:00:00'  -- 9:00 AM
);
```

### Updating Payout Time for Existing Plan

```sql
SELECT schedule_payout_for_time('plan-uuid', '14:30:00');
```

### Getting Payouts Due Now

```sql
SELECT * FROM get_payouts_due_now();
```

## Frontend Integration

### Time Picker Component

```typescript
// Example time picker for React Native
import DateTimePicker from '@react-native-community/datetimepicker';

const TimePicker = ({ value, onChange }) => {
  return (
    <DateTimePicker
      value={value}
      mode="time"
      is24Hour={true}
      display="default"
      onChange={onChange}
    />
  );
};
```

### API Integration

```typescript
// Create payout plan with time
const createPayoutPlan = async (planData) => {
  const { data, error } = await supabase
    .from('payout_plans')
    .insert({
      ...planData,
      payout_time: planData.payout_time // Format: 'HH:MM:SS'
    });
  
  return { data, error };
};

// Update payout time
const updatePayoutTime = async (planId, newTime) => {
  const { data, error } = await supabase
    .rpc('schedule_payout_for_time', {
      p_plan_id: planId,
      p_payout_time: newTime
    });
  
  return { data, error };
};
```

## Automated Processing

### Cron Job Updates

The existing cron jobs will automatically work with the new time-based system:

1. **`process-automated-payouts`** - Runs every minute to check for due payouts
2. **`schedule-automated-payouts`** - Runs daily to schedule future payouts

### Processing Logic

```sql
-- The system now checks for exact time matches
SELECT * FROM payout_plans 
WHERE status = 'active' 
  AND next_payout_date <= now()
  AND next_payout_date > now() - INTERVAL '1 minute';
```

## Benefits

1. **Precise Timing**: Payouts execute at exact times specified by users
2. **User Control**: Users can choose when they want to receive their payouts
3. **Business Hours**: Align payouts with business hours or personal preferences
4. **Time Zone Support**: Built-in timezone handling with timestamptz
5. **Backward Compatibility**: Existing plans default to 9:00 AM

## Testing

### Test Time Scheduling

```sql
-- Create a test payout plan
INSERT INTO payout_plans (
  user_id, name, total_amount, payout_amount, frequency, 
  duration, start_date, bank_account_id, payout_time
) VALUES (
  'test-user-id',
  'Test Payout',
  1000,
  1000,
  'weekly',
  1,
  CURRENT_DATE,
  'test-bank-id',
  '12:00:00'
);

-- Check if next payout date includes time
SELECT id, name, payout_time, next_payout_date 
FROM payout_plans 
WHERE name = 'Test Payout';
```

### Verify Processing

```sql
-- Check payouts due now
SELECT * FROM get_payouts_due_now();

-- Test time update
SELECT schedule_payout_for_time('plan-id', '15:30:00');
```

## Migration Verification

After applying the migration, verify:

1. ✅ `payout_time` column exists with default '09:00:00'
2. ✅ `next_payout_date` is now timestamptz type
3. ✅ All functions are created successfully
4. ✅ Indexes are created for performance
5. ✅ Existing data is preserved and migrated

## Troubleshooting

### Common Issues

1. **Migration fails**: Ensure you have proper permissions
2. **Time not updating**: Check time format (HH:MM:SS)
3. **Payouts not processing**: Verify cron jobs are running
4. **Timezone issues**: Ensure timestamptz is used consistently

### Rollback (if needed)

```sql
-- Remove payout_time column
ALTER TABLE payout_plans DROP COLUMN IF EXISTS payout_time;

-- Revert next_payout_date to date type (requires data migration)
-- This should be done carefully to preserve existing data
```

## Next Steps

1. Apply the migration to your database
2. Update frontend components to include time picker
3. Test the time scheduling functionality
4. Update documentation for users
5. Monitor automated processing logs
