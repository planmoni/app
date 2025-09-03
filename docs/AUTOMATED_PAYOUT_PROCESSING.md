# Automated Payout Processing System

This system ensures that automated payouts are processed **immediately** when the timer runs out, with multiple layers of automation for reliability.

## 🎯 **How It Works**

### **Multi-Layer Processing (Immediate Execution)**

1. **Database Triggers** - Process payouts instantly when `next_payout_date` arrives
2. **Cron Jobs** - Check every minute for due payouts (backup processing)
3. **Real-time Processing** - No delays, immediate execution when conditions are met
4. **Automatic Scheduling** - Future payouts are scheduled automatically

### **Key Advantages**
- ✅ **Immediate Processing** - Payouts execute as soon as the timer runs out
- ✅ **Multiple Fallbacks** - Triggers + cron jobs ensure reliability
- ✅ **Real-time Updates** - Database triggers provide instant response
- ✅ **Automatic Recovery** - Failed payouts are retried automatically
- ✅ **Scalable** - Handles multiple users and plans simultaneously

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Payout Plan   │───▶│  Database        │───▶│  Edge Function  │
│   Timer Expires │    │  Trigger         │    │  Process        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        ▼                        ▼
         │              ┌──────────────────┐    ┌─────────────────┐
         │              │  Cron Job        │    ┌─────────────────┐
         │              │ (Every 1 min)    │    │  Paystack API   │
         │              └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Supabase DB   │◀───│  Update Wallet   │───▶│  Bank Transfer  │
│ (Balance Update)│    │  & Plan Status   │    │  (Immediate)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 **Setup Instructions**

### **1. Run the Setup Script**

```bash
# Make the script executable
chmod +x scripts/setup-automated-payouts.js

# Run the setup
node scripts/setup-automated-payouts.js
```

### **2. Manual Cron Job Setup**

In your Supabase dashboard, go to **Database > Cron Jobs** and create:

**Process Automated Payouts:**
- **Name**: `process-automated-payouts`
- **Schedule**: `* * * * *` (every minute)
- **Function**: `process-automated-payouts`
- **HTTP Method**: `POST`

**Schedule Automated Payouts:**
- **Name**: `schedule-automated-payouts`
- **Schedule**: `0 0 * * *` (daily at midnight)
- **Function**: `schedule-automated-payouts`
- **HTTP Method**: `POST`

### **3. Environment Variables**

Ensure these are set in your Supabase dashboard:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📋 **Processing Flow**

### **Immediate Processing (Database Triggers)**

1. **Timer Expires** - `next_payout_date` becomes due
2. **Trigger Fires** - Database trigger detects the change
3. **Function Called** - Edge function is triggered immediately
4. **Payout Processed** - Money is transferred within seconds

### **Backup Processing (Cron Jobs)**

1. **Every Minute** - Cron job checks for due payouts
2. **Batch Processing** - Processes all due payouts simultaneously
3. **Error Handling** - Retries failed payouts automatically
4. **Status Updates** - Updates plan progress and wallet balance

### **Scheduling (Daily)**

1. **Midnight** - Daily scheduling job runs
2. **Future Planning** - Schedules payouts for next 30 days
3. **Frequency Calculation** - Determines next payout dates
4. **Database Updates** - Creates scheduled payout records

## 🧪 **Testing**

### **Test Immediate Processing**

1. **Create a payout plan** with a due date of today
2. **Wait for the timer** to expire
3. **Check logs** - Should see immediate processing
4. **Verify transfer** - Money should be sent within minutes

### **Test Cron Job Processing**

```bash
# Test the process function manually
curl -X POST "https://your-project.supabase.co/functions/v1/process-automated-payouts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Test the schedule function
curl -X POST "https://your-project.supabase.co/functions/v1/schedule-automated-payouts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### **Monitor Function Logs**

In Supabase dashboard:
1. Go to **Functions > process-automated-payouts**
2. Click **Logs** to see real-time processing
3. Look for successful payout completions
4. Check for any error messages

## 🔧 **Troubleshooting**

### **Common Issues**

**Payouts Not Processing:**
- Check cron job is running (every minute)
- Verify database triggers are active
- Check function logs for errors
- Ensure environment variables are set

**Delayed Processing:**
- Verify cron job schedule is `* * * * *`
- Check database trigger is firing
- Monitor function execution time
- Ensure Paystack API is responding

**Failed Transfers:**
- Check Paystack secret key
- Verify bank account details
- Check recipient code creation
- Review error logs for specific issues

### **Performance Optimization**

**For High Volume:**
- Consider reducing cron frequency to every 30 seconds
- Add database indexes on `next_payout_date`
- Implement batch processing for multiple payouts
- Add retry logic for failed transfers

## 📊 **Monitoring & Analytics**

### **Key Metrics to Track**

1. **Processing Time** - How long from timer expiry to transfer
2. **Success Rate** - Percentage of successful payouts
3. **Error Patterns** - Common failure reasons
4. **Volume** - Number of payouts processed per day

### **Log Analysis**

```sql
-- Check payout processing status
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_processing_time
FROM automated_payouts 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Monitor trigger execution
SELECT 
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%payout%';
```

## 🎉 **Result**

With this system in place, your automated payouts will:

- **Process immediately** when the timer runs out
- **Execute reliably** with multiple fallback mechanisms
- **Update in real-time** with database triggers
- **Handle errors gracefully** with automatic retries
- **Scale automatically** for multiple users and plans

**No more waiting - payouts happen instantly when due!** 