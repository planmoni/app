# Card Payment Integration with Paystack (Direct API)

This document describes the card payment integration with Paystack using **direct API calls** for processing debit and credit card payments in the Planmoni app.

## ⚠️ **Important: PCI Compliance Requirement**

**Direct Card API**: Paystack's direct card API requires **PCI-DSS compliance certification**, which is a complex and expensive process that most businesses don't have.

**Solution**: We use **Paystack Checkout** with direct API calls, which:
- ✅ **No PCI compliance needed**
- ✅ **Secure and compliant**
- ✅ **Easy to implement**
- ✅ **Handled by Paystack**

## Overview

The card payment integration allows users to:
- Add debit/credit cards to their account through Paystack Checkout
- Save cards for future payments
- Process payments using saved cards
- Handle payment verification securely

## Paystack Card Payment Flow (Direct API)

### 1. Payment Initialization Process

When a user adds a card:

1. **Frontend Validation**: Amount is validated on the frontend
2. **Direct API Call**: Payment details are sent directly to Paystack
3. **Paystack Checkout**: User is redirected to Paystack's secure payment page
4. **Card Entry**: User enters card details on Paystack's secure page
5. **Payment Processing**: Paystack processes the payment
6. **Card Storage**: Card token is stored in database for future use

### 2. Payment Processing

When making a payment with a saved card:

1. **Card Selection**: User selects a saved card
2. **Payment Authorization**: Card is charged for the payment amount
3. **Webhook Notification**: Paystack sends success/failure notification
4. **Balance Update**: User's wallet is updated accordingly

## Direct API Integration

### Frontend Implementation

The frontend directly calls Paystack's API endpoints:

#### Initialize Payment

```javascript
const paymentData = {
  email: session.user.email,
  amount: (parseInt(amountInput) * 100).toString(), // Convert to kobo
  currency: 'NGN',
  reference: reference,
  callback_url: `${process.env.EXPO_PUBLIC_APP_URL}/payment/callback`,
  channels: ['card'], // Only allow card payments
  metadata: {
    user_id: session.user.id,
    payment_type: 'card_payment',
    save_card: saveCard
  }
};

const response = await fetch('https://api.paystack.co/transaction/initialize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(paymentData)
});
```

#### Verify Payment

```javascript
const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
});

const data = await response.json();
if (data.status && data.data?.status === 'success') {
  // Payment successful, store card token
}
```

## Frontend Implementation

### Add Card Screen

The `app/add-card.tsx` screen provides:

- **Amount Input**: User enters amount to charge for card verification
- **Secure Redirect**: Redirects to Paystack Checkout
- **Payment Modal**: Shows payment status and options
- **Auto-verification**: Periodically checks payment status
- **Error Handling**: Comprehensive error messages

### Key Features

1. **Amount Validation**: Ensures amount is within limits
2. **Secure Redirect**: Uses Paystack's secure payment page
3. **Payment Tracking**: Automatically tracks payment status
4. **Card Storage**: Saves card tokens for future use
5. **User Experience**: Seamless payment flow

## Database Schema

### payment_methods Table

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank', 'ussd')),
  provider TEXT NOT NULL DEFAULT 'paystack',
  token TEXT NOT NULL,
  last_four TEXT,
  exp_month TEXT,
  exp_year TEXT,
  card_type TEXT,
  bank TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Considerations

### 1. Card Data Security

- **No Card Storage**: Full card details are never stored in the database
- **Paystack Checkout**: Card details are handled by Paystack's secure servers
- **PCI Compliance**: Paystack handles all PCI compliance requirements
- **Encryption**: All data is transmitted over HTTPS

### 2. API Security

- **Secret Key**: Paystack secret key is used for API authentication
- **Reference Validation**: Unique references prevent duplicate payments
- **Webhook Verification**: Webhook signatures are verified

### 3. Validation

- **Amount Validation**: Server validates minimum/maximum amounts
- **Reference Validation**: Unique references prevent duplicate payments
- **Webhook Verification**: Webhook signatures are verified

## Error Handling

### Common Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `Amount is required` | Missing payment amount | Enter a valid amount |
| `Minimum amount is ₦100` | Amount too low | Increase amount |
| `Maximum amount is ₦1,000,000` | Amount too high | Decrease amount |
| `Failed to initialize payment` | Paystack API error | Check Paystack status |
| `Unable to open payment page` | Browser/app issue | Check device settings |

### Error Response Format

```json
{
  "status": false,
  "message": "Error message"
}
```

## Testing

### Test Script

Run the test script to verify the integration:

```bash
node scripts/test-card-payment.js
```

### Manual Testing

1. **Start Development Server**
   ```bash
   npm start
   ```

2. **Navigate to Add Card Screen**
   - Go to Settings → Payment Methods → Add Card

3. **Test Card Addition**
   - Enter amount (e.g., ₦100)
   - Click "Proceed to Payment"
   - Complete payment on Paystack Checkout
   - Return to app

4. **Verify Card Storage**
   - Check payment methods list
   - Verify card appears in saved cards

## Webhook Integration

Card payments are processed through the existing webhook at `/api/paystack-webhook`:

### Supported Events

- `charge.success`: Card payment successful
- `charge.failed`: Card payment failed
- `charge.pending`: Card payment pending

### Webhook Processing

1. **Signature Verification**: Webhook signature is verified
2. **Event Processing**: Payment event is processed
3. **Balance Update**: User's wallet is updated
4. **Transaction Record**: Payment is recorded in database
5. **Notification**: User receives payment notification

## Environment Variables

Required environment variables:

```bash
# Paystack Configuration
EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY=sk_live_...
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...

# App Configuration
EXPO_PUBLIC_APP_URL=https://your-app.com

# Webhook Configuration
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# Database Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Monitoring and Logging

### Log Levels

- **Info**: Payment initialization, successful operations
- **Warning**: Payment verification failures, validation issues
- **Error**: API failures, database errors, authentication issues

### Key Metrics

- Payment initialization success rate
- Payment completion rate
- Card storage success rate
- Error rates by payment type

## Troubleshooting

### Common Issues

1. **Payment Page Not Opening**
   - Check device browser settings
   - Verify URL is accessible
   - Check network connectivity

2. **Payment Not Completing**
   - Verify Paystack service status
   - Check payment amount limits
   - Verify card details are correct

3. **Card Not Saved**
   - Check database connection
   - Verify user authentication
   - Check payment_methods table permissions

### Debug Steps

1. **Check API Logs**
   ```bash
   # View API endpoint logs
   tail -f logs/api.log
   ```

2. **Verify Paystack Configuration**
   ```bash
   # Test Paystack API directly
   curl -H "Authorization: Bearer YOUR_SECRET_KEY" \
        https://api.paystack.co/transaction/initialize
   ```

3. **Check Database**
   ```sql
   -- Verify payment methods
   SELECT * FROM payment_methods WHERE user_id = 'user_id';
   ```

## Advantages of Direct API + Checkout

### ✅ **Benefits**

1. **No PCI Compliance**: No need for expensive PCI certification
2. **Security**: Paystack handles all security requirements
3. **Compliance**: Automatically compliant with regulations
4. **Maintenance**: Paystack maintains security standards
5. **Trust**: Users trust Paystack's payment page
6. **No Custom API**: Direct integration reduces complexity

### ⚠️ **Considerations**

1. **User Experience**: Redirect to external page
2. **Customization**: Limited customization of payment page
3. **Branding**: Paystack branding on payment page

## Future Enhancements

### Planned Features

1. **Card Management**
   - Edit saved cards
   - Set default payment method
   - Delete saved cards

2. **Enhanced Security**
   - 3D Secure integration
   - Biometric authentication
   - Fraud detection

3. **Analytics**
   - Payment success rates
   - Card type preferences
   - User behavior analysis

### Integration Opportunities

1. **Recurring Payments**
   - Subscription billing
   - Automatic payments
   - Payment scheduling

2. **International Cards**
   - Support for foreign cards
   - Multi-currency support
   - Cross-border payments

## Support

For technical support:

1. **Check Documentation**: Review this guide and Paystack docs
2. **Test Integration**: Use the provided test scripts
3. **Contact Support**: Reach out to Paystack support for API issues
4. **Community**: Check Paystack community forums

## References

- [Paystack Checkout Documentation](https://paystack.com/docs/payments/checkout)
- [Paystack Transaction API](https://paystack.com/docs/payments/transactions)
- [PCI Compliance Guide](https://paystack.com/docs/security)
- [Webhook Documentation](https://paystack.com/docs/webhooks) 