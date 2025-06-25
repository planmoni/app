# Transaction-Based Balance Update System

This guide explains how to use Paystack's Transactions API to automatically update your balance when money is sent to your virtual account.

## 🎯 **How It Works**

Instead of relying on webhooks, this system:
1. **Fetches transactions** from Paystack's API every 30 seconds
2. **Filters transactions** for your virtual account
3. **Processes new transactions** and updates your balance
4. **Creates transaction records** in your database
5. **Sends notifications** when funds are received

## ✅ **Advantages Over Webhooks**

- ✅ **More reliable** - No dependency on webhook delivery
- ✅ **No webhook setup** - Works out of the box
- ✅ **Automatic retry** - Checks every 30 seconds
- ✅ **Better error handling** - Detailed logging and error recovery
- ✅ **Manual refresh** - Pull-to-refresh and manual refresh button

## 🔧 **Components**

### 1. **Paystack Transactions Hook** (`hooks/usePaystackTransactions.ts`)
- Fetches transactions from Paystack API
- Filters for user's virtual account
- Processes new transactions automatically
- Updates balance in real-time

### 2. **API Endpoint** (`app/api/fetch-paystack-transactions+api.ts`)
- Manual transaction fetching endpoint
- Can be called independently
- Returns processing results

### 3. **Home Screen Integration** (`app/(tabs)/index.tsx`)
- Uses the transactions hook
- Shows loading indicators
- Provides manual refresh functionality

## 🚀 **Getting Started**

### 1. **Environment Variables**
Make sure you have these set in your `.env` file:
```bash
EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. **Virtual Account Setup**
Ensure you have a virtual account created in your app:
1. Go to "Add Funds" in your app
2. Create a virtual account if you haven't already
3. Note down the account number

### 3. **Test the System**
```bash
# Test transaction fetching
node scripts/test-transaction-fetch.js
```

## 🧪 **Testing**

### **Step 1: Send Money to Virtual Account**
1. Use your bank app to send money to your virtual account
2. Wait for the transaction to appear in Paystack dashboard

### **Step 2: Check Balance Update**
1. **Automatic**: Wait 30 seconds for automatic check
2. **Manual**: Pull down on home screen to refresh
3. **Button**: Tap the refresh button in balance card

### **Step 3: Verify Processing**
Check your app logs for:
```
🔍 Fetching Paystack transactions for user: [user-id]
📡 Fetching transactions for account: [account-number]
Found X transactions for user
Processing X new transactions
Successfully added ₦X to wallet for transaction [reference]
```

## 📊 **How Transactions Are Processed**

### **1. Fetch Transactions**
```javascript
// Fetches all transactions from Paystack
const response = await fetch('https://api.paystack.co/transaction', {
  headers: {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
  },
});
```

### **2. Filter User Transactions**
```javascript
// Filters for user's virtual account
const userTransactions = data.data.filter(tx => 
  tx.authorization?.account_number === userAccountNumber ||
  tx.customer?.email === userEmail
);
```

### **3. Find New Transactions**
```javascript
// Compares with existing transactions in database
const newTransactions = userTransactions.filter(tx => 
  tx.status === 'success' && 
  !existingReferences.has(tx.reference)
);
```

### **4. Process Each Transaction**
```javascript
// Adds funds to wallet
await supabase.rpc('add_funds', {
  arg_user_id: userId,
  arg_amount: amountInNaira
});

// Creates transaction record
await supabase.from('transactions').insert({
  user_id: userId,
  type: 'deposit',
  amount: amountInNaira,
  reference: tx.reference,
  // ... other fields
});
```

## 🔍 **Monitoring and Debugging**

### **Check Processing Status**
The system logs detailed information:
- Transaction fetching status
- Number of transactions found
- Processing results
- Error messages

### **Manual Testing**
```bash
# Test the API endpoint directly
curl -X POST http://localhost:3000/api/fetch-paystack-transactions \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user-id"}'
```

### **Check Database**
```sql
-- Check processed transactions
SELECT * FROM transactions 
WHERE user_id = 'your-user-id' 
AND type = 'deposit' 
ORDER BY created_at DESC;

-- Check wallet balance
SELECT * FROM wallets 
WHERE user_id = 'your-user-id';
```

## ⚙️ **Configuration Options**

### **Check Interval**
Default: 30 seconds
```javascript
// In usePaystackTransactions.ts
const interval = setInterval(fetchPaystackTransactions, 30000);
```

### **Transaction Filtering**
The system filters for:
- ✅ Successful transactions (`status === 'success'`)
- ✅ Virtual account transactions (has `authorization.account_number`)
- ✅ New transactions (not already processed)

### **Amount Conversion**
Paystack amounts are in kobo, converted to naira:
```javascript
const amountInNaira = transaction.amount / 100;
```

## 🚨 **Common Issues**

### **1. No Transactions Found**
- Check if virtual account is created
- Verify Paystack API key is correct
- Ensure money was actually sent to the account

### **2. Transactions Not Processing**
- Check database connection
- Verify user ID is correct
- Check for duplicate transaction references

### **3. Balance Not Updating**
- Check if `add_funds` function exists in database
- Verify wallet record exists for user
- Check for database errors in logs

### **4. API Errors**
- Verify Paystack API key is valid
- Check if API key has transaction access
- Ensure account is not in test mode

## 📈 **Performance Considerations**

### **API Rate Limits**
- Paystack has rate limits on API calls
- 30-second interval is conservative
- Consider increasing interval for production

### **Database Optimization**
- Transaction references are indexed for fast lookups
- Only processes new transactions
- Avoids duplicate processing

### **Error Handling**
- Continues processing if one transaction fails
- Logs errors for debugging
- Graceful degradation

## 🎉 **Success Indicators**

You'll know the system is working when:
- ✅ Balance updates automatically after sending money
- ✅ Transaction records appear in database
- ✅ Notifications are created
- ✅ Logs show successful processing
- ✅ Manual refresh works correctly

## 🔄 **Manual Refresh Options**

1. **Pull-to-refresh** on home screen
2. **Refresh button** in balance card
3. **API endpoint** for programmatic access
4. **Test script** for debugging

## 📞 **Support**

If you need help:
1. Check the logs for error messages
2. Verify your Paystack API key
3. Test with the provided scripts
4. Check database connectivity
5. Verify virtual account setup 