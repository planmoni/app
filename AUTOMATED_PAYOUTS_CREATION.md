# How `automated_payouts` Records are Created and Saved

This document explains all the ways `automated_payouts` records are created and saved in the database, apart from the edge function processing.

## 📊 Table Structure

**Table:** `automated_payouts`  
**Migration:** `supabase/migrations/20250711000001_automated_payouts_infrastructure.sql`

```sql
CREATE TABLE automated_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_plan_id uuid REFERENCES payout_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  scheduled_date date NOT NULL,
  execution_date timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  transfer_reference text UNIQUE,
  paystack_transfer_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  payout_account_id uuid REFERENCES payout_accounts(id),
  error_message text,
  retry_count integer DEFAULT 0,
  retry_after timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## 🔄 Methods of Creation

### 1. **Direct Insert in Edge Function** (Primary Method)
**File:** `supabase/functions/process-automated-payouts/index.ts`  
**Lines:** 246-259

**When:** During payout processing when a payout is due

**How it works:**
```typescript
// Generate unique transfer reference
transferReference = `AUTO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

// Create automated payout record
const { data: createdPayout, error: createPayoutError } = await supabase
  .from("automated_payouts")
  .insert({
    payout_plan_id: plan.id,
    user_id: plan.user_id,
    scheduled_date: todayString,  // Today's date (YYYY-MM-DD)
    amount: actualPayoutAmount,    // May vary for custom frequency
    status: "processing",          // Starts as "processing"
    transfer_reference: transferReference,
    payout_account_id: plan.payout_account_id,
    execution_date: new Date().toISOString()
  })
  .select()
  .single()
```

**Key Points:**
- ✅ Status starts as `"processing"` (not `"pending"`)
- ✅ `execution_date` is set immediately
- ✅ `transfer_reference` is generated with timestamp + random string
- ✅ Uses actual payout amount (may differ for custom frequency plans)
- ✅ Created right before transfer is initiated

---

### 2. **Database Function: `create_automated_payout()`** 
**File:** `supabase/migrations/20250715000001_fix_payout_account_id.sql`  
**Lines:** 82-139

**When:** Called by other functions or edge functions that need to create records

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION create_automated_payout(
  p_plan_id uuid,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
```

**How it works:**
```sql
-- Validations:
-- 1. Plan exists
-- 2. Plan is active
-- 3. Plan not completed (completed_payouts < duration)
-- 4. Plan has payout_account_id configured

-- Generate unique reference
v_reference := 'auto_payout_' || p_plan_id || '_' || p_scheduled_date || '_' || extract(epoch from now())::bigint;

-- Create automated payout record
INSERT INTO automated_payouts (
  payout_plan_id,
  user_id,
  scheduled_date,
  status,
  transfer_reference,
  amount,
  payout_account_id
) VALUES (
  p_plan_id,
  v_plan.user_id,
  p_scheduled_date,
  'pending',              -- ⚠️ Status is 'pending' (not 'processing')
  v_reference,
  v_plan.payout_amount,   -- Uses plan's default payout_amount
  v_plan.payout_account_id
) RETURNING id INTO v_payout_id;

RETURN v_payout_id;
```

**Key Points:**
- ✅ Status is `"pending"` (not `"processing"`)
- ✅ Uses plan's default `payout_amount` (not custom amounts)
- ✅ Validates plan eligibility before creating
- ✅ Returns the created payout ID

**Called by:**
- `supabase/functions/process-due-payouts/index.ts` (line 123)

---

### 3. **Bulk Scheduling Function** (Future Payouts)
**File:** `supabase/functions/schedule-automated-payouts/index.ts`  
**Lines:** 121-124

**When:** Runs daily (cron job) to schedule payouts for the next 30 days

**How it works:**
```typescript
// For each active plan, calculate future payout dates
const scheduledDates = []

// Generate dates based on frequency
while (currentDate <= endDate && plan.completed_payouts + scheduledDates.length < plan.duration) {
  const dateString = currentDate.toISOString().split('T')[0]
  
  // Check if already exists
  const { data: existingPayout } = await supabase
    .from("automated_payouts")
    .select("id")
    .eq("payout_plan_id", plan.id)
    .eq("scheduled_date", dateString)
    .single()

  if (!existingPayout) {
    scheduledDates.push({
      payout_plan_id: plan.id,
      user_id: plan.user_id,
      scheduled_date: dateString,
      amount: plan.payout_amount,
      status: "pending",              // ⚠️ Status is 'pending'
      payout_account_id: plan.payout_account_id,
      execution_date: new Date(currentDate.getTime() + 12 * 60 * 60 * 1000).toISOString() // Noon
    })
  }
  
  // Calculate next date based on frequency...
}

// Bulk insert
if (scheduledDates.length > 0) {
  const { error: insertError } = await supabase
    .from("automated_payouts")
    .insert(scheduledDates)  // Bulk insert
}
```

**Key Points:**
- ✅ Creates records in bulk for future dates
- ✅ Status is `"pending"` (will be processed later)
- ✅ Checks for duplicates before inserting
- ✅ Schedules up to 30 days ahead
- ✅ Sets `execution_date` to noon on scheduled date

---

## 📋 Status Flow

```
┌──────────┐
│ pending  │  ← Created by schedule-automated-payouts or create_automated_payout()
└────┬─────┘
     │
     ▼
┌──────────────┐
│ processing   │  ← Created by process-automated-payouts (direct insert)
└──────┬───────┘
       │
   ┌───┴────┐
   │       │
   ▼       ▼
┌────────┐ ┌────────┐
│completed│ │ failed │
└────────┘ └────┬───┘
                 │
                 ▼
            ┌──────────┐
            │ retrying │
            └──────────┘
```

---

## 🔍 Comparison of Creation Methods

| Method | Status | When Created | Amount Used | Reference Format |
|--------|--------|--------------|-------------|------------------|
| **Direct Insert** (process-automated-payouts) | `processing` | When payout is due | `actualPayoutAmount` (may vary) | `AUTO_{timestamp}_{random}` |
| **create_automated_payout()** | `pending` | Before processing | `plan.payout_amount` | `auto_payout_{plan_id}_{date}_{epoch}` |
| **schedule-automated-payouts** | `pending` | 30 days ahead | `plan.payout_amount` | Not set (null initially) |

---

## 📝 Field Details

### Required Fields
- `payout_plan_id` - Links to the payout plan
- `user_id` - Owner of the payout
- `scheduled_date` - Date when payout should occur (date only, no time)
- `amount` - Payout amount (must be > 0)
- `status` - Current status

### Optional Fields
- `transfer_reference` - Unique reference for tracking
- `payout_account_id` - Account to receive payout
- `execution_date` - When processing started/planned
- `paystack_transfer_id` - External transfer ID
- `error_message` - Error details if failed
- `retry_count` - Number of retry attempts
- `retry_after` - When to retry
- `completed_at` - When payout completed
- `metadata` - Additional JSON data

### Auto-Generated Fields
- `id` - UUID primary key
- `created_at` - Timestamp when record created
- `updated_at` - Timestamp when record updated (via trigger)

---

## 🔄 Update Flow

After creation, records are updated by:

1. **process-automated-payouts** - Updates status, transfer details
   ```typescript
   await supabase
     .from("automated_payouts")
     .update({ 
       status: transferResult.status === "Completed" ? "completed" : "processing",
       safehaven_transfer_id: transferId,
       transfer_code: paymentReference,
       session_id: sessionId,
       payment_reference: paymentReference,
       completed_at: transferResult.status === "Completed" ? new Date().toISOString() : null,
       transferred_at: new Date().toISOString()
     })
     .eq("id", automatedPayout.id)
   ```

2. **Webhooks** - Update status when transfers complete/fail
   - `safehaven-webhook/index.ts`
   - `paystack-webhook-updated.ts`

3. **Retry Functions** - Update retry_count, retry_after, status

---

## 🎯 Key Differences

### Method 1: Direct Insert (process-automated-payouts)
- ✅ **Immediate processing** - Record created right before transfer
- ✅ **Status: "processing"** - Already in progress
- ✅ **Custom amounts** - Can use different amounts for custom frequency
- ✅ **Execution date set** - Knows exactly when processing started

### Method 2: Database Function (create_automated_payout)
- ✅ **Pre-validation** - Validates plan before creating
- ✅ **Status: "pending"** - Needs to be processed later
- ✅ **Standard amounts** - Uses plan's default amount
- ✅ **Reusable** - Can be called from multiple places

### Method 3: Bulk Scheduling (schedule-automated-payouts)
- ✅ **Future planning** - Creates records 30 days ahead
- ✅ **Status: "pending"** - Will be processed when due
- ✅ **Bulk operations** - Efficient for multiple dates
- ✅ **Duplicate prevention** - Checks before inserting

---

## 🔐 Security & Permissions

- **RLS Enabled:** Yes
- **Policy:** Users can only view their own automated payouts
- **Function Security:** `create_automated_payout()` uses `SECURITY DEFINER` (runs with creator's privileges)

---

## 📊 Example Records

### Record Created by Direct Insert:
```json
{
  "id": "uuid-here",
  "payout_plan_id": "plan-uuid",
  "user_id": "user-uuid",
  "scheduled_date": "2026-01-25",
  "execution_date": "2026-01-25T10:30:00Z",
  "status": "processing",
  "transfer_reference": "AUTO_1737802200000_abc123",
  "amount": 50000,
  "payout_account_id": "account-uuid",
  "created_at": "2026-01-25T10:30:00Z"
}
```

### Record Created by Scheduling:
```json
{
  "id": "uuid-here",
  "payout_plan_id": "plan-uuid",
  "user_id": "user-uuid",
  "scheduled_date": "2026-02-01",
  "execution_date": "2026-02-01T12:00:00Z",
  "status": "pending",
  "transfer_reference": null,
  "amount": 50000,
  "payout_account_id": "account-uuid",
  "created_at": "2026-01-25T00:00:00Z"
}
```

---

## 🚀 Summary

**Primary Creation Method:** Direct insert in `process-automated-payouts` edge function when payouts are due.

**Secondary Methods:**
1. Database function `create_automated_payout()` for reusable creation
2. Bulk scheduling via `schedule-automated-payouts` for future payouts

**Key Takeaway:** Records can be created with status `"pending"` (scheduled) or `"processing"` (immediate), depending on the creation method and timing.
