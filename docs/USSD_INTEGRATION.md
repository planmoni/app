# USSD Payment Integration

This document describes the USSD payment integration with Paystack for Nigerian customers.

## Overview

USSD (Unstructured Supplementary Service Data) payments allow Nigerian customers to make payments by dialing a USSD code on their mobile device. This integration supports the 4 banks officially supported by Paystack USSD:

- **Guaranty Trust Bank (GTBank)** - USSD Code: `*737#`
- **United Bank of Africa (UBA)** - USSD Code: `*919#`
- **Sterling Bank** - USSD Code: `*822#`
- **Zenith Bank** - USSD Code: `*966#`

## Direct Paystack Integration

The frontend now calls the Paystack `/charge` endpoint directly to initialize USSD payments. No custom API is used for USSD payments.

### Initialize USSD Payment

**Endpoint:** `POST https://api.paystack.co/charge`

**Request Body:**
```json
{
  "email": "user@email.com",
  "amount": "100000", // Amount in kobo
  "ussd": { "type": "737" },
  "metadata": {
    "user_id": "user_id",
    "payment_type": "ussd",
    "bank_code": "058",
    "reference": "unique_reference"
  }
}
```

**Response:**
Returns a USSD code and reference for the user to dial and complete payment.

### Verify Payment Status

**Endpoint:** `GET https://api.paystack.co/charge/{reference}`

**Response:**
Returns the status of the payment (pending, success, failed).

## Frontend Implementation

- The frontend uses the `useUSSD` hook to call Paystack directly.
- No `/api/paystack-ussd` custom API is used.
- All logic for initializing and verifying USSD payments is handled in the frontend.

## Error Handling

- Only the 4 supported banks are allowed
- Minimum payment is ₦100
- User must be logged in
- Network/API errors are handled in the frontend

## Security Considerations

- Paystack secret key is used server-side only for backend operations (never expose in frontend code)
- All sensitive operations are handled securely

## Limitations

- Only 4 Nigerian banks are supported
- Only available for Nigerian customers
- Each payment requires a new USSD code
- Users must manually check payment status

## Future Enhancements

- Support for more Nigerian banks as Paystack adds them
- Automatic payment status checking
- Payment history and SMS notifications

## Paystack Integration

### Supported Banks

| Bank | Code | USSD Type | USSD Code |
|------|------|-----------|-----------|
| Guaranty Trust Bank | 058 | 737 | *737# |
| United Bank of Africa | 033 | 919 | *919# |
| Sterling Bank | 232 | 822 | *822# |
| Zenith Bank | 057 | 966 | *966# |

### API Flow

1. **Initialize Charge**: Call Paystack's `/charge` endpoint with USSD type
2. **Generate USSD Code**: Paystack returns a USSD code for the customer to dial
3. **Customer Action**: Customer dials the USSD code and completes payment
4. **Webhook Notification**: Paystack sends success/failure notification to webhook
5. **Manual Verification**: Frontend can also check payment status manually

### Webhook Handling

The webhook (`app/api/paystack-webhook+api.ts`) handles USSD payments by:

1. Checking if the payment type is USSD
2. Verifying the payment was successful
3. Adding funds to the user's wallet
4. Creating a transaction record
5. Sending notification to the user

## Testing

### Test Script

Run the test script to verify the API endpoints:

```bash
node scripts/test-ussd-endpoint.js
```

### Manual Testing

1. Start the development server
2. Navigate to the USSD payment screen
3. Select a supported bank
4. Enter an amount
5. Initialize the payment
6. Copy the USSD code and dial it on your phone
7. Check payment status

## Error Handling

### Common Errors

- **Invalid Bank Code**: Only the 4 supported banks are allowed
- **Minimum Amount**: Minimum payment is ₦100
- **Authentication**: User must be logged in
- **Network Issues**: Handle API timeouts and connection errors

### Error Responses

```json
{
  "error": "This bank does not support USSD payments. Supported banks: GTBank, UBA, Sterling Bank, Zenith Bank"
}
```

## Security Considerations

1. **Authentication**: All API calls require valid user authentication
2. **Amount Validation**: Server validates minimum amounts
3. **Bank Validation**: Only supported banks are allowed
4. **Reference Generation**: Unique references prevent duplicate payments
5. **Webhook Verification**: Webhook signatures are verified

## Limitations

1. **Bank Support**: Only 4 Nigerian banks are supported
2. **Geographic Restriction**: Only available for Nigerian customers
3. **No Recurring Payments**: Each payment requires a new USSD code
4. **Manual Verification**: Users must manually check payment status

## Future Enhancements

1. **Additional Banks**: Support for more Nigerian banks as Paystack adds them
2. **Auto-verification**: Automatic payment status checking
3. **Payment History**: Track USSD payment attempts and results
4. **SMS Notifications**: Send SMS notifications for payment status 