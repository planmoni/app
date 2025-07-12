# Scheduled Transaction Checking System

This system automatically detects when money is sent to your app's virtual accounts and sends email notifications, even when the app is closed.

## 🎯 **How It Works**

### **Hybrid Solution (Best of Both Worlds)**
This system combines client-side and server-side processing for maximum speed:
1. **Client-Side** - Checks every 30 seconds when app is open (instant response)
2. **Server-Side** - Checks every 1 minute via cron jobs (works when app is closed)
3. **Manual Triggers** - Client triggers server checks for redundancy
4. **Paystack API** - Fetches all transactions
5. **Email Notifications** - Sends via Resend API
6. **Database Updates** - Updates wallet balance and creates transaction records

### **Key Advantages**
- ✅ **Lightning fast** - Client-side checks every 30 seconds (instant response)
- ✅ **Works when app is closed** - Server-side processing every 1 minute
- ✅ **Redundant checking** - Client triggers server checks for reliability
- ✅ **Email notifications** - Instant alerts when money is received
- ✅ **Reliable processing** - No dependency on app state
- ✅ **Scalable** - Handles multiple users simultaneously

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Edge Function   │───▶│  Paystack API   │
│ (Every 30s)     │    │ check-new-       │    │                 │
│                 │    │ transactions     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        ▼                        │
         │              ┌──────────────────┐               │
         │              │  Cron Job        │               │
         │              │ (Every 1 min)    │               │
         │              └──────────────────┘               │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Supabase DB   │◀───│  Process New     │───▶│  Resend API     │
│ (Update wallet) │    │  Transactions    │    │ (Send emails)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 **Setup Instructions**

### **1. Deploy the Edge Function**

```bash
# Navigate to your project directory
cd your-project

# Deploy the function
supabase functions deploy check-new-transactions
```

### **2. Set Environment Variables**

In your Supabase dashboard, go to **Settings > Functions** and add these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYSTACK_LIVE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **3. Create the Cron Job**

In your Supabase dashboard, go to **Database > Cron Jobs** and create a new job:

- **Name**: `check-new-transactions`
- **Schedule**: `*/1 * * * *` (every 1 minute - much faster!)
- **Function**: `check-new-transactions`
- **HTTP Method**: `POST`

### **4. Run Database Migration**

```bash
# Apply the migration to add deposit_alerts field
supabase db push
```

## 🧪 **Testing**

### **Manual Testing**

```bash
# Test the function manually
node scripts/test-scheduled-transactions.js

# Check function status
node scripts/test-scheduled-transactions.js --status

# Test with mock data
node scripts/test-scheduled-transactions.js --mock
```

### **Real Testing**

1. **Send money** to your virtual account
2. **Wait up to 30 seconds** if app is open (client-side check)
3. **Wait up to 1 minute** if app is closed (server-side check)
4. **Check your email** for notifications
5. **Verify balance** is updated in your app

## 📋 **What the System Does**

### **Multiple Check Points:**

**Client-Side (When App is Open):**
- Checks every 30 seconds
- Instant response within seconds
- Also triggers server checks for redundancy

**Server-Side (Always Running):**
- Checks every 1 minute via cron job
- Works even when app is closed
- Processes all users simultaneously

1. **Fetches all Paystack transactions**
   ```javascript
   const response = await fetch('https://api.paystack.co/transaction', {
     headers: { 'Authorization': `Bearer ${paystackSecretKey}` }
   });
   ```

2. **Gets all users with Paystack accounts**
   ```sql
   SELECT user_id, account_number, profiles.email, profiles.first_name
   FROM paystack_accounts
   JOIN profiles ON paystack_accounts.user_id = profiles.id
   ```

3. **Filters transactions for each user**
   ```javascript
   const userTransactions = paystackData.data.filter(tx => 
     tx.authorization?.account_number === accountNumber &&
     tx.status === 'success' &&
     tx.channel === 'dedicated_nuban'
   );
   ```

4. **Finds new transactions**
   ```javascript
   const newTransactions = userTransactions.filter(tx => 
     !existingReferences.has(tx.reference)
   );
   ```

5. **Processes each new transaction**
   - Adds funds to wallet
   - Creates transaction record
   - Creates notification event
   - Sends email notification

6. **Sends email notifications**
   ```javascript
   const emailResponse = await fetch("https://api.resend.com/emails", {
     method: "POST",
     headers: { "Authorization": `Bearer ${resendApiKey}` },
     body: JSON.stringify({
       from: "Planmoni <notifications@planmoni.com>",
       to: userEmail,
       subject: "Funds Received - Planmoni",
       html: emailHtml
     })
   });
   ```

## 📧 **Email Notifications**

### **Email Template Features**
- ✅ **Professional design** with Planmoni branding
- ✅ **Transaction details** (amount, account, date, reference)
- ✅ **Mobile responsive** design
- ✅ **Call-to-action** button to open app
- ✅ **Security notice** for unexpected transactions

### **Email Content**
```
Subject: Funds Received - Planmoni

💰 Funds Received!
Hello [FirstName], money has been added to your Planmoni wallet

Amount: ₦[Amount]

Details:
- Account Number: [AccountNumber]
- Date & Time: [DateTime]
- Reference: [Reference]

[View in App Button]

Your funds are now available in your wallet and ready to be used for your payout plans.
```

## ⚙️ **Configuration Options**

### **Check Frequency**
**Client-Side**: Every 30 seconds (when app is open)
**Server-Side**: Every 1 minute (`*/1 * * * *`)

You can change the server frequency in the cron job settings:
- Every 30 seconds: `*/0.5 * * * *` (not recommended - too frequent)
- Every 2 minutes: `*/2 * * * *`
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`

### **Email Notifications**
Users can control email notifications in their profile settings:
```json
{
  "login_alerts": true,
  "payout_alerts": true,
  "expiry_reminders": true,
  "wallet_summary": "weekly",
  "deposit_alerts": true  // New field
}
```

### **Transaction Filtering**
The system only processes:
- ✅ Successful transactions (`status === 'success'`)
- ✅ Virtual account transactions (`channel === 'dedicated_nuban'`)
- ✅ New transactions (not already processed)
- ✅ Transactions with valid account numbers

## 🔍 **Monitoring and Debugging**

### **View Function Logs**

```bash
# Follow function logs in real-time
supabase functions logs check-new-transactions --follow

# View recent logs
supabase functions logs check-new-transactions
```

### **Check Cron Job Status**

In Supabase dashboard:
1. Go to **Database > Cron Jobs**
2. Check the status of `check-new-transactions`
3. View execution history and logs

### **Database Queries**

```sql
-- Check processed transactions
SELECT * FROM transactions 
WHERE metadata->>'processed_by' = 'scheduled_function'
ORDER BY created_at DESC;

-- Check notification events
SELECT * FROM events 
WHERE type = 'deposit_successful'
ORDER BY created_at DESC;

-- Check user notification preferences
SELECT id, email, email_notifications 
FROM profiles 
WHERE email_notifications->>'deposit_alerts' = 'true';
```

## 🚨 **Common Issues and Solutions**

### **1. Function Not Deployed**
```
Error: Function not found
```
**Solution**: Deploy the function first
```bash
supabase functions deploy check-new-transactions
```

### **2. Environment Variables Missing**
```
Error: Server configuration error
```
**Solution**: Set all required environment variables in Supabase dashboard

### **3. Paystack API Errors**
```
Error: Failed to fetch Paystack transactions
```
**Solution**: 
- Verify Paystack API key is correct
- Check if API key has proper permissions
- Ensure you're using live key for production

### **4. Email Not Sending**
```
Error: Failed to send email notification
```
**Solution**:
- Verify Resend API key is correct
- Check if email domain is verified in Resend
- Ensure user has enabled deposit alerts

### **5. No Transactions Found**
```
Message: No new transactions found
```
**Solution**:
- This is normal if no new payments were made
- Send money to virtual account and test again
- Check if virtual account is active

## 📊 **Performance Considerations**

### **API Rate Limits**
- **Paystack**: 100 requests per minute
- **Resend**: 10,000 emails per month (free tier)
- **Supabase**: Varies by plan

### **Optimization Tips**
- ✅ Process transactions in batches
- ✅ Use efficient database queries
- ✅ Handle errors gracefully
- ✅ Log important events for debugging

### **Scaling**
- The system automatically handles multiple users
- Each user's transactions are processed independently
- No user data is shared between users

## 🔒 **Security Features**

### **Data Protection**
- ✅ Service role key used for admin operations
- ✅ User data is isolated per user
- ✅ No sensitive data logged
- ✅ Secure API key handling

### **Error Handling**
- ✅ Graceful failure handling
- ✅ Detailed error logging
- ✅ No partial state updates
- ✅ Transaction rollback on errors

## 📈 **Analytics and Metrics**

The function returns useful metrics:
```json
{
  "success": true,
  "processed": 3,
  "totalAmount": 15000,
  "emailsSent": 3,
  "accountsChecked": 5
}
```

### **Key Metrics to Monitor**
- **Processed transactions** - Number of new transactions found
- **Total amount** - Sum of all processed transactions
- **Emails sent** - Number of notifications delivered
- **Accounts checked** - Number of users processed

## 🎉 **Success Indicators**

### **When Everything Works:**
1. ✅ Money sent to virtual account
2. ✅ Client-side check every 30 seconds (if app open)
3. ✅ Server-side check every 1 minute (always running)
4. ✅ Transaction detected and processed
5. ✅ Wallet balance updated
6. ✅ Email notification sent
7. ✅ App shows updated balance immediately

### **Expected Timeline:**
- **0-30 seconds**: Money sent to virtual account
- **30 seconds**: Client-side check (if app open) - INSTANT
- **1 minute**: Server-side check (always) - RELIABLE
- **1-2 minutes**: Transaction processed and email sent
- **App open**: Updated balance visible immediately

## 🛠️ **Maintenance**

### **Regular Checks**
- Monitor function logs weekly
- Check cron job execution status
- Verify email delivery rates
- Review error logs

### **Updates**
- Keep Paystack API key current
- Update Resend API key if needed
- Monitor Supabase function limits
- Review and optimize queries

This system ensures your users never miss a transaction, even when they're not actively using the app! 