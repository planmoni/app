# Expense Planner - Implementation Documentation

## Overview

The Expense Planner is a comprehensive budgeting feature that allows users to create, manage, and track expense plans with categorized budgets. Users can allocate funds to different categories and subcategories, lock funds for specific time periods, and track spending against their budgets.

## Table of Contents

- [Features](#features)
- [Database Schema](#database-schema)
- [User Flow](#user-flow)
- [Component Architecture](#component-architecture)
- [Hooks & Utilities](#hooks--utilities)
- [Key Screens](#key-screens)
- [State Management](#state-management)
- [Real-time Updates](#real-time-updates)
- [Draft Plan Management](#draft-plan-management)
- [Funding & Withdrawal](#funding--withdrawal)

## Features

### Core Features
- ✅ Create expense plans with fixed or estimated budgets
- ✅ Categorize expenses by category and subcategory
- ✅ Allocate budget amounts to specific expense buckets
- ✅ Set budget periods with start and end dates
- ✅ Lock funds for expense plans
- ✅ Track spending against budgets
- ✅ Visual progress indicators (progress bars, charts)
- ✅ Draft plan management with resume functionality
- ✅ Real-time plan updates
- ✅ Automatic expiry for unfunded plans (24 hours)
- ✅ Withdrawal functionality for locked funds

### Plan Statuses
- **Draft**: Plan is being created, not yet finalized
- **Active**: Plan is finalized and ready for use
- **Unfunded**: Plan is active but has no locked funds
- **Partially Funded**: Plan has some buckets funded but not all
- **Funded**: Plan has all required funds locked
- **Completed**: Budget period has ended
- **Archived**: Plan has been archived

## Database Schema

### Tables

#### `expense_plans`
Stores the main expense plan information.

```sql
CREATE TABLE expense_plans (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  total_budget numeric NOT NULL,
  budget_structure text CHECK (budget_structure IN ('fixed', 'estimated')),
  start_date date,
  end_date date,
  status text DEFAULT 'draft',
  total_spent numeric DEFAULT 0,
  remaining_budget numeric GENERATED ALWAYS AS (total_budget - total_spent) STORED,
  metadata jsonb DEFAULT '{}'::jsonb,  -- Stores last_step and other metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `expense_buckets`
Stores individual budget allocations for categories/subcategories.

```sql
CREATE TABLE expense_buckets (
  id uuid PRIMARY KEY,
  expense_plan_id uuid REFERENCES expense_plans(id),
  category_id text NOT NULL,
  subcategory_id text NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  amount_spent numeric DEFAULT 0,
  remaining_amount numeric GENERATED ALWAYS AS (target_amount - amount_spent) STORED,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `expense_bucket_locked_funds`
Tracks locked funds for each bucket.

```sql
CREATE TABLE expense_bucket_locked_funds (
  id uuid PRIMARY KEY,
  expense_bucket_id uuid REFERENCES expense_buckets(id),
  locked_amount numeric NOT NULL,
  unlock_date date NOT NULL,
  status text DEFAULT 'locked',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## User Flow

### Creating an Expense Plan

1. **Plan Details** (`/expense-planner/create/plan-details`)
   - Select categories and subcategories
   - Can be accessed from Quick Plans (preselected category)

2. **Amount** (`/expense-planner`)
   - Enter total budget amount
   - Select budget structure (Fixed or Estimated)
   - Creates/updates draft plan

3. **Dates** (`/expense-planner/create/dates`)
   - Select budget period (start and end dates)
   - Updates draft plan with dates

4. **Buckets** (`/expense-planner/create/buckets`)
   - Allocate budget amounts to each selected subcategory
   - View allocation summary
   - Switch between Fixed and Estimated budget structures

5. **Funding Choice** (`/expense-planner/create/funding-choice`)
   - Choose to fund now or save for later
   - If "Save for Later", plan becomes active but unfunded

6. **Fund Budget** (`/expense-planner/create/fund-budget`)
   - Lock funds from available balance
   - Allocate locked amounts to specific buckets
   - Finalizes the plan

7. **Name Expense** (`/expense-planner/create/name-expense`)
   - Enter plan name
   - Finalize or save for later

8. **Success** (`/expense-planner/create/success`)
   - Confirmation screen

### Resuming Draft Plans

When a user clicks on a draft plan card:
- The system checks `metadata.last_step` first
- If not found, determines step based on available data:
  - No budget → Amount page
  - Budget but no dates → Dates page
  - Dates but no buckets → Plan Details page (to re-select categories)
  - Buckets but not allocated → Buckets page
  - Allocated but not funded → Funding Choice page
  - Funded but no name → Name Expense page

## Component Architecture

### Main Components

#### `ExpensePlanCard` (`components/expense-planner/ExpensePlanCard.tsx`)
Displays expense plan information in a card format.

**Features:**
- Status tags (Draft, Unfunded, Partially Funded, Funded)
- Category icons (up to 3, partially stacked)
- Budget structure indicator (Fixed/Estimated)
- Progress bar with spent/remaining amounts
- Date range and days remaining
- Expiry countdown for unfunded plans
- Delete button for draft plans

#### `ExpensePlanDetails` (`components/expense-planner/ExpensePlanDetails.tsx`)
Shows detailed plan breakdown on the plan detail page.

**Features:**
- Total budget display at top
- Categories grouped with icons
- Subcategories listed with individual amounts
- Category totals

#### `ExpensePlansSection` (`components/ExpensePlansSection.tsx`)
Displays expense plans on the home page.

**Features:**
- Shows up to 5 plans
- "View All" button
- "Create Plan" button
- Auto-refreshes on focus

#### `QuickPlans` (`components/QuickPlans.tsx`)
Quick access to create plans for common categories.

**Features:**
- 8 common category icons
- Preselects category when clicked
- Navigates to plan creation flow

### Supporting Components

- `ExpenseBucketCard`: Displays individual bucket information
- `BudgetProgressBar`: Visual progress indicator
- `PieChart`: Budget allocation visualization
- `BarChart`: Spending comparison chart
- `BucketAllocationSummary`: Summary of bucket allocations

## Hooks & Utilities

### `useExpensePlans` (`hooks/useExpensePlans.ts`)

Main hook for managing expense plans.

**Functions:**
- `fetchExpensePlans()`: Fetches all plans with buckets and locked funds
- `createExpensePlan()`: Creates a new plan
- `updateExpensePlan()`: Updates plan details
- `deleteExpensePlan()`: Deletes a plan
- `saveDraftExpensePlan()`: Saves/updates draft plan with retry logic
- `saveExpenseBuckets()`: Saves bucket allocations
- `lockExpenseFunds()`: Locks funds for buckets
- `finalizeExpensePlan()`: Changes plan status from draft to active
- `saveLastStep()`: Saves current step in metadata for resume functionality
- `getExpenseBuckets()`: Fetches buckets for a plan

**Features:**
- Real-time subscription for plan updates
- Automatic deletion of unfunded plans older than 24 hours
- Retry logic with exponential backoff for network errors
- Calculates funding status (draft, unfunded, partially_funded, funded)

### `useExpenseBuckets` (`hooks/useExpenseBuckets.ts`)

Manages expense buckets for a specific plan.

**Functions:**
- `fetchBuckets()`: Fetches all buckets for a plan
- Real-time subscription for bucket updates

### `useExpenseTransactions` (`hooks/useExpenseTransactions.ts`)

Manages expense transactions (spending logs).

### `useExpenseWithdrawals` (`hooks/useExpenseWithdrawals.ts`)

Manages withdrawals from locked funds.

### `expensePlanUtils` (`lib/expensePlanUtils.ts`)

Utility functions for expense plans.

**Functions:**
- `getDaysRemaining(startDate, endDate)`: Calculates days until budget starts
- `getBudgetDuration(startDate, endDate)`: Calculates budget duration in days
- `isBudgetStarted(startDate)`: Checks if budget period has started
- `formatDateRange(startDate, endDate)`: Formats date range for display
- `formatDaysRemaining(days)`: Formats days remaining text
- `getExpiryHoursRemaining(createdAt)`: Calculates hours until unfunded plan expires
- `formatExpiryCountdown(hours)`: Formats expiry countdown
- `getDraftResumeStep(plan)`: Determines which step to resume at

### `expenseCategories` (`lib/expenseCategories.tsx`)

Category and subcategory definitions with icons.

**Categories:**
- Air & Travel
- Car Maintenance
- Child/Dependent Care
- Clothing & Fashion
- Commute
- Data & Communication
- Debt Payments
- Education
- Entertainment & Social
- Financial Goals
- Food & Drinks
- Fuel & Gas
- Gifts & Ceremonies
- Healthcare
- Hobbies & Recreation
- Housing & Rent
- Infrastructure & Tax
- Personal Care
- Pets & Pet Care
- Shopping
- Utilities & Bills
- Vehicles

**Functions:**
- `getCategoryById(categoryId)`: Gets category by ID
- `getCategoryIcon(categoryId)`: Gets category icon component

## Key Screens

### Plan Creation Flow

1. **`app/expense-planner/create/plan-details.tsx`**
   - Category and subcategory selection
   - Search functionality
   - Preselection support from Quick Plans
   - Saves last step on close

2. **`app/expense-planner/index.tsx`**
   - Budget amount input
   - Budget structure selection (Fixed/Estimated)
   - Creates/updates draft plan
   - Saves last step on close

3. **`app/expense-planner/create/dates.tsx`**
   - Date range selection
   - Calendar interface
   - Validates date range
   - Saves last step on close

4. **`app/expense-planner/create/buckets.tsx`**
   - Budget allocation to buckets
   - Allocation summary
   - Budget structure switching
   - Saves last step on close

5. **`app/expense-planner/create/funding-choice.tsx`**
   - Choose funding option
   - Navigate to fund or save for later
   - Saves last step on close

6. **`app/expense-planner/create/fund-budget.tsx`**
   - Lock funds interface
   - Allocate locked amounts to buckets
   - Shows available balance
   - Saves last step on close

7. **`app/expense-planner/create/name-expense.tsx`**
   - Plan naming
   - Finalize or save for later
   - Saves last step on close

### Plan Management

**`app/expense-planner/[id]/index.tsx`**
Main plan detail screen showing:
- Plan header with name and status
- Summary card (total, spent, remaining, progress)
- Plan details card (categories and subcategories)
- Locked funds information
- Charts (Pie and Bar)
- Expense buckets list
- Action button (Fund Plan / Payout / Log Expense)

**`app/expense-planner/[id]/withdraw.tsx`**
Withdrawal interface for locked funds.

**`app/expense-planner/[id]/schedule-withdrawal.tsx`**
Schedule recurring withdrawals.

**`app/expense-planner/log-expense.tsx`**
Log new expenses against buckets.

## State Management

### Plan State
- Plans are fetched and stored in `useExpensePlans` hook
- Real-time subscriptions update plans automatically
- Draft plans are saved incrementally as user progresses

### Draft Plan Resume
- Last step is saved in `metadata.last_step` field
- On resume, checks metadata first, then falls back to data-based logic
- All necessary parameters are passed when navigating to resume step

### Funding Status Calculation
Calculated based on:
- Plan status (draft vs active)
- Presence of buckets
- Total locked funds vs total budget
- Statuses: `draft`, `unfunded`, `partially_funded`, `funded`

## Real-time Updates

### Plan Updates
- Subscribes to `expense_plans` table changes
- Automatically refreshes plan list on INSERT, UPDATE, DELETE
- Ensures UI stays in sync with database

### Bucket Updates
- Subscribes to `expense_buckets` table changes
- Updates bucket list in real-time

## Draft Plan Management

### Saving Drafts
- Drafts are saved at each step
- Uses `saveDraftExpensePlan` with retry logic
- Handles network errors gracefully

### Resuming Drafts
1. User clicks on draft plan card
2. System determines resume step using `getDraftResumeStep`
3. Navigates to appropriate screen with all necessary params
4. User continues from where they left off

### Deleting Drafts
- Delete button on draft plan cards
- Confirmation alert before deletion
- Removes plan and all associated data

## Funding & Withdrawal

### Locking Funds
- Funds are locked from available balance
- Can allocate different amounts to different buckets
- Locked funds are tracked in `expense_bucket_locked_funds` table
- Funds unlock on the budget start date

### Withdrawing Funds
- Available when budget has started
- Can withdraw from specific buckets
- Supports instant and scheduled withdrawals
- Emergency withdrawal with fees (12% instant, 10% 24-hour, 6% 72-hour)

### Unfunded Plan Expiry
- Unfunded plans expire after 24 hours
- Automatic deletion if not funded
- Countdown timer displayed on cards
- Real-time countdown updates

## File Structure

```
app/
├── expense-planner/
│   ├── _layout.tsx                    # Expense planner navigation layout
│   ├── index.tsx                      # Budget amount input screen
│   ├── [id]/
│   │   ├── _layout.tsx                # Plan detail navigation layout
│   │   ├── index.tsx                  # Plan detail screen
│   │   ├── withdraw.tsx               # Withdrawal screen
│   │   └── schedule-withdrawal.tsx    # Schedule withdrawal screen
│   ├── create/
│   │   ├── _layout.tsx                # Creation flow navigation layout
│   │   ├── plan-details.tsx           # Category selection
│   │   ├── dates.tsx                  # Date range selection
│   │   ├── buckets.tsx                # Budget allocation
│   │   ├── funding-choice.tsx         # Funding options
│   │   ├── fund-budget.tsx            # Lock funds
│   │   ├── name-expense.tsx           # Plan naming
│   │   └── success.tsx                # Success screen
│   └── log-expense.tsx                # Log expense screen

components/
├── expense-planner/
│   ├── ExpensePlanCard.tsx            # Plan card component
│   ├── ExpensePlanDetails.tsx         # Plan details breakdown
│   ├── ExpenseBucketCard.tsx          # Bucket card component
│   ├── BudgetProgressBar.tsx         # Progress bar component
│   ├── PieChart.tsx                   # Pie chart component
│   ├── BarChart.tsx                   # Bar chart component
│   └── BucketAllocationSummary.tsx    # Allocation summary
├── ExpensePlansSection.tsx            # Plans section on home
└── QuickPlans.tsx                     # Quick plan creation

hooks/
├── useExpensePlans.ts                 # Main expense plans hook
├── useExpenseBuckets.ts               # Buckets hook
├── useExpenseTransactions.ts          # Transactions hook
├── useExpenseWithdrawals.ts           # Withdrawals hook
└── useExpenseFunding.ts               # Funding hook

lib/
├── expenseCategories.tsx              # Category definitions
└── expensePlanUtils.ts                # Utility functions

types/
└── expense-planner.ts                 # TypeScript interfaces

supabase/
└── migrations/
    └── 20251207131700_create_expense_plans_tables.sql
```

## Key Features Implementation

### Budget Structure
- **Fixed**: Exact amounts allocated to buckets
- **Estimated**: Flexible allocations that can be adjusted

### Category Icons
- Up to 3 category icons displayed on cards
- Partially stacked with white borders
- Last icon has highest z-index
- Icons from `lucide-react-native` and `@expo/vector-icons`

### Progress Tracking
- Progress bars show spent vs budget
- Color-coded (green < 75%, orange 75-100%, red > 100%)
- Shows "Days remaining" before budget starts
- Shows "Spent X/Y" after budget starts

### Date Management
- Budget period with start and end dates
- Days remaining calculation before start
- Budget duration calculation after start
- Automatic unlock on start date

## Error Handling

### Network Errors
- Retry logic with exponential backoff (3 retries: 1s, 2s, 4s)
- User-friendly error messages
- Graceful degradation

### Validation
- Minimum budget: ₦1,000
- Date range validation
- Bucket allocation validation
- Balance checks before locking funds

## Testing Considerations

### Test Cases
1. Create a complete expense plan
2. Save and resume a draft plan
3. Fund a plan partially and fully
4. Track spending against budgets
5. Withdraw locked funds
6. Delete draft plans
7. Verify unfunded plan expiry
8. Test real-time updates
9. Test error handling and retries
10. Test with different budget structures

## Future Enhancements

Potential improvements:
- Budget templates
- Recurring expense plans
- Budget alerts and notifications
- Export/import functionality
- Advanced analytics and insights
- Multi-currency support
- Budget sharing/collaboration

## Migration History

- `20251207131700_create_expense_plans_tables.sql`: Initial schema creation
- `20250117000000_add_metadata_to_expense_plans.sql`: Added metadata column for draft resume

## Notes

- All amounts are stored as `numeric` type for precision
- Dates are stored as `date` type (no time component)
- Metadata uses `jsonb` for flexible storage
- Real-time subscriptions use Supabase Realtime
- RLS policies ensure users can only access their own plans

