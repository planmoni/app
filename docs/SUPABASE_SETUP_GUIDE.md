# Supabase Configuration Guide

## Overview
This guide will help you set up Supabase configuration to resolve the connection and realtime subscription errors you're experiencing.

## Current Issues
Based on the logs, you're experiencing:
1. **CHANNEL_ERROR** issues with Events and Wallet subscriptions
2. **Signed URL creation errors** for banner images
3. **Supabase configuration not found** warnings

## Setup Steps

### 1. Create Environment Variables
Create a `.env` file in your project root with the following variables:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Other API Keys (if needed)
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_public_key_here
EXPO_PUBLIC_PAYSTACK_SECRET_KEY=your_paystack_secret_key_here
EXPO_PUBLIC_MONO_PUBLIC_KEY=your_mono_public_key_here
EXPO_PUBLIC_MONO_SECRET_KEY=your_mono_secret_key_here
```

### 2. Get Your Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 3. Update App Configuration
The app configuration is already set up in `app.config.js` to read from environment variables. Make sure your `.env` file is in the project root.

### 4. Restart Development Server
After adding the environment variables:
```bash
# Stop the current server (Ctrl+C)
# Then restart
npx expo start --clear
```

## Verification
Once configured, you should see:
- ✅ `Supabase client initialized successfully with SecureStore adapter`
- No more `Supabase configuration not found` warnings
- Reduced CHANNEL_ERROR messages
- Successful realtime subscriptions

## Troubleshooting

### If you still see CHANNEL_ERROR:
1. Check your Supabase project is active
2. Verify your internet connection
3. Check if realtime is enabled in your Supabase project
4. Ensure your database tables exist (`wallets`, `events`, `banners`)

### If you see image URL errors:
1. Check if your `banners` bucket exists in Supabase Storage
2. Verify the bucket is public or has proper RLS policies
3. Ensure banner images exist in the storage bucket

## Database Tables Required
Make sure these tables exist in your Supabase database:
- `wallets` (for wallet balance updates)
- `events` (for notifications)
- `banners` (for image carousel)

## Storage Buckets Required
Make sure these storage buckets exist:
- `banners` (for banner images)

## Next Steps
After configuration:
1. Test the app functionality
2. Check that realtime updates work
3. Verify image loading works properly
4. Monitor logs for any remaining issues

## Support
If you continue to experience issues after following this guide, check:
1. Supabase project status
2. Network connectivity
3. API key permissions
4. Database and storage setup
