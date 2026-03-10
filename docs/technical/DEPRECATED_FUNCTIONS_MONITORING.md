# Deprecated Functions Monitoring Guide

## 📊 Monitoring Deprecated Function Calls

The deprecated functions now include comprehensive logging to track who is calling them during the deprecation period.

## 🔍 What Gets Logged

### 1. PostgreSQL Logs (RAISE WARNING)
Every call generates a WARNING in PostgreSQL logs with:
- Function name
- Parameters (frequency, completed_payouts)
- Caller information (process ID, application name)

**Example:**
```
WARNING: DEPRECATED FUNCTION CALL: calculate_next_payout_date_with_time() called with frequency=weekly_specific, completed_payouts=1. Caller: 12345:my-app
```

### 2. Database Table (Optional)
If the `deprecated_function_calls` table exists, calls are logged there with:
- Function name
- Timestamp
- Parameters (JSONB)
- Caller information

## 📋 Monitoring Queries

### Check Recent Calls
```sql
-- See all recent calls
SELECT 
  function_name,
  called_at,
  parameters,
  caller_info
FROM public.deprecated_function_calls
ORDER BY called_at DESC
LIMIT 100;
```

### Summary by Function
```sql
-- Use the summary view
SELECT * FROM public.deprecated_function_calls_summary;
```

### Calls by Frequency
```sql
-- See which frequencies are being used
SELECT 
  function_name,
  parameters->>'frequency' as frequency,
  COUNT(*) as call_count,
  MAX(called_at) as last_called
FROM public.deprecated_function_calls
GROUP BY function_name, parameters->>'frequency'
ORDER BY call_count DESC;
```

### Daily Call Count
```sql
-- Track daily usage
SELECT 
  DATE(called_at) as call_date,
  function_name,
  COUNT(*) as call_count
FROM public.deprecated_function_calls
WHERE called_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(called_at), function_name
ORDER BY call_date DESC, call_count DESC;
```

### Find Callers
```sql
-- Identify unique callers
SELECT 
  function_name,
  caller_info,
  COUNT(*) as call_count,
  MIN(called_at) as first_seen,
  MAX(called_at) as last_seen
FROM public.deprecated_function_calls
GROUP BY function_name, caller_info
ORDER BY call_count DESC;
```

## 🚨 Alert Queries

### High Usage Alert
```sql
-- Alert if functions are called more than 100 times per day
SELECT 
  function_name,
  DATE(called_at) as call_date,
  COUNT(*) as call_count
FROM public.deprecated_function_calls
WHERE called_at >= CURRENT_DATE
GROUP BY function_name, DATE(called_at)
HAVING COUNT(*) > 100
ORDER BY call_count DESC;
```

### Weekly_Specific Usage Alert
```sql
-- Alert if weekly_specific is being used with deprecated functions
SELECT 
  function_name,
  called_at,
  parameters,
  caller_info
FROM public.deprecated_function_calls
WHERE parameters->>'frequency' = 'weekly_specific'
ORDER BY called_at DESC;
```

## 📈 Monitoring Dashboard Queries

### Overall Statistics
```sql
-- Complete overview
SELECT 
  function_name,
  COUNT(*) as total_calls,
  COUNT(DISTINCT DATE(called_at)) as days_active,
  MIN(called_at) as first_call,
  MAX(called_at) as last_call,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT DATE(called_at)), 0), 2) as avg_calls_per_day
FROM public.deprecated_function_calls
GROUP BY function_name
ORDER BY total_calls DESC;
```

### Trend Analysis
```sql
-- 7-day rolling average
SELECT 
  call_date,
  function_name,
  call_count,
  AVG(call_count) OVER (
    PARTITION BY function_name 
    ORDER BY call_date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as rolling_avg_7d
FROM (
  SELECT 
    DATE(called_at) as call_date,
    function_name,
    COUNT(*) as call_count
  FROM public.deprecated_function_calls
  WHERE called_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(called_at), function_name
) daily_stats
ORDER BY call_date DESC, function_name;
```

## 🔧 Maintenance Queries

### Cleanup Old Logs (After 90 days)
```sql
-- Archive old logs (run monthly)
DELETE FROM public.deprecated_function_calls
WHERE called_at < NOW() - INTERVAL '90 days';
```

### Check if Functions Are Still Used
```sql
-- Check if functions haven't been called in 30 days
SELECT 
  function_name,
  MAX(called_at) as last_called,
  CASE 
    WHEN MAX(called_at) < NOW() - INTERVAL '30 days' THEN 'SAFE TO REMOVE'
    ELSE 'STILL IN USE'
  END as status
FROM public.deprecated_function_calls
GROUP BY function_name
ORDER BY last_called DESC;
```

## 📝 PostgreSQL Log Monitoring

### View Logs (if accessible)
```bash
# Check PostgreSQL logs for deprecation warnings
grep "DEPRECATED FUNCTION CALL" /var/log/postgresql/postgresql-*.log

# Or in Supabase dashboard
# Go to Logs > Database Logs and filter for "DEPRECATED"
```

## 🎯 Decision Criteria

### Safe to Remove When:
1. ✅ No calls in last 90 days
2. ✅ Confirmed no other code/triggers use them
3. ✅ All migrations updated
4. ✅ Team notified

### Still in Use When:
1. ❌ Recent calls in last 30 days
2. ❌ High call volume (> 10/day)
3. ❌ Multiple unique callers
4. ❌ Critical paths using them

## 📊 Reporting Template

### Weekly Deprecation Report
```sql
-- Generate weekly report
SELECT 
  'Week of ' || DATE_TRUNC('week', CURRENT_DATE)::date as report_period,
  function_name,
  COUNT(*) as total_calls,
  COUNT(DISTINCT DATE(called_at)) as active_days,
  COUNT(DISTINCT caller_info) as unique_callers,
  MAX(called_at) as last_call,
  CASE 
    WHEN MAX(called_at) < NOW() - INTERVAL '7 days' THEN 'INACTIVE'
    WHEN COUNT(*) < 10 THEN 'LOW USAGE'
    WHEN COUNT(*) < 100 THEN 'MODERATE USAGE'
    ELSE 'HIGH USAGE'
  END as usage_status
FROM public.deprecated_function_calls
WHERE called_at >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY function_name
ORDER BY total_calls DESC;
```

## 🚀 Next Steps

1. **Deploy Migration** - Apply `20260125000001_fix_helper_functions_weekly_specific.sql`
2. **Monitor for 1 Week** - Check logs and table daily
3. **Identify Callers** - Use queries above to find who's calling
4. **Update Code** - Replace calls with `update_payout_plan_progress()`
5. **Monitor for 3 Months** - Track usage decline
6. **Remove Functions** - After confirmation of no usage

## ⚠️ Important Notes

- **Logging is Non-Blocking**: If logging fails, functions still work
- **Table is Optional**: Functions work even if table doesn't exist
- **Performance Impact**: Minimal (logging is fast, indexed)
- **Storage**: Monitor table size, cleanup old logs periodically
