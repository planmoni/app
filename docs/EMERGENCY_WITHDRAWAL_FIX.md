# Emergency Withdrawal Plan Status Fix

## Problem
Plans that have had emergency withdrawals made are still actively displaying on the app in the "Next Payout" section and "Your Payout Plans" section.

## Root Cause
The `process-emergency-withdrawal` Edge Function was successfully processing the emergency withdrawal and transferring funds, but it was **not updating the payout plan status to 'cancelled'** after a successful withdrawal.

The existing database migration (`20250621092816_floral_truth.sql`) includes a function `process_emergency_withdrawal` that properly sets the plan status to 'cancelled', but the Edge Function was not calling this database function or updating the plan status directly.

## Solution
Updated the `process-emergency-withdrawal` Edge Function to explicitly update the payout plan status to 'cancelled' after a successful emergency withdrawal is completed.

### Changes Made

#### File: `supabase/functions/process-emergency-withdrawal/index.ts`

Added the following code after the transaction status update (after line 322):

```typescript
// Update the payout plan status to cancelled after successful emergency withdrawal
const { error: planUpdateError } = await supabase
  .from("payout_plans")
  .update({ 
    status: "cancelled",
    updated_at: new Date().toISOString()
  })
  .eq("id", withdrawal.payout_plan_id)

if (planUpdateError) {
  console.error("Error updating plan status to cancelled:", planUpdateError)
  // Don't throw error here as the withdrawal was successful
} else {
  console.log(`Successfully updated plan ${withdrawal.payout_plan_id} status to cancelled`)
}
```

## Deployment Instructions

### Option 1: Deploy via Supabase CLI

```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Deploy the updated function
npx supabase functions deploy process-emergency-withdrawal
```

### Option 2: Deploy via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find the `process-emergency-withdrawal` function
4. Click **Deploy new version**
5. Copy the contents of `supabase/functions/process-emergency-withdrawal/index.ts`
6. Paste and deploy

### Option 3: Manual SQL Update (Temporary Fix for Existing Cancelled Plans)

If there are existing plans that should have been cancelled but weren't, you can manually update them:

```sql
-- Find plans with emergency withdrawals that should be cancelled
SELECT pp.id, pp.name, pp.status, ew.status as withdrawal_status, ew.withdrawal_amount, pp.total_amount
FROM payout_plans pp
JOIN emergency_withdrawals ew ON pp.id = ew.payout_plan_id
WHERE ew.status = 'completed' AND pp.status = 'active';

-- Update the plans to cancelled
UPDATE payout_plans
SET status = 'cancelled', updated_at = NOW()
WHERE id IN (
  SELECT pp.id
  FROM payout_plans pp
  JOIN emergency_withdrawals ew ON pp.id = ew.payout_plan_id
  WHERE ew.status = 'completed' AND pp.status = 'active'
);
```

## How the App Filters Plans

The app already has proper filtering logic in place:

### Home Screen (Dashboard)
```typescript
// File: app/(tabs)/index.tsx (line 464)
const activePlans = payoutPlans.filter(plan => plan.status === 'active').slice(0, 3);
```

### Next Payout Card
```typescript
// File: app/(tabs)/index.tsx (line 475-488)
const nextPayout = payoutPlans
  .filter(plan => {
    // Only include active plans with a valid next payout date
    if (plan.status !== 'active' || !plan.next_payout_date) return false;
    
    // Check if the next payout date is in the future (not expired)
    const nextPayoutDate = new Date(plan.next_payout_date);
    return nextPayoutDate > new Date();
  })
  .sort((a, b) => {
    const dateA = new Date(a.next_payout_date!);
    const dateB = new Date(b.next_payout_date!);
    return dateA.getTime() - dateB.getTime();
  })[0];
```

### All Payouts Screen
```typescript
// File: app/all-payouts.tsx (line 86-89)
const filteredPayoutPlans = payoutPlans.filter(plan => {
  if (activeTab === 'all') return true;
  return plan.status === activeTab;
});
```

## Testing

After deployment, test the fix by:

1. Create a new payout plan with emergency withdrawal enabled
2. Make an emergency withdrawal
3. Verify the plan status changes to 'cancelled' in the database
4. Verify the plan no longer appears in:
   - Next Payout section
   - Your Payout Plans section (active plans)
   - Only appears under "All" or "Cancelled" tabs in All Payouts screen

## Future Recommendations

1. **Add Unit Tests**: Create tests for the emergency withdrawal function to ensure plan status updates are working correctly
2. **Add E2E Tests**: Test the full emergency withdrawal flow including UI verification
3. **Database Constraints**: Consider adding a database trigger that automatically cancels a plan when an emergency withdrawal is marked as completed
4. **Monitoring**: Add logging/monitoring to track when plans are cancelled due to emergency withdrawals

## Related Files
- `supabase/functions/process-emergency-withdrawal/index.ts` - Edge Function (UPDATED)
- `supabase/migrations/20250621092816_floral_truth.sql` - Database function (existing)
- `app/(tabs)/index.tsx` - Home screen with payout plan filtering
- `components/PayoutPlansSection.tsx` - Payout plans display component
- `app/all-payouts.tsx` - All payouts screen with filtering
- `hooks/useRealtimePayoutPlans.ts` - Real-time payout plans hook
- `hooks/useEmergencyWithdrawal.ts` - Emergency withdrawal logic

