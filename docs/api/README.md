# Planmoni Platform API Documentation

Welcome to the Planmoni Platform API. This API enables businesses to embed controlled money access, restricted wallets, and policy-driven disbursements into their products.

## Base URL

```
https://api.planmoni.com/v1
```

## Authentication

Planmoni Platform API uses API key authentication. Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: pk_live_your_api_key" \
  https://api.planmoni.com/v1/wallets
```

### Getting Your API Key

1. Log in to your partner dashboard
2. Navigate to Settings > API Keys
3. Generate a new API key
4. Store it securely - it will only be shown once

## Rate Limits

Rate limits are tier-based:

- **Standard**: 1,000 requests/hour
- **Premium**: 5,000 requests/hour
- **Enterprise**: 50,000 requests/hour (or custom)

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Response Format

All API responses are JSON. Successful responses return data:

```json
{
  "wallet": {
    "id": "...",
    "balance": 100000,
    ...
  }
}
```

Error responses include error details:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "wallet_id is required",
  "details": {}
}
```

## Error Codes

- `UNAUTHORIZED` (401): Missing or invalid API key
- `FORBIDDEN` (403): Access denied
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request parameters
- `POLICY_VIOLATION` (400): Transaction violates policies/restrictions
- `INSUFFICIENT_BALANCE` (400): Insufficient wallet balance
- `APPROVAL_REQUIRED` (400): Transaction requires approval
- `RATE_LIMIT_EXCEEDED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Server error

## API Resources

- [Wallets](./wallets.md) - Restricted wallet management
- [Disbursements](./disbursements.md) - Controlled disbursement requests
- [Policies](./policies.md) - Wallet policy configuration
- [Approvals](./approvals.md) - Approval workflow management
- [Audit](./audit.md) - Audit ledger and event queries
- [Partners](./partners.md) - Partner management
- [Webhooks](./webhooks.md) - Webhook configuration

## SDK

We provide a TypeScript/JavaScript SDK for easier integration:

```bash
npm install @planmoni/sdk
```

See [SDK Documentation](../../packages/planmoni-sdk/README.md) for details.

## Support

For API support, contact: api-support@planmoni.com
