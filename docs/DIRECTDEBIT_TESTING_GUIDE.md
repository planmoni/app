# Mono DirectDebit Testing Guide

## 🧪 Where to Test

### Option 1: Through Deposit Flow (Production Path)

1. **Home Screen** → Click **"Add funds"** or **"Quick Topup"**
2. **Payment Methods Screen** → Select a **Linked Bank Account** with Mono (shows "DirectDebit")
3. **Amount Screen** → Enter amount (e.g., ₦5,000)
4. **Authorization Screen** → Click **"Fund wallet now"**

### Option 2: Direct Test Section (Development Only)

In **development mode** (`__DEV__`), you'll see a **"🧪 Test DirectDebit"** card on the home screen that takes you directly to the payment methods screen.

## 📋 Testing Flow

### Step 1: Link a Bank Account
1. Go to **Linked Accounts** screen
2. Link a bank account via Mono Connect
3. Ensure the account has `mono_account_id` set

### Step 2: Create Mandate (First Time)
1. Navigate to deposit flow
2. Select the linked bank account
3. Enter amount
4. Click "Fund wallet now"
5. **First time**: You'll be prompted to authorize a mandate
   - Click "Authorize"
   - Mandate will be created
   - You'll need to authorize via Mono widget (if `mono_url` is provided)

### Step 3: Execute Debit (After Mandate is Active)
1. Once mandate is active, try funding again
2. The system will automatically use the active mandate
3. Debit will be executed
4. Wallet will be funded (after webhook confirms settlement)

## 🔍 What to Check

### Mandate Creation
- ✅ Mandate is created in `mono_mandates` table
- ✅ Status is `pending` initially
- ✅ `mono_mandate_id` and `mono_reference` are set
- ✅ User receives `mono_url` for authorization (if provided)

### Mandate Authorization
- ✅ User authorizes via Mono widget
- ✅ Webhook receives `mandate.activated` event
- ✅ Mandate status updates to `active` in database

### Debit Execution
- ✅ Debit is created via Edge Function
- ✅ Transaction record is created with status `pending`
- ✅ Webhook receives `debit.successful` event (when settled)
- ✅ Wallet is credited only after settlement is confirmed

### Webhook Processing
- ✅ Signature verification works
- ✅ Event ID idempotency prevents duplicates
- ✅ Only settled debits credit wallet

## 🐛 Common Issues

### "Mandate not found"
- **Cause**: No active mandate for the bank account
- **Fix**: Create and authorize mandate first

### "Mandate is not active"
- **Cause**: Mandate exists but not yet authorized
- **Fix**: Authorize via Mono widget

### "Amount exceeds limit"
- **Cause**: Debit amount exceeds mandate authorization limit
- **Fix**: Create new mandate with higher limit or use smaller amount

### Webhook not processing
- **Check**: 
  - Webhook URL is configured in Mono dashboard
  - `MONO_WEBHOOK_SECRET` is set in Edge Function secrets
  - Webhook signature verification is working

## 📊 Database Checks

### Check Mandate Status
```sql
SELECT * FROM mono_mandates 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC;
```

### Check Transactions
```sql
SELECT * FROM transactions 
WHERE source = 'mono_directdebit' 
ORDER BY created_at DESC;
```

### Check Webhook Events
```sql
SELECT metadata->>'webhook_event_id', status, amount, created_at
FROM transactions 
WHERE source = 'mono_directdebit'
ORDER BY created_at DESC;
```

## 🚀 Quick Test Commands

### Test Mandate Creation
1. Use the deposit flow
2. Select linked account
3. Enter amount
4. Click "Fund wallet now"
5. Authorize mandate when prompted

### Test Debit Execution
1. Ensure you have an active mandate
2. Use deposit flow again
3. Select same account
4. Enter amount (within mandate limit)
5. Click "Fund wallet now"
6. Debit should execute immediately

## 📝 Notes

- **Development Mode**: Test section only shows in `__DEV__` mode
- **Mandate Limit**: Default is ₦1,000,000 total authorization
- **Settlement**: DirectDebit debits may take 1-3 business days to settle
- **Webhook**: Only credits wallet after confirmed settlement

---

**Happy Testing!** 🎉

