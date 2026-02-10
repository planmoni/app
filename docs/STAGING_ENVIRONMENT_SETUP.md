# Staging Environment Setup Guide

## 🎯 Overview

This guide will help you set up a **staging environment** for testing and development. The staging environment is a separate Supabase project that mirrors production but is safe for testing.

---

## 📋 Prerequisites

- Supabase account (free tier works)
- Supabase CLI installed: `npm install -g supabase`
- Access to your team's Supabase organization
- Node.js and npm installed

---

## 🚀 Step 1: Create Staging Supabase Project

### 1.1 Create New Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `planmoni-staging` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose closest to your team
   - **Pricing Plan**: Free tier is fine for staging

### 1.2 Get Project Credentials

After project creation:

1. Go to **Settings** → **API**
2. Copy these values (you'll need them):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`
   - **service_role key**: `eyJhbGc...` (⚠️ Keep this secret!)

3. Go to **Settings** → **Database**
   - Copy **Connection string** (for migrations)

---

## 🔧 Step 2: Set Up Environment Variables

### 2.1 Create Staging Environment File

Create `.env.staging` in your project root:

```bash
# Copy from .env.example and update with staging values
cp .env.example .env.staging
```

### 2.2 Configure Staging Variables

Edit `.env.staging` with your staging Supabase credentials:

```env
# ============================================
# STAGING ENVIRONMENT CONFIGURATION
# ============================================

# Supabase Staging Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key-here

# Paystack Staging/Test Keys (use test keys for staging)
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
PAYSTACK_LIVE_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# SafeHaven Staging (if available, otherwise use test credentials)
EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID=your-staging-client-id
EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION=your-staging-assertion

# Mono Staging
EXPO_PUBLIC_MONO_PUBLIC_KEY=test_pk_xxxxxxxxxxxxx
MONO_SECRET_KEY=test_sk_xxxxxxxxxxxxx

# Dojah KYC Staging
EXPO_PUBLIC_DOJAH_APP_ID=your-staging-dojah-app-id
DOJAH_PRIVATE_KEY=your-staging-dojah-private-key

# API URLs
EXPO_PUBLIC_API_URL=https://api-staging.planmoni.com
EXPO_PUBLIC_APP_URL=https://staging.planmoni.com

# Webhook Secrets (Staging)
PAYSTACK_WEBHOOK_SECRET=whsec_staging_xxxxxxxxxxxxx
SAFEHAVEN_WEBHOOK_SECRET=your-staging-webhook-secret

# Email Service (Staging)
RESEND_API_KEY=re_staging_xxxxxxxxxxxxx

# OpenAI (Staging - optional)
OPENAI_API_KEY=sk-staging-xxxxxxxxxxxxx

# Environment Identifier
ENVIRONMENT=staging
```

### 2.3 Add to .gitignore

Ensure `.env.staging` is in `.gitignore` (it should be):

```gitignore
# Environment files
.env
.env.local
.env.staging
.env.production
```

---

## 🗄️ Step 3: Set Up Staging Database

### 3.1 Link Supabase Project

```bash
# Link to staging project
supabase link --project-ref your-staging-project-ref

# You'll be prompted for:
# - Database password (the one you set during project creation)
```

### 3.2 Apply Migrations

```bash
# Apply all migrations to staging
supabase db push

# Or use the staging script
npm run deploy:staging:db
```

### 3.3 Verify Database Setup

```bash
# Check connection
supabase db remote

# List tables
supabase db remote --list
```

---

## 🚀 Step 4: Deploy Edge Functions to Staging

### 4.1 Deploy All Functions

```bash
# Deploy all functions to staging
npm run deploy:staging:functions

# Or deploy individually
supabase functions deploy process_due_payouts --project-ref your-staging-project-ref
supabase functions deploy process-automated-payouts --project-ref your-staging-project-ref
# ... etc
```

### 4.2 Set Function Secrets

For each function that needs secrets:

```bash
# Set secrets for a function
supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_test_xxxxx \
  SAFEHAVEN_CLIENT_ID=xxxxx \
  --project-ref your-staging-project-ref

# Or use the staging script
npm run deploy:staging:secrets
```

---

## 📱 Step 5: Configure App for Staging

### 5.1 Create Staging Build Profile

Update `app.config.js` to support staging:

```javascript
// app.config.js
const ENV = process.env.ENVIRONMENT || 'development';

const config = {
  expo: {
    name: ENV === 'staging' ? 'Planmoni (Staging)' : 'Planmoni',
    // ... rest of config
    extra: {
      environment: ENV,
      // ... environment variables
    }
  }
};

module.exports = config;
```

### 5.2 Build Staging App

```bash
# Load staging environment
export $(cat .env.staging | xargs)

# Start with staging config
npm run start:staging

# Or build staging app
eas build --profile staging --platform ios
eas build --profile staging --platform android
```

---

## 🔐 Step 6: Set Up Webhooks (Staging)

### 6.1 Paystack Webhook

1. Go to Paystack Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-staging-project.supabase.co/functions/v1/paystack-webhook`
3. Use staging webhook secret
4. Test events: `charge.success`, `transfer.success`

### 6.2 SafeHaven Webhook

1. Configure in SafeHaven dashboard (if available)
2. Webhook URL: `https://your-staging-project.supabase.co/functions/v1/safehaven-webhook`
3. Use staging webhook secret

---

## 🧪 Step 7: Test Staging Environment

### 7.1 Verify Connection

```bash
# Test Supabase connection
npm run test:staging:connection
```

### 7.2 Test Edge Functions

```bash
# Test a function
curl -X POST https://your-staging-project.supabase.co/functions/v1/process_due_payouts \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json"
```

### 7.3 Test Database

```bash
# Run test queries
supabase db remote --execute "SELECT COUNT(*) FROM payout_plans;"
```

---

## 👥 Step 8: Share with Team

### 8.1 Create Team Access

1. Go to Supabase Dashboard → Settings → Team
2. Invite team members
3. Set appropriate permissions (Developer role is fine for staging)

### 8.2 Share Credentials Securely

**⚠️ NEVER commit credentials to git!**

Use a secure password manager or team secret sharing tool:

- **1Password** (recommended)
- **LastPass**
- **Bitwarden**
- **Google Secret Manager**

Share:
- `.env.staging` file (via secure channel)
- Supabase project password
- API keys and secrets

### 8.3 Create Developer Onboarding Doc

Create `docs/STAGING_DEVELOPER_GUIDE.md` (see below)

---

## 📊 Step 9: Set Up Monitoring

### 9.1 Supabase Logs

Monitor staging in Supabase Dashboard:
- **Logs** → **API Logs**
- **Logs** → **Database Logs**
- **Logs** → **Function Logs**

### 9.2 Error Tracking

Set up error tracking for staging:
- **Sentry** (if using)
- **LogRocket**
- **Supabase Logs**

---

## 🔄 Step 10: Sync with Production

### 10.1 Regular Sync Schedule

Sync staging database structure from production:

```bash
# Export production schema
supabase db dump --project-ref production-ref -f production-schema.sql

# Apply to staging (carefully!)
supabase db push --project-ref staging-ref
```

### 10.2 Test Data

Use test data, not production data:
- Create test users
- Use test payment methods
- Use test API keys

---

## ✅ Checklist

- [ ] Staging Supabase project created
- [ ] Environment variables configured (`.env.staging`)
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Function secrets configured
- [ ] Webhooks configured
- [ ] Team members invited
- [ ] Credentials shared securely
- [ ] Staging app builds working
- [ ] Monitoring set up
- [ ] Documentation created

---

## 🚨 Important Notes

1. **Never use production data in staging**
2. **Use test API keys for staging**
3. **Keep staging credentials secure**
4. **Regularly sync schema from production**
5. **Test all features in staging before production**

---

## 📚 Next Steps

- Read [STAGING_DEVELOPER_GUIDE.md](./STAGING_DEVELOPER_GUIDE.md)
- Review [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md)
- Check [STAGING_TROUBLESHOOTING.md](./STAGING_TROUBLESHOOTING.md)

---

## 🆘 Support

If you encounter issues:
1. Check [Troubleshooting Guide](./STAGING_TROUBLESHOOTING.md)
2. Ask in team Slack/Discord
3. Check Supabase documentation
4. Review function logs in Supabase Dashboard
