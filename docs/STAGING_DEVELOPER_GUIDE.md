# Staging Environment - Developer Guide

## 👋 Welcome to Staging!

This guide will help you get started with the staging environment for testing and development.

---

## 🚀 Quick Start

### 1. Get Access

Ask your team lead for:
- Staging Supabase project access
- `.env.staging` file (via secure channel)
- Team password manager access

### 2. Set Up Local Environment

```bash
# Clone the repository (if not already)
git clone <repository-url>
cd app

# Install dependencies
npm install

# Copy staging environment file
# (Get from team lead via secure channel)
cp .env.staging .env.local

# Link to staging Supabase project
supabase link --project-ref your-staging-project-ref
```

### 3. Start Development

```bash
# Start with staging environment
npm run start:staging

# Or manually load staging env
export $(cat .env.staging | xargs)
npm start
```

---

## 🔧 Daily Workflow

### Working with Staging Database

```bash
# View database in Supabase Dashboard
# https://app.supabase.com/project/your-staging-project

# Or use CLI
supabase db remote

# Run migrations
supabase db push

# Check migrations status
supabase migration list
```

### Testing Edge Functions

```bash
# Deploy function to staging
supabase functions deploy function-name --project-ref staging-ref

# Test function locally (with staging env)
supabase functions serve function-name --env-file .env.staging

# View function logs
# Go to Supabase Dashboard → Functions → function-name → Logs
```

### Testing API Changes

1. Make your changes
2. Deploy to staging:
   ```bash
   npm run deploy:staging:functions
   ```
3. Test in staging app or via API calls
4. Check logs for errors

---

## 🧪 Testing Guidelines

### What to Test in Staging

✅ **DO Test:**
- New features
- Bug fixes
- API integrations
- Database migrations
- Edge functions
- Payment flows (with test keys)
- User flows
- Error handling

❌ **DON'T Test:**
- Production data (never import!)
- Real payment transactions
- Production API keys
- Critical production features without backup

### Test Data

Use test data only:
- Test user accounts
- Test payment methods
- Test API keys
- Mock external services when possible

---

## 🔐 Security Best Practices

### Environment Variables

- ✅ **DO**: Use `.env.staging` for staging
- ✅ **DO**: Keep `.env.staging` in `.gitignore`
- ✅ **DO**: Share credentials via secure channels
- ❌ **DON'T**: Commit `.env` files to git
- ❌ **DON'T**: Share credentials in Slack/email
- ❌ **DON'T**: Use production keys in staging

### API Keys

- Use **test keys** for staging:
  - Paystack: `pk_test_...` and `sk_test_...`
  - Mono: Test credentials
  - SafeHaven: Staging credentials (if available)

---

## 📝 Common Tasks

### Deploying Changes

```bash
# Deploy database changes
npm run deploy:staging:db

# Deploy functions
npm run deploy:staging:functions

# Deploy everything
npm run deploy:staging:all
```

### Viewing Logs

```bash
# View function logs
# Supabase Dashboard → Functions → [function-name] → Logs

# Or use CLI (if available)
supabase functions logs function-name --project-ref staging-ref
```

### Resetting Staging

```bash
# ⚠️ WARNING: This will delete all data!
# Only do this if staging is corrupted

# Reset database (applies all migrations fresh)
supabase db reset --project-ref staging-ref
```

---

## 🐛 Debugging

### Common Issues

**1. Connection Errors**
```bash
# Check environment variables
cat .env.staging | grep SUPABASE

# Verify Supabase project is active
# Go to Supabase Dashboard
```

**2. Function Errors**
```bash
# Check function logs
# Supabase Dashboard → Functions → [function-name] → Logs

# Test function locally
supabase functions serve function-name --env-file .env.staging
```

**3. Migration Errors**
```bash
# Check migration status
supabase migration list

# View migration history
supabase db remote --execute "SELECT * FROM supabase_migrations.schema_migrations;"
```

### Getting Help

1. Check function logs in Supabase Dashboard
2. Review [Troubleshooting Guide](./STAGING_TROUBLESHOOTING.md)
3. Ask in team Slack/Discord
4. Check Supabase documentation

---

## 📊 Monitoring

### What to Monitor

- **Function Logs**: Check for errors
- **Database Logs**: Monitor queries
- **API Logs**: Track requests
- **Error Rates**: Watch for spikes

### Where to Monitor

- **Supabase Dashboard**: Logs section
- **Function Logs**: Each function's logs tab
- **Database Logs**: Database → Logs

---

## 🔄 Syncing with Production

### Schema Sync

Staging schema should match production:

```bash
# Export production schema (admin only)
supabase db dump --project-ref production-ref -f production-schema.sql

# Review changes carefully
# Apply to staging
supabase db push --project-ref staging-ref
```

### Data Sync

**⚠️ NEVER sync production data to staging!**

Use test data only.

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests pass in staging
- [ ] Edge functions work correctly
- [ ] Database migrations tested
- [ ] No errors in logs
- [ ] Payment flows tested (with test keys)
- [ ] User flows tested
- [ ] Error handling tested
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Code reviewed

---

## 📚 Resources

- [Staging Setup Guide](./STAGING_ENVIRONMENT_SETUP.md)
- [Deployment Guide](./STAGING_DEPLOYMENT.md)
- [Troubleshooting Guide](./STAGING_TROUBLESHOOTING.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Team Wiki/Slack] (add your team resources)

---

## 🆘 Emergency Contacts

- **Team Lead**: [name/contact]
- **DevOps**: [name/contact]
- **Supabase Admin**: [name/contact]

---

## 💡 Tips

1. **Always test in staging first** before production
2. **Use test data** - never production data
3. **Check logs regularly** for errors
4. **Keep staging in sync** with production schema
5. **Document issues** you find for the team

---

Happy Testing! 🚀
