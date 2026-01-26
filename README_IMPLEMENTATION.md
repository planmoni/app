# Planmoni for Business - Implementation Documentation

## 📋 Overview

**Planmoni for Business** is a comprehensive Platform-as-a-Service (PaaS) implementation that transforms Planmoni from a B2C financial planning app into a multi-tenant platform. Businesses can now integrate Planmoni's controlled money access features into their own applications, enabling use cases like:

- **Healthcare Platforms**: Controlled disbursements for medical expenses
- **Payroll Systems**: Automated salary disbursements with approval workflows
- **Education Platforms**: Tuition payment management with restrictions
- **Marketplaces**: Escrow and controlled fund releases
- **Employers**: Employee benefit disbursements

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime subscriptions
- **Authentication**: Supabase Auth + API Key authentication
- **Payment Processing**: Paystack integration

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Partner Applications                       │
│  (Healthcare, Payroll, Education, etc.)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ API Key / Bearer Token
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Planmoni Platform API (v1)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Auth        │  │  Rate Limit  │  │  Policy      │     │
│  │  Middleware   │  │  Middleware   │  │  Engine      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Core Services                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Approval    │  │  Audit       │  │  Webhook     │     │
│  │  Engine      │  │  Ledger      │  │  Delivery    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Supabase Database                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Partners    │  │  Wallets     │  │  Policies    │     │
│  │  Tables      │  │  &           │  │  &           │     │
│  │              │  │  Restrictions│  │  Approvals    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

### 1. Multi-Tenancy
- Partner onboarding and management
- API key generation and rotation
- Partner-specific settings and configurations
- User mapping between partner systems and Planmoni

### 2. Restricted Wallets
- Policy-based wallet restrictions
- Balance limits (min/max)
- Transaction limits (daily, per-transaction)
- Time-based restrictions
- Purpose-based restrictions

### 3. Policy Engine
- Rule-based policy evaluation
- Server-side enforcement via PostgreSQL functions
- Support for complex policy rules
- Default policies per partner

### 4. Approval Workflows
- Multi-step approval processes
- Auto-approval rules
- Expiration handling
- Approval history tracking

### 5. Audit & Compliance
- Immutable audit ledger for all money movements
- Cryptographic integrity verification
- Complete audit trail of policy changes
- Append-only design prevents tampering

### 6. Webhook System
- Configurable webhook endpoints per partner
- Retry logic with exponential backoff
- Delivery status tracking
- Event filtering

### 7. Rate Limiting
- Tier-based rate limits (Standard, Premium, Enterprise)
- Per-partner rate limit configuration
- API usage tracking and analytics
- Automatic enforcement

### 8. Embedded Widgets
- Wallet Balance Widget
- Disbursement Request Widget
- Easy integration into partner applications
- CORS-enabled for cross-origin embedding

### 9. TypeScript SDK
- Full-featured SDK for programmatic integration
- Type-safe API client
- Resource-based architecture
- Comprehensive examples

### 10. Partner Dashboard
- Web-based dashboard for partners
- Wallet management
- Policy configuration
- Approval monitoring
- Analytics and reporting

## 📊 Database Schema

### Core Tables

#### Partner Management
- `partners` - Partner organizations
- `partner_api_keys` - API key management
- `partner_users` - User mapping (partner user ID → Planmoni user)
- `partner_settings` - Partner-specific configurations

#### Wallet System
- `wallets` - Extended with `partner_id`, `is_restricted`, `requires_approval`
- `wallet_restrictions` - Active restrictions on wallets
- `wallet_policies` - Policy definitions

#### Approval System
- `approval_workflows` - Workflow definitions
- `approval_requests` - Individual approval requests
- `approval_actions` - Approval/rejection actions

#### Audit System
- `audit_ledger` - Append-only ledger for money movements
- `audit_events` - Policy changes, approvals, etc.

#### Webhooks & Usage
- `webhook_configurations` - Partner webhook settings
- `webhook_deliveries` - Delivery tracking
- `api_usage_logs` - API call logging
- `partner_rate_limits` - Rate limit configuration

### Database Functions

1. **Policy Engine Functions**
   - `check_wallet_restrictions()` - Validates restrictions
   - `get_required_approvals()` - Determines approval requirements
   - `evaluate_wallet_policy()` - Evaluates policy rules

2. **Ledger Functions**
   - `append_ledger_entry()` - Adds entry to audit ledger
   - `verify_ledger_integrity()` - Verifies ledger integrity
   - `get_ledger_history()` - Retrieves ledger history

3. **Rate Limiting**
   - `check_rate_limit()` - Checks and enforces rate limits

## 🔌 API Endpoints

All API endpoints are under `/api/v1/` and require authentication via API Key or Bearer Token.

### Partner Management
- `POST /api/v1/partners` - Create partner
- `GET /api/v1/partners/[id]` - Get partner details
- `POST /api/v1/partners/[id]/api-keys` - Generate API key
- `DELETE /api/v1/partners/[id]/api-keys/[keyId]` - Revoke API key
- `POST /api/v1/partners/[id]/users` - Create partner user
- `GET /api/v1/partners/[id]/users/[externalUserId]` - Get partner user

### Wallet Management
- `POST /api/v1/wallets` - Create wallet
- `GET /api/v1/wallets/[id]` - Get wallet details
- `GET /api/v1/wallets/[id]/balance` - Get wallet balance
- `POST /api/v1/wallets/[id]/restrictions` - Add restriction
- `DELETE /api/v1/wallets/[id]/restrictions/[restrictionId]` - Remove restriction

### Policy Management
- `POST /api/v1/policies` - Create policy
- `GET /api/v1/policies` - List policies
- `GET /api/v1/policies/[id]` - Get policy
- `PUT /api/v1/policies/[id]` - Update policy
- `DELETE /api/v1/policies/[id]` - Delete policy

### Disbursements
- `POST /api/v1/disbursements` - Request disbursement
- `GET /api/v1/disbursements/[id]` - Get disbursement status

### Approvals
- `GET /api/v1/approvals` - List approval requests
- `GET /api/v1/approvals/[id]` - Get approval request
- `POST /api/v1/approvals/[id]/approve` - Approve request
- `POST /api/v1/approvals/[id]/reject` - Reject request

### Approval Workflows
- `POST /api/v1/approval-workflows` - Create workflow
- `GET /api/v1/approval-workflows` - List workflows
- `GET /api/v1/approval-workflows/[id]` - Get workflow
- `PUT /api/v1/approval-workflows/[id]` - Update workflow

### Audit
- `GET /api/v1/audit/ledger` - Query audit ledger
- `GET /api/v1/audit/events` - Query audit events
- `GET /api/v1/audit/integrity` - Verify ledger integrity

### Webhooks
- `POST /api/v1/webhooks` - Configure webhook
- `GET /api/v1/webhooks` - List webhooks
- `GET /api/v1/webhooks/[id]` - Get webhook
- `PUT /api/v1/webhooks/[id]` - Update webhook
- `DELETE /api/v1/webhooks/[id]` - Delete webhook
- `POST /api/v1/webhooks/[id]/test` - Send test webhook

## 🧩 Core Components

### Authentication (`lib/api-auth.ts`)
- API key verification
- Bearer token authentication
- Partner and user context extraction

### Policy Engine (`lib/policy-engine/`)
- Rule evaluation engine
- Restriction checking
- Policy validation
- Evaluators for balance, limits, time, approvals

### Approval Engine (`lib/approval-engine/`)
- Approval request creation
- Workflow processing
- Auto-approval logic
- Expiration handling

### Rate Limiter (`lib/rate-limiter.ts`)
- Tier-based rate limiting
- Usage tracking
- Limit enforcement

### API Errors (`lib/api-errors.ts`)
- Standardized error responses
- Error code definitions
- Helper functions

## 🎨 Embedded Widgets

### Wallet Balance Widget
- **Location**: `widgets/wallet-balance/`
- **Purpose**: Display wallet balance in partner applications
- **Usage**: Embed via iframe or script tag

### Disbursement Request Widget
- **Location**: `widgets/disbursement-request/`
- **Purpose**: Allow users to request disbursements from partner apps
- **Usage**: Embed via iframe or script tag

### Widget Hosting
- **Route**: `/app/widgets/[widgetType]/route.ts`
- **Features**: CORS-enabled, configurable, secure

## 📦 TypeScript SDK

### Location
`packages/planmoni-sdk/`

### Features
- Type-safe API client
- Resource-based architecture
- Comprehensive error handling
- Full TypeScript support

### Resources
- `Wallets` - Wallet management
- `Disbursements` - Disbursement requests
- `Policies` - Policy management
- `Approvals` - Approval workflows
- `Audit` - Audit ledger queries
- `Partners` - Partner management

### Usage Example
```typescript
import { PlanmoniClient } from '@planmoni/sdk';

const client = new PlanmoniClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.planmoni.com'
});

// Create wallet
const wallet = await client.wallets.create({
  partner_id: 'partner-uuid',
  user_id: 'user-uuid'
});

// Request disbursement
const disbursement = await client.disbursements.create({
  wallet_id: wallet.id,
  amount: 5000,
  recipient_account_number: '1234567890',
  recipient_bank_code: '044'
});
```

## 🖥️ Partner Dashboard

### Location
`app/(partner)/`

### Features
- Dashboard overview
- Wallet management
- Policy configuration
- Approval monitoring
- Settings management
- Analytics and reporting

### Routes
- `/dashboard` - Overview
- `/wallets` - Wallet management
- `/policies` - Policy management
- `/approvals` - Approval requests
- `/settings` - Partner settings
- `/analytics` - Analytics dashboard

## 🗄️ Database Migrations

### Migration Files (9 total)

1. **20260126122920_create_partners_system.sql**
   - Creates partner management tables
   - Sets up API key infrastructure

2. **20260126122921_create_restricted_wallets.sql**
   - Extends wallets with restrictions
   - Creates wallet_policies table

3. **20260126122922_add_partner_context.sql**
   - Adds partner_id to existing tables
   - Maintains backward compatibility

4. **20260126122923_create_policy_engine_functions.sql**
   - Creates policy evaluation functions

5. **20260126122924_create_approval_workflows.sql**
   - Creates approval system tables

6. **20260126122925_create_audit_ledger.sql**
   - Creates immutable audit ledger

7. **20260126122926_create_ledger_functions.sql**
   - Creates ledger management functions

8. **20260126122927_create_webhook_deliveries.sql**
   - Creates webhook system tables

9. **20260126122928_create_usage_tracking.sql**
   - Creates usage tracking and rate limiting

### Applying Migrations

See `README_PAAS_MIGRATIONS.md` for detailed instructions.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Environment variables configured

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   # .env.local
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Apply Database Migrations**
   ```bash
   # See README_PAAS_MIGRATIONS.md
   ```

4. **Verify Installation**
   ```bash
   node scripts/verify-paas-migrations.js
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

### Creating Your First Partner

1. Use the Partner API to create a partner:
   ```bash
   curl -X POST https://your-api.com/api/v1/partners \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "name": "Test Partner",
       "slug": "test-partner",
       "partner_type": "healthcare"
     }'
   ```

2. Generate an API key:
   ```bash
   curl -X POST https://your-api.com/api/v1/partners/{partner_id}/api-keys \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. Use the API key to make requests:
   ```bash
   curl -X GET https://your-api.com/api/v1/wallets \
     -H "X-API-Key: YOUR_API_KEY"
   ```

## 📚 Documentation

### Core Documentation
- **Migration Guide**: `docs/PAAS_MIGRATIONS_GUIDE.md`
- **API Documentation**: `docs/api/README.md`
- **Backward Compatibility**: `docs/BACKWARD_COMPATIBILITY.md`
- **Widget Integration**: `docs/widgets/README.md`

### Integration Guides
- **Healthcare Platform**: `docs/integrations/healthcare-platform.md`
- **Payroll System**: `docs/integrations/payroll-system.md`
- **Education Platform**: `docs/integrations/education-platform.md`

### SDK Documentation
- **SDK README**: `packages/planmoni-sdk/README.md`
- **SDK Examples**: `packages/planmoni-sdk/examples/`

## 🔒 Security Features

- **API Key Authentication**: Secure API key generation and validation
- **Bearer Token Support**: OAuth2-style token authentication
- **Row-Level Security (RLS)**: Database-level access control
- **Rate Limiting**: Protection against abuse
- **Audit Trail**: Immutable record of all actions
- **Webhook Signatures**: Secure webhook delivery

## 🔄 Backward Compatibility

All existing B2C functionality is preserved:
- `partner_id` columns are nullable
- Existing endpoints continue to work
- B2C users unaffected by PaaS features
- No data migration required

See `docs/BACKWARD_COMPATIBILITY.md` for details.

## 📈 Features Summary

| Feature | Status | Location |
|---------|--------|----------|
| Partner Management | ✅ Complete | `app/api/v1/partners/` |
| Wallet Restrictions | ✅ Complete | `app/api/v1/wallets/` |
| Policy Engine | ✅ Complete | `lib/policy-engine/` |
| Approval Workflows | ✅ Complete | `app/api/v1/approvals/` |
| Audit Ledger | ✅ Complete | `app/api/v1/audit/` |
| Webhook System | ✅ Complete | `app/api/v1/webhooks/` |
| Rate Limiting | ✅ Complete | `lib/rate-limiter.ts` |
| Embedded Widgets | ✅ Complete | `widgets/` |
| TypeScript SDK | ✅ Complete | `packages/planmoni-sdk/` |
| Partner Dashboard | ✅ Complete | `app/(partner)/` |

## 🧪 Testing

### Verification Scripts
- `scripts/verify-paas-migrations.js` - Verify migrations applied
- `scripts/check-and-apply-remaining.js` - Check migration status

### Example Usage
```bash
# Verify all migrations
node scripts/verify-paas-migrations.js

# Check what's remaining
node scripts/check-and-apply-remaining.js
```

## 🐛 Troubleshooting

### Common Issues

1. **Migration Errors**
   - Check `docs/PAAS_MIGRATIONS_GUIDE.md`
   - Verify environment variables
   - Check Supabase dashboard logs

2. **API Authentication Errors**
   - Verify API key format
   - Check API key is active
   - Ensure proper headers (`X-API-Key` or `Authorization`)

3. **Policy Evaluation Errors**
   - Check policy rules format
   - Verify wallet restrictions
   - Review policy engine logs

## 📝 Next Steps

1. **Apply Migrations**: Follow `README_PAAS_MIGRATIONS.md`
2. **Configure Webhooks**: Set up webhook endpoints
3. **Create Test Partner**: Use API to create first partner
4. **Test Integration**: Use SDK or API directly
5. **Deploy**: Deploy to production environment

## 🤝 Contributing

When adding new features:
1. Create database migration if needed
2. Add API endpoints under `/api/v1/`
3. Update SDK if applicable
4. Add documentation
5. Update this README

## 📄 License

[Your License Here]

## 🆘 Support

For issues or questions:
- Check documentation in `docs/`
- Review API documentation
- Check migration guides
- Review code examples in SDK

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Status**: ✅ Production Ready
