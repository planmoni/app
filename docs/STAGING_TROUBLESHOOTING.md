# Staging Environment - Troubleshooting Guide

## 🔍 Common Issues and Solutions

---

## ❌ Connection Issues

### Problem: Cannot connect to Supabase

**Symptoms:**
- `Supabase configuration not found` error
- Connection timeout
- Authentication errors

**Solutions:**

1. **Check environment variables:**
   ```bash
   cat .env.staging | grep SUPABASE
   ```

2. **Verify Supabase project is active:**
   - Go to Supabase Dashboard
   - Check project status
   - Ensure project hasn't been paused

3. **Check network connection:**
   ```bash
   curl https://your-staging-project.supabase.co
   ```

4. **Verify credentials:**
   - Check `EXPO_PUBLIC_SUPABASE_URL` is correct
   - Check `EXPO_PUBLIC_SUPABASE_ANON_KEY` is correct
   - Ensure no extra spaces or quotes

---

## ❌ Migration Errors

### Problem: Database migrations fail

**Symptoms:**
- `Migration failed` error
- `Table already exists` error
- `Permission denied` error

**Solutions:**

1. **Check migration status:**
   ```bash
   supabase migration list --project-ref staging-ref
   ```

2. **Reset migrations (⚠️ WARNING: Deletes data):**
   ```bash
   supabase db reset --project-ref staging-ref
   ```

3. **Apply migrations one by one:**
   ```bash
   # Find failing migration
   supabase db push --project-ref staging-ref
   
   # Fix the migration file
   # Then retry
   ```

4. **Check database permissions:**
   - Ensure service role key has proper permissions
   - Check RLS policies

---

## ❌ Function Deployment Errors

### Problem: Edge functions fail to deploy

**Symptoms:**
- `Function deployment failed`
- `Secret not found` error
- `Timeout` error

**Solutions:**

1. **Check function syntax:**
   ```bash
   # Test function locally
   supabase functions serve function-name --env-file .env.staging
   ```

2. **Verify secrets are set:**
   ```bash
   # Check secrets in Supabase Dashboard
   # Settings → Edge Functions → Secrets
   ```

3. **Set secrets manually:**
   ```bash
   supabase secrets set \
     KEY=value \
     --project-ref staging-ref
   ```

4. **Check function logs:**
   - Go to Supabase Dashboard → Functions → [function-name] → Logs
   - Look for error messages

---

## ❌ Environment Variable Issues

### Problem: Environment variables not loading

**Symptoms:**
- `process.env.VAR is undefined`
- Wrong values being used
- Variables not available in functions

**Solutions:**

1. **Check .env.staging file:**
   ```bash
   # Ensure file exists
   ls -la .env.staging
   
   # Check format (no spaces around =)
   cat .env.staging
   ```

2. **Load environment manually:**
   ```bash
   export $(cat .env.staging | grep -v '^#' | xargs)
   ```

3. **For Edge Functions:**
   - Set secrets in Supabase Dashboard
   - Use `supabase secrets set` command
   - Secrets are available as `Deno.env.get('KEY')`

4. **For Expo app:**
   - Ensure variables start with `EXPO_PUBLIC_`
   - Restart Expo dev server after changes
   - Clear cache: `expo start --clear`

---

## ❌ Database Connection Errors

### Problem: Cannot connect to database

**Symptoms:**
- `Connection refused`
- `Authentication failed`
- `Database not found`

**Solutions:**

1. **Check database password:**
   ```bash
   # Verify password in Supabase Dashboard
   # Settings → Database → Connection string
   ```

2. **Check connection string:**
   ```bash
   supabase db remote --project-ref staging-ref
   ```

3. **Verify database is running:**
   - Go to Supabase Dashboard
   - Check database status
   - Ensure not paused

4. **Check IP restrictions:**
   - Go to Settings → Database
   - Check if IP restrictions are enabled
   - Add your IP if needed

---

## ❌ Function Execution Errors

### Problem: Functions fail at runtime

**Symptoms:**
- `Function error` in logs
- `Timeout` errors
- `Memory limit exceeded`

**Solutions:**

1. **Check function logs:**
   ```bash
   # In Supabase Dashboard
   # Functions → [function-name] → Logs
   ```

2. **Test function locally:**
   ```bash
   supabase functions serve function-name --env-file .env.staging
   ```

3. **Check function timeout:**
   - Default timeout is 60 seconds
   - Optimize function if taking too long
   - Consider breaking into smaller functions

4. **Check memory usage:**
   - Default memory is 128MB
   - Optimize code if using too much memory
   - Check for memory leaks

---

## ❌ Webhook Issues

### Problem: Webhooks not receiving events

**Symptoms:**
- No webhook calls in logs
- `404 Not Found` errors
- `Signature verification failed`

**Solutions:**

1. **Verify webhook URL:**
   ```
   https://your-staging-project.supabase.co/functions/v1/webhook-name
   ```

2. **Check webhook secret:**
   ```bash
   # Verify secret matches in:
   # - .env.staging
   # - Supabase function secrets
   # - External service (Paystack, SafeHaven, etc.)
   ```

3. **Test webhook manually:**
   ```bash
   curl -X POST https://your-staging-project.supabase.co/functions/v1/webhook-name \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

4. **Check webhook configuration:**
   - Verify URL in external service dashboard
   - Check events are enabled
   - Verify webhook is active

---

## ❌ Build Errors

### Problem: App build fails for staging

**Symptoms:**
- `Build failed` error
- `Environment variable not found`
- `Configuration error`

**Solutions:**

1. **Check app.config.js:**
   ```javascript
   // Ensure staging environment is handled
   const ENV = process.env.ENVIRONMENT || 'development';
   ```

2. **Load staging environment:**
   ```bash
   export $(cat .env.staging | grep -v '^#' | xargs)
   npm run build
   ```

3. **Check EAS build configuration:**
   ```bash
   # Check eas.json for staging profile
   cat eas.json
   ```

4. **Verify environment variables:**
   - Ensure all required variables are in `.env.staging`
   - Check variable names match `app.config.js`

---

## 🔧 Debugging Tips

### 1. Enable Verbose Logging

```bash
# For Supabase CLI
export SUPABASE_DEBUG=1
supabase db push --project-ref staging-ref

# For Expo
expo start --dev-client --verbose
```

### 2. Check Logs

**Supabase Dashboard:**
- Functions → [function-name] → Logs
- Database → Logs
- API → Logs

**Local:**
```bash
# Function logs
supabase functions logs function-name --project-ref staging-ref

# Database logs (if available)
supabase db logs --project-ref staging-ref
```

### 3. Test Components Individually

```bash
# Test database connection
supabase db remote --project-ref staging-ref

# Test function locally
supabase functions serve function-name --env-file .env.staging

# Test API endpoint
curl https://your-staging-project.supabase.co/functions/v1/function-name
```

---

## 📞 Getting Help

### 1. Check Documentation
- [Staging Setup Guide](./STAGING_ENVIRONMENT_SETUP.md)
- [Developer Guide](./STAGING_DEVELOPER_GUIDE.md)
- [Supabase Docs](https://supabase.com/docs)

### 2. Check Logs
- Supabase Dashboard → Logs
- Function logs
- Database logs

### 3. Ask Team
- Team Slack/Discord
- Team lead
- DevOps team

### 4. Supabase Support
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
- [Supabase Support](https://supabase.com/support)

---

## ✅ Prevention Checklist

To avoid common issues:

- [ ] Always test in staging before production
- [ ] Keep `.env.staging` up to date
- [ ] Regularly sync schema from production
- [ ] Monitor logs regularly
- [ ] Use test API keys only
- [ ] Never use production data
- [ ] Document any custom configurations
- [ ] Keep team informed of changes

---

## 🚨 Emergency Procedures

### Staging is Down

1. **Check Supabase status:**
   - [Supabase Status Page](https://status.supabase.com)
   - Check project in dashboard

2. **Check project limits:**
   - Free tier has limits
   - Check usage in dashboard

3. **Restore from backup:**
   ```bash
   # If available
   supabase db restore --project-ref staging-ref
   ```

### Data Corruption

1. **Reset staging:**
   ```bash
   # ⚠️ WARNING: Deletes all data
   supabase db reset --project-ref staging-ref
   ```

2. **Re-apply migrations:**
   ```bash
   supabase db push --project-ref staging-ref
   ```

3. **Re-seed test data:**
   ```bash
   # Use your test data script
   npm run seed:staging
   ```

---

## 📝 Reporting Issues

When reporting issues, include:

1. **Error message** (full text)
2. **Steps to reproduce**
3. **Environment:**
   - OS
   - Node version
   - Supabase CLI version
4. **Logs:**
   - Function logs
   - Database logs
   - Console output
5. **Configuration:**
   - `.env.staging` (sanitized)
   - `app.config.js` (relevant parts)

---

Happy Debugging! 🐛
