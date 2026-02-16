# Where `process-automated-payouts` is Called

This document shows all the places where the `process-automated-payouts` Edge Function is invoked.

## 📍 Call Locations

### 1. **Cron Job (Automatic - Every Minute)** ⏰
**File:** `supabase/migrations/20250101000005_add_automated_payout_cron.sql`

- **Schedule:** Every minute (`* * * * *`)
- **Purpose:** Automatically process due payouts immediately
- **How it works:**
  ```sql
  SELECT cron.schedule(
    'process-automated-payouts',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
    $$
  );
  ```

**This is the PRIMARY way payouts are processed automatically.**

---

### 2. **Database Trigger (On Plan Updates/Inserts)** 🔔
**File:** `supabase/migrations/20250101000006_add_payout_processing_trigger.sql`

- **Trigger:** `trigger_auto_process_payout` and `trigger_auto_process_payout_insert`
- **When:** 
  - After `UPDATE` of `next_payout_date` on `payout_plans` table
  - After `INSERT` into `payout_plans` table
- **Condition:** Only triggers if `next_payout_date <= now()` AND `status = 'active'`
- **Purpose:** Immediate processing when a payout becomes due

**Function:**
```sql
CREATE OR REPLACE FUNCTION trigger_process_due_payout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.next_payout_date <= now() AND NEW.status = 'active' THEN
    PERFORM net.http_post(
      url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := json_build_object('plan_id', NEW.id)::text
    );
  END IF;
  RETURN NEW;
END;
$$;
```

---

### 3. **API Route (Manual Trigger)** 🌐
**File:** `app/api/process-payouts+api.ts`

- **Endpoint:** `POST /api/process-payouts`
- **Purpose:** Allows manual triggering of payout processing
- **Usage:** Can be called from frontend or external systems
- **Authentication:** Uses service role key

**Code:**
```typescript
export async function POST(request: Request) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/process-automated-payouts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({})
    }
  );
  // ... handle response
}
```

---

### 4. **Recovery Functions (For Overdue Payouts)** 🔄
**File:** `supabase/migrations/20250115000002_add_payout_recovery_functions.sql`

#### a. `recover_overdue_payout(p_overdue_id uuid)`
- **Purpose:** Recover a specific overdue payout
- **When:** Called manually or by admin
- **Location:** Lines 122-123

#### b. `recover_all_overdue_payouts()`
- **Purpose:** Recover all overdue payouts
- **When:** Called manually or by admin
- **Location:** Lines 223-224

**Both functions call:**
```sql
PERFORM net.http_post(
  url := 'https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts',
  headers := json_build_object(
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
    'Content-Type', 'application/json'
  )::jsonb,
  body := json_build_object('plan_id', v_overdue.payout_plan_id)::text
);
```

---

### 5. **Other Database Functions** 📊
**Files:**
- `supabase/migrations/20250115000003_update_triggers_and_add_logging.sql` (Line 181)
- `supabase/migrations/20250104000000_add_payout_time_scheduling.sql` (Line 225)
- `supabase/migrations/20250104000001_add_payout_time_scheduling_safe.sql` (Line 268)

These migrations contain additional database functions that may call `process-automated-payouts` for various payout scheduling scenarios.

---

## 🔄 Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSING TRIGGERS                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌──────────┐        ┌──────────┐
   │  CRON   │        │ TRIGGER  │        │   API    │
   │ (Every  │        │ (On Plan │        │ (Manual) │
   │ Minute) │        │  Update) │        │          │
   └─────────┘        └──────────┘        └──────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  process-automated-payouts Edge Function│
        │  (supabase/functions/process-automated- │
        │   payouts/index.ts)                     │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  1. Query due payout plans            │
        │  2. Process each due payout            │
        │  3. Update next_payout_date           │
        │  4. Create automated_payout records   │
        │  5. Execute SafeHaven transfers       │
        └───────────────────────────────────────┘
```

---

## 📝 Summary

| Caller | Type | Frequency | Purpose |
|--------|------|-----------|---------|
| **Cron Job** | Automatic | Every minute | Primary automated processing |
| **Database Trigger** | Automatic | On plan update/insert | Immediate processing when due |
| **API Route** | Manual | On-demand | Manual trigger from frontend/admin |
| **Recovery Functions** | Manual | On-demand | Recover overdue payouts |

---

## 🎯 Key Points

1. **Primary Processing:** The cron job runs every minute and is the main way payouts are processed
2. **Immediate Processing:** Database triggers provide immediate processing when plans are created/updated
3. **Manual Override:** API route allows manual triggering for testing or recovery
4. **Recovery Mechanism:** Special functions exist to recover overdue payouts

---

## 🔍 Function URL

All calls use the same endpoint:
```
https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/process-automated-payouts
```

**Note:** The URL contains a hardcoded Supabase project ID. In production, this should be:
- Retrieved from environment variables, OR
- Constructed dynamically using `current_setting()` or environment config

---

## 🛠️ Testing

To manually test the function:

1. **Via API:**
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/process-automated-payouts" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

2. **Via Supabase Dashboard:**
   - Go to Functions > process-automated-payouts
   - Click "Invoke" button

3. **Via Database:**
   ```sql
   -- Trigger manually by updating a plan
   UPDATE payout_plans 
   SET next_payout_date = now() 
   WHERE id = 'plan-id-here';
   ```
