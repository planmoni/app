# Budget Plans Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Core Tables](#core-tables)
4. [Database Functions & Triggers](#database-functions--triggers)
5. [Row Level Security (RLS)](#row-level-security-rls)
6. [API & Hooks](#api--hooks)
7. [Edit Functionality](#edit-functionality)
8. [Data Flow](#data-flow)
9. [Migration History](#migration-history)

---

## Overview

The Budget Plans system allows users to create, manage, and track spending budgets with features including:
- **Budget Creation**: Set total budget, dates, categories, and funding methods
- **Auto Top-Up**: Automatic funding on schedules (daily, weekly, monthly)
- **Payout Options**: Direct wallet spending or automatic bank transfers
- **Category Management**: Track spending by categories and subcategories
- **Real-time Updates**: Automatic recalculation of required contributions
- **Edit Capabilities**: Update budget details after creation

---

## Database Schema

### Primary Table: `budget_plans`

The main table storing all budget plan information.

#### Basic Information
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
name text NOT NULL
plan_name text  -- Alias for name (backward compatibility)
total_budget numeric NOT NULL CHECK (total_budget > 0)
start_date date
end_date date
status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'))
```

#### Categories & Subcategories (JSONB)
```sql
categories jsonb DEFAULT '[]'::jsonb
-- Format: ["air_travel", "car_maintenance"]

subcategories jsonb DEFAULT '[]'::jsonb
-- Format: [
--   {"category_id": "air_travel", "subcategory_id": "flight_tickets"},
--   {"category_id": "car_maintenance", "subcategory_id": "car_repair"}
-- ]
```

#### Budget Tracking
```sql
current_balance numeric DEFAULT 0 CHECK (current_balance >= 0)
total_spent numeric DEFAULT 0 CHECK (total_spent >= 0)
remaining_budget numeric GENERATED ALWAYS AS (total_budget - total_spent) STORED
```

#### Funding Configuration
```sql
funding_method text DEFAULT 'manual' CHECK (funding_method IN ('auto', 'manual'))
```

#### Auto Top-Up Configuration
```sql
auto_topup_enabled boolean DEFAULT false
auto_topup_frequency text CHECK (auto_topup_frequency IN ('daily', 'weekly', 'monthly'))
auto_topup_amount numeric CHECK (auto_topup_amount > 0)
auto_topup_start_date date
auto_topup_end_date date
auto_topup_next_date date
auto_topup_total_cycles integer CHECK (auto_topup_total_cycles > 0)
```

#### Start Action Configuration
```sql
start_action text DEFAULT 'wallet' CHECK (start_action IN ('wallet', 'auto_payout'))
payout_account_id uuid REFERENCES payout_accounts(id) ON DELETE SET NULL
payout_account_label text
payout_account_bank_name text
```

#### Alert Configuration
```sql
alert_at_70_percent boolean DEFAULT false
alert_risk_failure boolean DEFAULT false
alert_weekly_progress boolean DEFAULT false
```

#### Status & Legacy Fields
```sql
is_paused boolean DEFAULT false
payout_schedule text CHECK (payout_schedule IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom'))
required_per_cycle numeric DEFAULT 0 CHECK (required_per_cycle >= 0)
required_per_day numeric DEFAULT 0 CHECK (required_per_day >= 0)
auto_fund_minimum numeric DEFAULT 0 CHECK (auto_fund_minimum >= 0)
```

#### Metadata & Timestamps
```sql
metadata jsonb DEFAULT '{}'::jsonb
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

---

## Core Tables

### Related Tables

#### `payout_accounts`
- Stores bank account information for automatic payouts
- Referenced by `budget_plans.payout_account_id`
- Used when `start_action = 'auto_payout'`

#### `profiles`
- User profile information
- Referenced by `budget_plans.user_id`
- Cascade delete ensures user's plans are deleted when user is deleted

---

## Database Functions & Triggers

### 1. Automatic Timestamp Update

**Function:** `update_budget_plans_updated_at()`
- Updates `updated_at` timestamp on every row update
- Trigger: `trg_update_budget_plans_updated_at`

### 2. Required Contributions Recalculation

**Migration:** `20250121000002_recalculate_required_contributions_on_budget_update.sql`

#### Functions:

**`get_days_between(start_date date, end_date date)`**
- Calculates the number of days between two dates
- Returns integer (minimum 1)
- Used for calculating daily contribution requirements

**`get_cycles_until_deadline(start_date date, end_date date, schedule text)`**
- Calculates payout cycles until deadline based on schedule
- Supports: `daily`, `weekly`, `biweekly`, `monthly`
- Returns integer (minimum 1)

**`recalculate_required_contributions()`**
- **Trigger Function** that automatically recalculates:
  - `required_per_cycle`: Amount needed per payout cycle
  - `required_per_day`: Amount needed per day
- **Triggers when:**
  - `total_budget` changes
  - `start_date` changes
  - `end_date` changes
  - `payout_schedule` changes
  - `current_balance` changes

**Calculation Logic:**
```sql
remaining_amount = total_budget - current_balance
days_remaining = get_days_between(effective_start_date, end_date)
cycles_remaining = get_cycles_until_deadline(effective_start_date, end_date, payout_schedule)

required_per_cycle = remaining_amount / cycles_remaining
required_per_day = remaining_amount / days_remaining
```

**Trigger:** `trigger_recalculate_required_contributions`
- Fires BEFORE UPDATE on `budget_plans`
- Only executes when relevant fields change (optimized)

---

## Row Level Security (RLS)

All RLS policies ensure users can only access their own budget plans.

### Policies

1. **SELECT Policy**: `"Users can view their own budget plans"`
   - Users can only view plans where `user_id = auth.uid()`

2. **INSERT Policy**: `"Users can insert their own budget plans"`
   - Users can only create plans with their own `user_id`

3. **UPDATE Policy**: `"Users can update their own budget plans"`
   - Users can only update plans where `user_id = auth.uid()`
   - Prevents users from modifying other users' plans

4. **DELETE Policy**: `"Users can delete their own budget plans"`
   - Users can only delete plans where `user_id = auth.uid()`

---

## API & Hooks

### `useExpensePlans()` Hook

Location: `hooks/useExpensePlans.ts`

#### Main Functions

**`fetchExpensePlans()`**
- Fetches all budget plans for the authenticated user
- Orders by `created_at DESC`
- Enhances plans with funding status and bucket-like structures
- Returns `ExpensePlan[]`

**`updateExpensePlan(id: string, updates: Partial<ExpensePlan>)`**
- Updates a budget plan with partial data
- Automatically triggers database recalculation via trigger
- Updates local state after successful update
- Returns updated plan data

**`deleteExpensePlan(id: string)`**
- Deletes a budget plan
- Verifies ownership before deletion
- Refreshes plan list after deletion

**`saveDraftExpensePlan(planData)`**
- Creates or updates draft plans
- Supports partial updates
- Handles metadata updates

**`createCompletePlan(planData)`**
- Creates a finalized budget plan
- Extracts categories/subcategories from buckets
- Sets initial status and balances

#### Funding Status Calculation

The hook calculates funding status based on:
- `status`: If 'draft', returns 'draft'
- `current_balance` vs `total_budget`:
  - `current_balance = 0`: 'unfunded'
  - `current_balance >= total_budget`: 'funded'
  - Otherwise: 'partially_funded'

---

## Edit Functionality

### Edit Pages

All edit pages are located in `app/expense-planner/[id]/`:

#### 1. **Edit Budget Amount** (`edit-amount.tsx`)
- **Route:** `/expense-planner/[id]/edit-amount`
- **Updates:** `total_budget`
- **Recalculates:** `required_per_cycle`, `required_per_day`
- **Validation:** Minimum ₦1,000
- **Features:**
  - Currency formatting
  - Auto-focus on input
  - Real-time validation

#### 2. **Edit Budget Period** (`edit-period.tsx`)
- **Route:** `/expense-planner/[id]/edit-period`
- **Updates:** `start_date`, `end_date`
- **Recalculates:** `required_per_cycle`, `required_per_day`
- **Features:**
  - Calendar date picker
  - Visual date range selection
  - Past date validation
  - Date range validation (end > start)

#### 3. **Edit Funding Method** (`edit-funding.tsx`)
- **Route:** `/expense-planner/[id]/edit-funding`
- **Updates:** `funding_method`
- **Options:** 'auto' or 'manual'
- **Features:**
  - Radio button selection
  - Visual option cards

#### 4. **Edit Plan Start Rule** (`edit-start-rule.tsx`)
- **Route:** `/expense-planner/[id]/edit-start-rule`
- **Updates:** 
  - `start_action`
  - `payout_account_id`
  - `payout_account_label`
  - `payout_account_bank_name`
  - `metadata`
- **Options:**
  - 'wallet': Spend directly from budget
  - 'auto_payout': Auto transfer to bank account
- **Features:**
  - Account selection when auto_payout is selected
  - Bank account cards with logos
  - Clears payout info when switching to wallet

#### 5. **Edit Categories** (`edit-categories.tsx`)
- **Route:** `/expense-planner/[id]/edit-categories`
- **Updates:** `categories`, `subcategories`
- **Format:**
  - `categories`: `["category_id1", "category_id2"]`
  - `subcategories`: `[{"category_id": "...", "subcategory_id": "..."}]`
- **Features:**
  - Searchable category list
  - Expandable categories
  - Subcategory checkboxes
  - Selection count display

### Edit Page Features

All edit pages include:
- **Header**: Back button, title, close button
- **Content**: Title, description, form fields
- **Done Button**: Floating button at bottom
- **Validation**: Client-side validation with error messages
- **Haptic Feedback**: User interaction feedback
- **Loading States**: Disabled state during save
- **Error Handling**: Try-catch with user-friendly messages
- **Auto-initialization**: Loads existing plan data

### Navigation

Edit pages are accessed from the Plan Details page (`app/expense-planner/[id]/details.tsx`) via pen icons on each section:
- Budget Amount → `edit-amount`
- Budget Period → `edit-period`
- Funding Method → `edit-funding`
- Plan Start Rule → `edit-start-rule`
- Categories → `edit-categories`

---

## Data Flow

### Creating a Budget Plan

1. **User selects categories/subcategories** → Stored in draft plan
2. **User enters budget amount** → Updates draft plan
3. **User selects dates** → Updates draft plan
4. **User configures funding** → Updates draft plan
5. **User sets start action** → Updates draft plan
6. **Plan finalized** → Status changes to 'active'

### Updating a Budget Plan

1. **User clicks edit icon** → Navigates to edit page
2. **User modifies field** → Local state updated
3. **User clicks "Done"** → `updateExpensePlan()` called
4. **Database update** → Trigger fires automatically
5. **Recalculation** → `required_per_cycle` and `required_per_day` updated
6. **Local state refresh** → `fetchExpensePlans()` called
7. **Navigation back** → User returns to details page

### Automatic Recalculation Flow

```
User updates budget field
    ↓
Database UPDATE statement
    ↓
Trigger: trigger_recalculate_required_contributions
    ↓
Function: recalculate_required_contributions()
    ↓
Calculates: required_per_cycle, required_per_day
    ↓
Updates NEW record
    ↓
Row saved with new values
```

---

## Migration History

### Key Migrations

1. **`20250119000000_create_budget_plans_table.sql`**
   - Creates `budget_plans` table
   - Sets up indexes
   - Creates RLS policies
   - Adds timestamp trigger

2. **`20250121000002_recalculate_required_contributions_on_budget_update.sql`**
   - Creates helper functions for date calculations
   - Creates recalculation trigger function
   - Sets up automatic recalculation on budget updates

3. **`20250118000000_add_categories_to_expense_plans.sql`**
   - Adds `categories` and `subcategories` JSONB columns
   - Creates GIN indexes for JSONB columns
   - Sets up category extraction from buckets

---

## Indexes

### Performance Indexes

```sql
-- User lookup
idx_budget_plans_user_id ON budget_plans(user_id)

-- Status filtering
idx_budget_plans_status ON budget_plans(status)

-- Date range queries
idx_budget_plans_dates ON budget_plans(start_date, end_date)

-- Funding method filtering
idx_budget_plans_funding_method ON budget_plans(funding_method)

-- Auto top-up queries
idx_budget_plans_auto_topup ON budget_plans(auto_topup_enabled, auto_topup_next_date) 
WHERE auto_topup_enabled = true
```

### JSONB Indexes (GIN)

```sql
-- Category filtering
idx_budget_plans_categories ON budget_plans USING GIN (categories)

-- Subcategory filtering
idx_budget_plans_subcategories ON budget_plans USING GIN (subcategories)

-- Metadata queries
idx_budget_plans_metadata ON budget_plans USING GIN (metadata)
```

---

## TypeScript Types

### `ExpensePlan` Interface

```typescript
interface ExpensePlan {
  id: string;
  user_id: string;
  name: string;
  total_budget: number;
  start_date?: string;
  end_date?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  total_spent: number;
  remaining_budget: number;
  current_balance?: number;
  funding_method?: 'auto' | 'manual';
  start_action?: 'wallet' | 'auto_payout';
  payout_account_id?: string;
  payout_account_label?: string;
  payout_account_bank_name?: string;
  categories?: string[];
  subcategories?: Array<{category_id: string; subcategory_id: string}>;
  required_per_cycle?: number;
  required_per_day?: number;
  payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  metadata?: any;
  created_at: string;
  updated_at: string;
}
```

---

## Best Practices

### When Updating Budget Plans

1. **Always use `updateExpensePlan()`** from the hook
   - Ensures proper error handling
   - Maintains local state consistency
   - Triggers automatic recalculation

2. **Update related fields together**
   - When updating `total_budget`, consider if dates need updating
   - When updating dates, recalculation happens automatically

3. **Validate before saving**
   - Check minimum amounts
   - Validate date ranges
   - Ensure required fields are present

### When Querying Budget Plans

1. **Use indexes** for filtering
   - Filter by `user_id` (indexed)
   - Filter by `status` (indexed)
   - Use date range queries (indexed)

2. **Leverage JSONB queries** for categories
   - Use GIN indexes for category filtering
   - Example: `categories @> '["air_travel"]'::jsonb`

3. **Consider pagination** for large result sets

---

## Troubleshooting

### Common Issues

**Issue:** `required_per_cycle` and `required_per_day` not updating
- **Solution:** Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_recalculate_required_contributions'`
- **Solution:** Verify function exists: `SELECT * FROM pg_proc WHERE proname = 'recalculate_required_contributions'`

**Issue:** RLS policy blocking updates
- **Solution:** Verify `auth.uid()` matches `user_id`
- **Solution:** Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'budget_plans'`

**Issue:** JSONB categories not saving correctly
- **Solution:** Ensure format matches: `["id1", "id2"]` for categories
- **Solution:** Ensure format matches: `[{"category_id": "...", "subcategory_id": "..."}]` for subcategories

---

## Future Enhancements

Potential improvements:
- [ ] Budget templates
- [ ] Recurring budget plans
- [ ] Budget sharing/collaboration
- [ ] Advanced analytics and reporting
- [ ] Budget alerts and notifications
- [ ] Export/import functionality
- [ ] Budget versioning/history

---

## Related Documentation

- [Expense Planner README](./EXPENSE_PLANNER_README.md)
- [Plans Implementation](./PLANS_IMPLEMENTATION.md)
- [Migration Fix Summary](./MIGRATION_FIX_SUMMARY.md)

---

**Last Updated:** January 2025
**Version:** 1.0.0

