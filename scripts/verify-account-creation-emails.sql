-- Account Creation Email Verification Queries
-- Run these queries to verify the account creation email implementation is working

-- ============================================================================
-- 1. OVERVIEW: Check all account creation email records
-- ============================================================================
SELECT 
  id,
  user_id,
  account_number,
  account_name,
  bank_name,
  email_sent,
  sent_at,
  error_message,
  created_at,
  updated_at
FROM account_creation_emails
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- 2. SUCCESS RATE: Check overall success/failure rate
-- ============================================================================
SELECT 
  email_sent,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM account_creation_emails
GROUP BY email_sent
ORDER BY email_sent DESC;

-- ============================================================================
-- 3. FAILED EMAILS: Find all failed email attempts
-- ============================================================================
SELECT 
  id,
  user_id,
  account_number,
  account_name,
  error_message,
  email_provider_response,
  created_at
FROM account_creation_emails
WHERE email_sent = false
ORDER BY created_at DESC;

-- ============================================================================
-- 4. USER-SPECIFIC: Check emails for a specific user by email
-- ============================================================================
SELECT 
  ace.id,
  ace.user_id,
  ace.account_number,
  ace.account_name,
  ace.bank_name,
  ace.email_sent,
  ace.sent_at,
  ace.error_message,
  ace.email_provider_response,
  ace.created_at,
  p.email as user_email,
  p.first_name,
  p.last_name
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
ORDER BY ace.created_at DESC;

-- ============================================================================
-- 5. SUCCESSFUL EMAILS: View successful email details with Resend response
-- ============================================================================
SELECT 
  ace.id,
  ace.user_id,
  ace.account_number,
  ace.account_name,
  ace.sent_at,
  p.email as user_email,
  p.first_name,
  ace.email_provider_response->>'id' as resend_email_id,
  ace.email_provider_response->>'from' as from_email,
  ace.email_provider_response->>'to' as to_email,
  ace.email_provider_response->>'created_at' as resend_created_at
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE ace.email_sent = true
ORDER BY ace.sent_at DESC
LIMIT 20;

-- ============================================================================
-- 6. DAILY STATS: Email statistics for the last 7 days
-- ============================================================================
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE email_sent = true) as successful,
  COUNT(*) FILTER (WHERE email_sent = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email_sent = true) / COUNT(*), 2) as success_rate_percent
FROM account_creation_emails
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 7. RECENT ACTIVITY: Last 24 hours of email activity
-- ============================================================================
SELECT 
  ace.id,
  ace.account_number,
  ace.account_name,
  ace.email_sent,
  ace.sent_at,
  ace.error_message,
  ace.created_at,
  p.email as user_email,
  p.first_name
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE ace.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ace.created_at DESC;

-- ============================================================================
-- 8. ERROR ANALYSIS: Detailed error information
-- ============================================================================
SELECT 
  ace.id,
  ace.user_id,
  ace.account_number,
  ace.error_message,
  ace.email_provider_response,
  ace.created_at,
  p.email as user_email
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE ace.email_sent = false
  AND ace.error_message IS NOT NULL
ORDER BY ace.created_at DESC
LIMIT 20;

-- ============================================================================
-- 9. TEST FUNCTION: Send a test email (uncomment to use)
-- ============================================================================
-- SELECT send_test_account_creation_email(
--   'itsmartinsevans@gmail.com',
--   '1234567890',
--   'Test Account Name',
--   'SafeHaven Microfinance Bank'
-- );

-- ============================================================================
-- 10. CHECK USER EXISTS: Verify user exists before testing
-- ============================================================================
SELECT 
  id,
  email,
  first_name,
  last_name,
  created_at
FROM profiles
WHERE email = 'itsmartinsevans@gmail.com';

-- ============================================================================
-- 11. DIAGNOSE FAILED EMAIL: Detailed error information for specific user
-- ============================================================================
SELECT 
  ace.id,
  ace.user_id,
  ace.account_number,
  ace.account_name,
  ace.email_sent,
  ace.sent_at,
  ace.error_message,
  ace.email_provider_response,
  ace.created_at,
  ace.updated_at,
  p.email as user_email,
  p.first_name,
  -- Check if error_message exists
  CASE 
    WHEN ace.error_message IS NOT NULL THEN 'Has error message'
    WHEN ace.email_provider_response IS NOT NULL THEN 'Has provider response'
    ELSE 'No error details recorded'
  END as error_status
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
ORDER BY ace.created_at DESC;

-- ============================================================================
-- 12. VIEW FULL ERROR DETAILS: See complete error information
-- ============================================================================
SELECT 
  ace.id,
  ace.error_message,
  ace.email_provider_response::text as full_response,
  ace.created_at,
  p.email as user_email
FROM account_creation_emails ace
JOIN profiles p ON ace.user_id = p.id
WHERE p.email = 'itsmartinsevans@gmail.com'
  AND ace.email_sent = false
ORDER BY ace.created_at DESC
LIMIT 5;

-- ============================================================================
-- 13. RETRY FAILED EMAIL: Retry sending email for a specific record
-- ============================================================================
-- First, get the record ID:
-- SELECT id FROM account_creation_emails 
-- WHERE user_id = (SELECT id FROM profiles WHERE email = 'itsmartinsevans@gmail.com')
--   AND email_sent = false
-- ORDER BY created_at DESC LIMIT 1;

-- Then retry (replace [RECORD_ID] with the ID from above):
-- SELECT retry_account_creation_email('[RECORD_ID]');

-- Or retry all failed emails for a user:
-- SELECT retry_user_account_creation_emails('itsmartinsevans@gmail.com');

