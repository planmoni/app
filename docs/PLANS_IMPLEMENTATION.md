# Plans Implementation & Paystack Add Funds

## Overview

This document describes the implementation of the Expense Plans feature and the Paystack integration for adding funds to plans. The Plans feature allows users to create, manage, and track expense budgets with categorized spending, funding methods, and automated tracking.

## Table of Contents

- [Plans Tab](#plans-tab)
- [Plan Cards](#plan-cards)
- [Plan Details Page](#plan-details-page)
- [Paystack Add Funds Integration](#paystack-add-funds-integration)
- [Data Models](#data-models)
- [Key Features](#key-features)
- [User Flows](#user-flows)

---

## Plans Tab

**Location:** `app/(tabs)/plans.tsx`

### Features

The Plans tab provides a comprehensive overview of all expense plans with the following sections:

#### 1. Balance Summary
- **Available to Spend**: Shows the total amount available to spend across all plans (only for plans with `start_action: 'wallet'` and budget started)
- **Total Funded**: Displays the total amount funded across all plans

#### 2. Budget Health Status
- Shows percentage of plans that are on track
- Displays count of on-track vs off-track plans
- Visual health badge with percentage indicator

#### 3. Next Maturing Budget
- Displays the plan with the nearest end date
- Shows plan name, end date, and days remaining
- Clickable card that navigates to plan details

#### 4. Needs Attention Section
- Lists up to 3 plans that are off-track
- Shows plans with auto/daily funding that are behind schedule
- Visual alert indicators

#### 5. Recent Activity
- Shows last 5 plan transactions (topups, withdrawals, spending)
- Transaction types:
  - `manual_topup` / `auto_allocation`: Fund additions (green)
  - `withdrawal`: Withdrawals (orange)
  - `spending`: Expense transactions
- Clickable "View All Activity" link

#### 6. Statistics Cards
- **Active**: Count of active plans
- **Draft**: Count of draft plans
- **Total Budget**: Sum of all plan budgets

#### 7. Search & Filter
- Search by plan name or budget amount
- Filter tabs: All, Active, Draft, Completed

#### 8. Plans List
- Displays all filtered plans using `ExpensePlanCard` component
- Pull-to-refresh functionality
- Empty states for no plans or no search results

### Key Calculations

```typescript
// Available to Spend (only for wallet-based plans that have started)
expensePlansAvailableBalance = plans.reduce((sum, plan) => {
  if (budgetStarted && plan.metadata?.start_action === 'wallet') {
    return sum + plan.current_balance;
  }
  return sum;
}, 0);

// Total Funded
totalFundedBudget = plans.reduce((sum, plan) => {
  return sum + (plan.current_balance || 0);
}, 0);
```

---

## Plan Cards

**Location:** `components/expense-planner/ExpensePlanCard.tsx`

### Display Features

#### 1. Plan Header
- Plan name (truncated with ellipsis)
- Status tag (Draft, Unfunded, Partially Funded, Funded)
- Delete button for draft plans
- Expiry countdown for unfunded plans (24 hours)

#### 2. Budget Information
- Total budget amount
- Current balance (if funded)
- Percentage funded indicator

#### 3. Funding Progress
- **Before Budget Starts**: Shows funding progress (0-100%) with color coding:
  - 0-25%: Red (#EF4444)
  - 25-50%: Orange (#F97316)
  - 50-75%: Yellow (#F59E0B)
  - 75-100%: Light Green (#10B981)
  - 100%+: Green (#22C55E)
- **After Budget Starts**: Shows spending progress (green→red based on usage)

#### 4. Amount Remaining/Extra
- **Remaining to Add**: Shows amount needed to fully fund the plan (before start)
- **Extra Funds**: Displays over-funded amount in green

#### 5. Auto-Fund Countdown
- For auto-funded plans, shows next funding date
- Format: "Next funding: in X days" or "Tomorrow" or "Today"

#### 6. Category Icons
- Displays up to 3 unique category icons (stacked)
- Shows total category count

#### 7. Dates & Duration
- Date range (e.g., "Dec 12, 2025 to Dec 22, 2025")
- Days remaining (before start) or days left (after start)

#### 8. Health Status Badge
- Shows if plan is "Slightly Behind", "At Risk", or "Unachievable"
- Color-coded warnings

### Card States

- **Draft**: Can be deleted, resumes from last step on press
- **Unfunded**: Shows 24h expiry countdown, can be funded
- **Partially Funded**: Shows funding progress, can add more funds
- **Funded**: Shows spending progress, ready to use

---

## Plan Details Page

**Location:** `app/expense-planner/[id]/index.tsx`

### Sections

#### 1. Plan Header
- Plan name
- Plan type tag (Recurring, One Time, Long Term)
- Funding status tag (Draft, Unfunded, Partially Funded, Funded)

#### 2. Categories
- Grid display of all subcategories with icons
- Each category shows icon and name

#### 3. Plan Information Cards
- **Budget Amount**: Total budget for the plan
- **Budget Period**: Start date - End date
- **Duration**: Total days in budget period
- **Funding Method**: Auto or Manual
- **Plan Start Rule**: 
  - "Move to available balance" (for wallet-based plans)
  - "Auto payout to bank" (for payout-based plans with bank account info)

#### 4. Funding Progress
- Progress bar with percentage (0-100%)
- Color-coded based on funding level
- Shows:
  - Funded amount / Total budget
  - Remaining amount to add
  - Extra funds (if over-funded)

#### 5. Next Funding Countdown
- For auto plans, shows when next funding will occur
- Only visible before budget starts

#### 6. Available to Spend
- Only shown for wallet-based plans that have started
- Displays available balance
- "View Balance" link
- Action buttons:
  - **Schedule Payout**: Schedule withdrawal
  - **Withdraw**: Immediate withdrawal

#### 7. Action Buttons
- **Add Funds** (Manual plans only):
  - Enabled for manual plans
  - Disabled for auto plans with explanation: "Auto-funded plans are funded automatically"
  - Navigates to Paystack payment flow
- **Adjust Budget**: Edit plan budget and settings
- **Close Budget**: Options to move funds to wallet or auto payout

#### 8. Activity Section
- Recent plan transactions
- Uses `PlanActivity` component

#### 9. Charts
- **Budget Distribution**: Pie chart showing allocation by category
- **Spending vs Allocated**: Bar chart comparing spending to budget

#### 10. Expense Buckets
- List of all expense buckets with individual progress
- Uses `ExpenseBucketCard` component

### Edge Cases Handled

1. **Auto Plans**: Add Funds button is disabled with explanation
2. **Over-Funding**: Shows extra funds amount
3. **Zero Balance**: Handled gracefully
4. **Expired Plans**: 24h expiry countdown for unfunded plans
5. **Countdown Timers**: Properly cleaned up to prevent memory leaks

---

## Paystack Add Funds Integration

### Flow Overview

1. User clicks "Add Funds" on plan details page (manual plans only)
2. Navigates to `/expense-planner/create/fund-plan`
3. User selects funding method:
   - **Fund from wallet balance**: Uses existing wallet balance
   - **Fund with Paystack**: Opens Paystack payment flow
4. After successful payment, funds are added to the plan

### Files Involved

#### 1. Fund Plan Selection Screen
**Location:** `app/expense-planner/create/fund-plan.tsx`

- Displays plan information (name, total budget)
- Two funding options:
  - **Fund from wallet balance**: Shows available balance, navigates to `fund-budget.tsx`
  - **Fund with Paystack**: Navigates to `/paystack-payment` with plan context

#### 2. Paystack Payment Screen
**Location:** `app/paystack-payment.tsx` (assumed)

- Handles Paystack payment processing
- Receives parameters:
  - `returnTo`: Return path after payment
  - `planId`: Plan ID to fund
  - `planName`: Plan name for display
  - `totalBudget`: Total budget amount

#### 3. Fund Budget Screen
**Location:** `app/expense-planner/create/fund-budget.tsx`

- Handles wallet-based funding
- Allows allocation to specific buckets
- Updates plan balance after funding

### Payment Parameters

When navigating to Paystack payment:

```typescript
router.push({
  pathname: '/paystack-payment',
  params: {
    returnTo: '/expense-planner/create/fund-plan',
    planId: plan.id,
    planName: plan.name,
    totalBudget: plan.total_budget.toString(),
  },
});
```

### Post-Payment Flow

After successful Paystack payment:
1. Payment webhook processes the transaction
2. Funds are added to plan wallet (`plan_wallets` table)
3. Transaction recorded in `plan_transactions` table (type: `manual_topup`)
4. Plan `current_balance` is updated
5. User is redirected back to fund-plan screen or plan details

### Integration Points

- **Plan Wallet**: `plan_wallets` table stores balance per plan
- **Plan Transactions**: `plan_transactions` table records all funding activities
- **Expense Plans**: `expense_plans.current_balance` tracks total funded amount

---

## Data Models

### ExpensePlan Type

```typescript
interface ExpensePlan {
  id: string;
  user_id: string;
  name: string;
  total_budget: number;
  budget_structure: 'fixed' | 'estimated';
  start_date?: string;
  end_date?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  total_spent: number;
  remaining_budget: number;
  created_at: string;
  updated_at: string;
  
  // Enhanced fields
  buckets?: ExpenseBucket[];
  total_locked?: number;
  funding_status?: 'draft' | 'unfunded' | 'partially_funded' | 'funded';
  
  // Additional fields
  plan_type?: 'recurring' | 'one_time' | 'long_term';
  funding_method?: 'auto' | 'manual' | 'hybrid';
  current_balance?: number;
  required_per_cycle?: number;
  required_per_day?: number;
  payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  health_status?: 'on_track' | 'slightly_behind' | 'at_risk' | 'unachievable';
  is_paused?: boolean;
  
  // Metadata fields
  metadata?: {
    start_action?: 'wallet' | 'auto_payout';
    payout_account_id?: string;
    payout_account_label?: string;
    payout_account_bank_name?: string;
    last_step?: string;
  };
  start_action?: 'wallet' | 'auto_payout';
  payout_account_id?: string;
  payout_account_label?: string;
  payout_account_bank_name?: string;
}
```

### Plan Transactions

```typescript
interface PlanTransaction {
  id: string;
  plan_id: string;
  wallet_id: string;
  type: 'auto_allocation' | 'manual_topup' | 'spending' | 'withdrawal';
  amount: number;
  description?: string;
  category_id?: string;
  subcategory_id?: string;
  created_at: string;
}
```

---

## Key Features

### 1. Funding Status Calculation

Plans are automatically categorized based on funding:

- **Draft**: Status is 'draft'
- **Unfunded**: No locked funds, not draft
- **Partially Funded**: Some buckets funded but not all
- **Funded**: All buckets fully funded

### 2. Auto-Funding

For plans with `funding_method: 'auto'`:
- Funds are automatically allocated based on `payout_schedule`
- Next funding date is calculated and displayed
- Add Funds button is disabled (funding is automatic)

### 3. Manual Funding

For plans with `funding_method: 'manual'`:
- User must manually add funds
- Can fund via:
  - Wallet balance (if sufficient)
  - Paystack payment (credit card, bank transfer, etc.)

### 4. Start Rules

- **Wallet**: Funds move to available balance when budget starts
- **Auto Payout**: Funds automatically transfer to bank account when budget starts

### 5. Health Tracking

Plans are monitored for:
- Spending pace vs budget
- Funding progress
- Days remaining
- Risk indicators (slightly behind, at risk, unachievable)

### 6. Expiry Management

- Unfunded plans expire after 24 hours
- Countdown timer displayed on cards
- Automatic deletion if not funded

---

## User Flows

### Creating and Funding a Plan

1. **Create Plan**: User goes through plan creation flow
2. **Select Funding Method**: Choose Auto or Manual
3. **Set Start Rule**: Choose wallet or auto payout
4. **Fund Plan**:
   - **Manual**: Click "Add Funds" → Choose wallet or Paystack → Complete payment
   - **Auto**: Funds allocated automatically based on schedule
5. **Plan Active**: Budget starts on start date, funds become available

### Adding Funds to Existing Plan

1. Navigate to plan details
2. Click "Add Funds" (manual plans only)
3. Choose funding method:
   - **Wallet**: Select amount from available balance
   - **Paystack**: Enter amount, complete payment
4. Funds added to plan balance
5. Transaction recorded in activity

### Viewing Plan Status

1. Plans tab shows overview:
   - Budget health
   - Next maturing plan
   - Off-track alerts
   - Recent activity
2. Click plan card to view details:
   - Funding progress
   - Available to spend
   - Category breakdown
   - Spending charts

---

## Technical Notes

### Real-time Updates

- Plans list updates in real-time via Supabase subscriptions
- Plan balance updates immediately after transactions
- Countdown timers update every minute

### Performance Considerations

- Plan transactions limited to 50 most recent
- Category icons limited to 3 per card
- Pagination for large plan lists (future enhancement)

### Error Handling

- Network errors handled gracefully
- Payment failures show user-friendly messages
- Auto-retry for transient failures

### Security

- All plan operations require authentication
- User can only access their own plans
- RLS policies enforce data isolation

---

## Future Enhancements

1. **Bulk Operations**: Fund multiple plans at once
2. **Scheduled Funding**: Set up recurring manual topups
3. **Funding Goals**: Set target funding dates
4. **Notifications**: Alerts for funding deadlines, off-track plans
5. **Analytics**: Spending trends, category insights
6. **Export**: Download plan reports

---

## Related Documentation

- [Expense Planner README](./EXPENSE_PLANNER_README.md)
- [Paystack Integration Guide](./PAYSTACK_INTEGRATION.md) (if exists)
- [Database Schema](../supabase/migrations/)

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in console
3. Check Supabase logs for transaction issues
4. Verify Paystack webhook configuration

