# Paystack Integration Guide

This guide explains how to set up and use the Paystack integration for virtual accounts and automatic balance updates.

## Overview

The Paystack integration allows users to:
1. Create virtual bank accounts for receiving funds
2. Automatically update wallet balance when money is sent to virtual accounts
3. Track transaction status in real-time
4. Receive notifications when funds are received

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Paystack API Keys
EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Secret (for production)
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Database Migration

Run the database migration to create the `paystack_accounts` table:

```bash
npx supabase db push
```

This creates the following table structure:

```sql
CREATE TABLE paystack_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  customer_code text NOT NULL,
  account_number text,
  account_name text,
  bank_name text,
  accountId text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 3. Webhook Configuration

#### For Development (ngrok)

1. Install ngrok: `npm install -g ngrok`
2. Start your development server: `npm run dev`
3. In another terminal, run: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Configure the webhook URL in Paystack dashboard: `https://abc123.ngrok.io/api/paystack-webhook`

#### For Production

1. Deploy your app to a hosting service (Vercel, Netlify, etc.)
2. Configure the webhook URL in Paystack dashboard: `https://yourdomain.com/api/paystack-webhook`

### 4. Paystack Dashboard Configuration

1. Log in to your Paystack dashboard
2. Go to Settings > Webhooks
3. Add a new webhook with the following events:
   - `charge.success` - When payment is successful
   - `dedicated_account.assigned` - When virtual account is assigned
   - `transfer.success` - When transfer is successful (optional)

## How It Works

### 1. Virtual Account Creation

When a user creates a virtual account:

1. **Create Customer**: A Paystack customer is created with user details
2. **Create Dedicated Account**: A virtual account is created for the customer
3. **Store in Database**: Account details are stored in `paystack_accounts` table
4. **Real-time Updates**: The UI updates in real-time when account status changes

### 2. Payment Processing

When someone sends money to the virtual account:

1. **Webhook Received**: Paystack sends a webhook to `/api/paystack-webhook`
2. **Signature Verification**: The webhook signature is verified for security
3. **Find User**: The system finds the user by virtual account number
4. **Update Balance**: The user's wallet balance is automatically updated
5. **Create Transaction**: A transaction record is created
6. **Send Notification**: The user receives a notification

### 3. Real-time Updates

The system uses Supabase real-time subscriptions to:
- Update account status when virtual account becomes active
- Refresh wallet balance when funds are received
- Show transaction history in real-time

## API Endpoints

### POST /api/paystack-webhook

Handles incoming webhooks from Paystack.

**Headers:**
- `x-paystack-signature`: HMAC-SHA512 signature for verification

**Supported Events:**
- `charge.success`: Payment received
- `dedicated_account.assigned`: Virtual account assigned
- `transfer.success`: Transfer completed

## Testing

### 1. Test Webhook Locally

Run the test script to verify webhook functionality:

```bash
node scripts/test-webhook.js
```

### 2. Test Virtual Account Creation

1. Open the app and go to "Add Funds"
2. Select "Bank Transfer" tab
3. Choose a bank and create a virtual account
4. Check the database to verify account creation

### 3. Test Payment Flow

1. Use the virtual account number to send money (test mode)
2. Check that the webhook is received
3. Verify that the wallet balance is updated
4. Check that a transaction record is created

## Troubleshooting

### Common Issues

1. **Webhook not received**
   - Check ngrok URL is accessible
   - Verify webhook URL in Paystack dashboard
   - Check server logs for errors

2. **Invalid signature error**
   - Verify `PAYSTACK_WEBHOOK_SECRET` is correct
   - Check that the secret matches Paystack dashboard

3. **Account not found**
   - Verify virtual account number exists in database
   - Check that user_id matches the account

4. **Balance not updated**
   - Check webhook payload structure
   - Verify `add_funds` function is working
   - Check database constraints

### Debug Logs

Enable debug logging by checking the console for:
- Webhook payload structure
- Database operation results
- Real-time subscription status

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Environment Variables**: Never commit API keys to version control
3. **Database Security**: Use Row Level Security (RLS) policies
4. **Input Validation**: Validate all webhook data before processing

## Production Checklist

- [ ] Set up production Paystack account
- [ ] Configure production webhook URL
- [ ] Set up monitoring and logging
- [ ] Test with real transactions
- [ ] Set up error handling and alerts
- [ ] Configure backup and recovery procedures

## Support

For issues related to:
- **Paystack API**: Contact Paystack support
- **Database**: Check Supabase documentation
- **App Integration**: Check this documentation or create an issue

## Example Usage

```typescript
// Create virtual account
const createAccount = async () => {
  const response = await fetch('/api/paystack/create-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+2341234567890'
    })
  });
  
  const result = await response.json();
  console.log('Account created:', result);
};

// Check account status
const { account } = useRealtimePaystackAccount();
console.log('Account status:', account?.is_active);
``` 