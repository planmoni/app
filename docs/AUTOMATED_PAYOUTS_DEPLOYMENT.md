# Automated Payout System - Deployment Guide

## 🚀 Phase 1 & 2 Implementation Complete

### ✅ Completed Components

1. **Database Infrastructure**
   - `automated_payouts` table for execution tracking
   - Performance indexes for date-based queries
   - Wallet balance management functions
   - Payout eligibility validation functions

2. **Paystack Transfer Integration**
   - Complete Transfer API wrapper (`lib/paystack-transfers.ts`)
   - Recipient management system
   - Transfer initiation and verification
   - Transfer webhook handler (`app/api/paystack-transfer-webhook+api.ts`)

3. **Automated Processing**
   - Main processing function (`supabase/functions/process-due-payouts`)
   - Retry logic for failed transfers (`supabase/functions/retry-failed-payouts`)
   - Monitoring API (`app/api/payout-monitoring+api.ts`)

### 📦 Deployment Steps

#### 1. Database Migrations
```bash
# Apply database migrations
npx supabase db push

# Or apply individually:
npx supabase db push --file supabase/migrations/20250711000001_automated_payouts_infrastructure.sql
npx supabase db push --file supabase/migrations/20250711000002_payout_execution_logic.sql
```

#### 2. Environment Variables
Add these to your environment:
```bash
# Paystack Transfer API
PAYSTACK_SECRET_KEY=sk_live_your_secret_key
PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Supabase Service Role (for Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 3. Deploy Edge Functions
```bash
# Deploy the main processing function
npx supabase functions deploy process-due-payouts

# Deploy the retry function
npx supabase functions deploy retry-failed-payouts
```

#### 4. Set Up Cron Scheduling
In your Supabase dashboard:
1. Go to Edge Functions
2. Create cron triggers:
   - `process-due-payouts`: Every 30 minutes (`0 */30 * * * *`)
   - `retry-failed-payouts`: Every hour (`0 * * * *`)

#### 5. Configure Paystack Webhooks
In Paystack dashboard, add webhook URL:
- `https://your-domain.com/api/paystack-transfer-webhook`
- Enable events:
  - `transfer.success`
  - `transfer.failed` 
  - `transfer.reversed`

### 🔧 Configuration Options

#### Cron Schedule Recommendations
```bash
# Main processing - every 30 minutes during business hours
0 8-18/1 * * 1-5

# Retry processing - every 2 hours
0 */2 * * *

# Monitoring/health check - daily at 9 AM
0 9 * * *
```

#### Rate Limiting
The system respects Paystack API limits:
- Max 100 requests per minute for transfers
- Built-in retry logic with exponential backoff
- Failed transfers are queued for retry

### 📊 Monitoring

#### API Endpoints
- `GET /api/payout-monitoring?type=daily` - Daily statistics
- `GET /api/payout-monitoring?type=summary` - 7-day summary
- `GET /api/payout-monitoring?type=failed` - Failed payouts
- `POST /api/payout-monitoring` - Manual actions

#### Database Queries
```sql
-- Check payout statistics
SELECT * FROM get_payout_statistics(CURRENT_DATE);

-- View due payouts
SELECT * FROM get_due_payout_plans();

-- Monitor failed payouts
SELECT * FROM automated_payouts WHERE status IN ('failed', 'retrying');
```

### 🚨 Security Considerations

1. **API Keys**: Never expose Paystack secret keys in frontend
2. **Webhook Verification**: All webhooks are signature-verified
3. **RLS Policies**: All tables have Row Level Security enabled
4. **Audit Logging**: Complete audit trail for all transfers
5. **Balance Validation**: Double-checking wallet balances before transfers

### 🧪 Testing

#### Test Commands
```bash
# Test main processing function
curl -X POST https://your-project.supabase.co/functions/v1/process-due-payouts \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test retry function  
curl -X POST https://your-project.supabase.co/functions/v1/retry-failed-payouts \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test monitoring API
curl https://your-domain.com/api/payout-monitoring?type=daily
```

#### Webhook Testing
```bash
# Test transfer webhook
node scripts/test-transfer-webhook.js
```

### 📈 Performance Metrics

#### Expected Performance
- Processing time: < 30 seconds per payout
- Success rate: > 99.5%
- Retry success rate: > 90%
- API response time: < 5 seconds

#### Monitoring Alerts
- Failed transfer rate > 1%
- Processing time > 60 seconds
- Retry queue length > 50
- Webhook failure rate > 5%

### 🔄 Next Steps (Phase 3 & 4)

#### Immediate (Week 3)
- [ ] Comprehensive testing suite
- [ ] Production monitoring setup
- [ ] Security audit and validation
- [ ] Performance optimization

#### Future (Week 4)
- [ ] User dashboard for transfer status
- [ ] Real-time notifications
- [ ] Advanced analytics and reporting
- [ ] Mobile app integration

### 📞 Support

For technical issues:
1. Check Edge Function logs in Supabase dashboard
2. Monitor webhook delivery in Paystack dashboard
3. Query `automated_payouts` table for transfer status
4. Use monitoring API for system health

### 🎉 Success Criteria

- [x] Automated payout processing implemented
- [x] Transfer failure handling with retry logic
- [x] Complete audit trail and monitoring
- [x] Webhook integration for status updates
- [ ] Production deployment and testing
- [ ] User interface integration
- [ ] Performance optimization complete
