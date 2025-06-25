# Balance Update System Guide

This guide explains how the balance update system works when money is sent to your Paystack virtual account and how to test it.

## 🎯 How It Works

### 1. **Real-time Balance Updates**
The app uses Supabase real-time subscriptions to automatically update the balance when:
- Money is sent to your virtual account
- Webhooks are received from Paystack
- Database changes occur

### 2. **Webhook Processing**
When someone sends money to your virtual account:
1. Paystack sends a webhook to `/api/paystack-webhook`
2. The webhook handler verifies the signature
3. It updates the user's wallet balance in Supabase
4. The real-time subscription automatically updates the UI

### 3. **UI Updates**
The home screen (`app/(tabs)/index.tsx`) automatically reflects balance changes through:
- `useBalance()` hook from `BalanceContext`
- Real-time wallet subscription
- Pull-to-refresh functionality
- Manual refresh button

## 🔧 Components Involved

### 1. **Webhook Handler** (`app/api/paystack-webhook+api.ts`)
- Processes incoming Paystack webhooks
- Verifies webhook signatures
- Updates wallet balance in database
- Creates transaction records

### 2. **Balance Context** (`contexts/BalanceContext.tsx`)
- Provides balance state to the entire app
- Uses `useRealtimeWallet` hook for real-time updates
- Handles balance visibility toggle

### 3. **Real-time Wallet Hook** (`hooks/useRealtimeWallet.ts`)
- Sets up Supabase real-time subscription
- Automatically updates balance when database changes
- Provides wallet management functions

### 4. **Home Screen** (`app/(tabs)/index.tsx`)
- Displays current balance
- Shows real-time updates
- Provides refresh functionality
- Pull-to-refresh support

## 🧪 Testing the System

### Method 1: Using the Test Script
```bash
# Update the test script with your details
cd scripts
node test-paystack-webhook.js
```

**Before running, update these values in the script:**
- `USER_EMAIL`: Your actual user email
- `VIRTUAL_ACCOUNT_NUMBER`: Your actual virtual account number
- `WEBHOOK_URL`: Your webhook endpoint URL

### Method 2: Manual Testing
1. **Create a virtual account** in the app
2. **Send money** to the virtual account number
3. **Check the balance** - it should update automatically
4. **Pull to refresh** - should show the latest balance

### Method 3: Using Paystack Dashboard
1. Go to your Paystack dashboard
2. Navigate to Virtual Accounts
3. Send a test payment to your virtual account
4. Check if the webhook is triggered and balance updates

## 🔍 Debugging

### Check Webhook Logs
```bash
# Check if webhooks are being received
tail -f logs/webhook.log
```

### Check Real-time Subscription
The app logs real-time subscription status:
```javascript
console.log('Wallet subscription status:', status);
console.log('Wallet change received:', payload);
```

### Check Balance Context
The balance context logs balance changes:
```javascript
console.log('BalanceContext - Current wallet state:');
console.log('- Balance:', wallet.balance);
console.log('- Locked Balance:', wallet.lockedBalance);
console.log('- Available Balance:', wallet.availableBalance);
```

## 🚨 Common Issues

### 1. **Balance Not Updating**
- Check if webhook is being received
- Verify webhook signature
- Check database connection
- Ensure real-time subscription is active

### 2. **Webhook Not Working**
- Verify webhook URL is accessible
- Check webhook secret configuration
- Ensure Paystack webhook is configured correctly
- Check server logs for errors

### 3. **Real-time Updates Not Working**
- Check Supabase connection
- Verify user authentication
- Check real-time subscription status
- Ensure database policies allow access

## 📊 Expected Behavior

### When Money is Sent to Virtual Account:
1. ✅ Webhook received from Paystack
2. ✅ Balance updated in database
3. ✅ Real-time subscription triggers
4. ✅ UI updates automatically
5. ✅ Transaction record created
6. ✅ User sees updated balance

### Manual Refresh:
1. ✅ Pull-to-refresh triggers
2. ✅ Balance fetched from database
3. ✅ UI updates with latest balance
4. ✅ Haptic feedback provided

## 🔐 Security Considerations

### Webhook Security
- Webhook signatures are verified
- Only authorized Paystack requests are processed
- Database operations are protected by RLS policies

### Data Protection
- User data is protected by authentication
- Balance changes are logged for audit
- Sensitive information is not exposed in logs

## 📈 Monitoring

### Key Metrics to Monitor
- Webhook success rate
- Balance update frequency
- Real-time subscription status
- User refresh actions
- Transaction creation success rate

### Logs to Watch
- Webhook processing logs
- Real-time subscription logs
- Balance update logs
- Error logs

## 🎉 Success Indicators

You'll know the system is working when:
- ✅ Balance updates automatically when money is sent
- ✅ Pull-to-refresh works smoothly
- ✅ Manual refresh button updates balance
- ✅ No errors in console logs
- ✅ Webhook responses are successful
- ✅ Real-time subscription is active

## 🆘 Troubleshooting

If something isn't working:

1. **Check the logs** for error messages
2. **Verify webhook configuration** in Paystack
3. **Test webhook endpoint** manually
4. **Check database connection** and policies
5. **Verify real-time subscription** status
6. **Test with the provided test script**

## 📞 Support

If you need help:
1. Check this guide first
2. Review the logs for errors
3. Test with the provided scripts
4. Check Paystack documentation
5. Contact support with specific error messages 