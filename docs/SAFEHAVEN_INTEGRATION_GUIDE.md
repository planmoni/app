# SafeHaven Integration Guide

## Overview

This guide covers the comprehensive SafeHaven MFB API integration with full audit trail support, webhook handling, and monitoring capabilities. The integration provides secure, auditable access to all SafeHaven banking services.

## Architecture

### Core Components

1. **SafeHaven API Service** (`lib/safehaven-api-service.ts`)
   - Comprehensive API client for all SafeHaven endpoints
   - Automatic token management and refresh
   - Request/response logging and audit trails

2. **SafeHaven Service** (`lib/safehaven-service.ts`)
   - High-level service for common operations
   - Token management and account synchronization
   - Error handling and retry logic

3. **SafeHaven Monitor** (`lib/safehaven-monitor.ts`)
   - Real-time monitoring and anomaly detection
   - Compliance checking and reporting
   - Automated alerting

4. **Edge Functions**
   - `safehaven-refresh-token`: Token refresh with audit logging
   - `safehaven-webhook`: Webhook processing and event handling

5. **API Endpoints**
   - `/api/safehaven`: Core SafeHaven operations
   - `/api/safehaven-transfers`: Transfer management
   - `/api/safehaven-virtual-accounts`: Virtual account operations
   - `/api/safehaven-transactions`: Transaction history
   - `/api/safehaven-utilities`: Utility functions (name enquiry, fees, etc.)

## Database Schema

### Core Tables

#### `safehaven_tokens`
Stores SafeHaven API access tokens with expiration management.

```sql
CREATE TABLE safehaven_tokens (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text DEFAULT 'Bearer',
  expires_in integer NOT NULL,
  expires_at timestamptz NOT NULL,
  ibs_client_id text NOT NULL,
  ibs_user_id text NOT NULL,
  client_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `safehaven_accounts`
Stores synchronized SafeHaven account data.

```sql
CREATE TABLE safehaven_accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  safehaven_account_id text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL,
  currency_code text DEFAULT 'NGN',
  account_balance numeric NOT NULL DEFAULT 0,
  book_balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL,
  is_default boolean DEFAULT false,
  can_debit boolean DEFAULT false,
  can_credit boolean DEFAULT false,
  -- ... additional fields
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now()
);
```

#### `safehaven_transfers`
Stores transfer data with webhook processing.

```sql
CREATE TABLE safehaven_transfers (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  safehaven_transfer_id text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('Inwards', 'Outwards')),
  amount numeric NOT NULL,
  fees numeric DEFAULT 0,
  status text NOT NULL CHECK (status IN ('Pending', 'Completed', 'Failed', 'Reversed')),
  credit_account_name text NOT NULL,
  credit_account_number text NOT NULL,
  debit_account_name text NOT NULL,
  debit_account_number text NOT NULL,
  narration text NOT NULL,
  response_code text NOT NULL,
  response_message text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  webhook_received_at timestamptz
);
```

#### `safehaven_virtual_accounts`
Stores virtual account information.

```sql
CREATE TABLE safehaven_virtual_accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  safehaven_virtual_account_id text NOT NULL UNIQUE,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  balance numeric DEFAULT 0,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

#### `safehaven_audit_logs`
Comprehensive audit trail for all SafeHaven operations.

```sql
CREATE TABLE safehaven_audit_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  operation_type text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  error_data jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  status_code integer,
  response_time_ms integer,
  safehaven_endpoint text,
  safehaven_client_id text,
  safehaven_user_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## API Endpoints

### Core SafeHaven Operations

#### `POST /api/safehaven`
Refresh SafeHaven token and optionally fetch accounts.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "fetch_accounts": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "SafeHaven token refreshed successfully",
  "data": {
    "token": {
      "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 2399,
      "expires_at": "2024-01-15T12:00:00Z",
      "ibs_client_id": "68cc5b647c6ed100244e2359",
      "ibs_user_id": "68cc5acc7c6ed100244e0f50"
    },
    "accounts": [
      {
        "id": "68cc5b657c6ed100244e235e",
        "accountNumber": "0117753301",
        "accountName": "PLANMONI TECHNOLOGIES LIMITED",
        "accountType": "Current",
        "currencyCode": "NGN",
        "accountBalance": 785683,
        "bookBalance": 785683,
        "status": "Active",
        "isDefault": true,
        "canDebit": true,
        "canCredit": true
      }
    ]
  },
  "meta": {
    "userId": "user-123",
    "responseTime": 1250,
    "auditLogId": "audit-log-uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### `GET /api/safehaven`
Get SafeHaven accounts (cached or fresh).

**Query Parameters:**
- `refresh` (boolean): Fetch fresh data from SafeHaven API
- `includeSummary` (boolean): Include account summary

**Response:**
```json
{
  "status": "success",
  "message": "SafeHaven accounts retrieved successfully",
  "data": {
    "accounts": [...],
    "summary": {
      "total_accounts": 3,
      "total_balance": 785683,
      "default_account_id": "account-uuid",
      "accounts_by_type": {
        "Current": 2,
        "Savings": 1
      }
    }
  }
}
```

### Transfer Operations

#### `POST /api/safehaven-transfers`
Initiate a transfer.

**Request:**
```json
{
  "fromAccount": "0117753301",
  "toAccount": "1234567890",
  "amount": 10000,
  "narration": "Payment for services",
  "beneficiaryName": "John Doe",
  "beneficiaryBank": "090286"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Transfer initiated successfully",
  "data": {
    "_id": "616f6ad6d5c1fb4ba1f00076",
    "sessionId": "000004211020011401570815591371",
    "paymentReference": "000004211020011401570815591371",
    "amount": 10000,
    "status": "Pending",
    "responseCode": "00",
    "responseMessage": "Transfer initiated successfully"
  }
}
```

#### `GET /api/safehaven-transfers`
Get transfer history.

**Query Parameters:**
- `startDate` (string): Start date filter
- `endDate` (string): End date filter
- `status` (string): Status filter
- `limit` (number): Number of records
- `offset` (number): Offset for pagination

### Virtual Account Operations

#### `POST /api/safehaven-virtual-accounts`
Create a virtual account.

**Request:**
```json
{
  "accountName": "Customer Virtual Account",
  "bankCode": "999240",
  "description": "Virtual account for customer payments"
}
```

#### `GET /api/safehaven-virtual-accounts`
Get virtual accounts.

**Query Parameters:**
- `virtualAccountId` (string): Get specific virtual account details

#### `PUT /api/safehaven-virtual-accounts`
Update virtual account status.

**Request:**
```json
{
  "virtualAccountId": "65b76ebbc0a4440024e45e52",
  "status": "Active"
}
```

### Subaccount Operations

#### `POST /api/safehaven-subaccounts`
Initiate subaccount creation with OTP verification.

**Request:**
```json
{
  "accountName": "John Doe Subaccount",
  "accountType": "Savings",
  "currencyCode": "NGN",
  "description": "Personal savings subaccount",
  "phoneNumber": "+2348012345678",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subaccountId": "subaccount-uuid",
    "sessionId": "session_123456",
    "otpRequired": true,
    "message": "Subaccount creation initiated. OTP verification required."
  }
}
```

#### `PUT /api/safehaven-subaccounts`
Verify OTP and complete subaccount creation.

**Request:**
```json
{
  "sessionId": "session_123456",
  "otp": "123456",
  "subaccountId": "subaccount-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subaccountId": "subaccount-uuid",
    "accountNumber": "0117753301",
    "status": "Active",
    "message": "Subaccount created successfully"
  }
}
```

#### `GET /api/safehaven-subaccounts`
Get user's subaccounts.

**Query Parameters:**
- `subaccountId` (string): Get specific subaccount details

#### `PATCH /api/safehaven-subaccounts`
Update subaccount status.

**Request:**
```json
{
  "subaccountId": "SUB123",
  "status": "Active"
}
```

### Transaction History

#### `GET /api/safehaven-transactions`
Get transaction history for an account.

**Query Parameters:**
- `accountId` (string, required): Account ID
- `startDate` (string): Start date filter
- `endDate` (string): End date filter
- `limit` (number): Number of records
- `offset` (number): Offset for pagination

### Utility Operations

#### `GET /api/safehaven-utilities?operation=banks`
Get list of banks.

#### `POST /api/safehaven-utilities`
Perform utility operations.

**Name Enquiry Request:**
```json
{
  "operation": "nameEnquiry",
  "accountNumber": "1234567890",
  "bankCode": "090286"
}
```

**Transaction Fees Request:**
```json
{
  "operation": "transactionFees",
  "amount": 10000,
  "transactionType": "transfer"
}
```

## Webhook Handling

### Webhook Types

The system handles the following SafeHaven webhook types:

1. **`transfer`**: Regular transfer events
2. **`virtualAccount.transfer`**: Virtual account transfer events
3. **`account.update`**: Account balance/status updates
4. **`transaction.update`**: Transaction status updates
5. **`subaccount.created`**: Subaccount creation events
6. **`subaccount.updated`**: Subaccount update events
7. **`subaccount.status`**: Subaccount status change events

### Webhook Payload Examples

#### Transfer Webhook
```json
{
  "type": "transfer",
  "data": {
    "_id": "616f6ad6d5c1fb4ba1f00076",
    "client": "61fbc386dab3430a31406018",
    "account": "613bdab34c38b5140663001f",
    "type": "Inwards",
    "sessionId": "000004211020011401570815591371",
    "paymentReference": "000004211020011401570815591371",
    "amount": 100,
    "status": "Completed",
    "creditAccountName": "JOHN DOE",
    "creditAccountNumber": "1234567890",
    "debitAccountName": "ACME LTD",
    "debitAccountNumber": "0987654321",
    "narration": "MOB2/UTO/To JOHN DOE/Test Notification",
    "responseCode": "00",
    "responseMessage": "Approved or completed successfully",
    "createdAt": "2021-10-20T01:14:04.054Z",
    "updatedAt": "2021-10-20T01:15:10.954Z"
  }
}
```

#### Virtual Account Transfer Webhook
```json
{
  "type": "virtualAccount.transfer",
  "data": {
    "_id": "65b76ed3c0a4440024e45e75",
    "client": "61e5a83ac6f0ec001ee90fac",
    "virtualAccount": "65b76ebbc0a4440024e45e52",
    "amount": 1001,
    "fees": 5,
    "status": "Completed",
    "creditAccountName": "BITAKOTECHNOLOG / OmaTech",
    "creditAccountNumber": "8060376145",
    "debitAccountName": "ZEALVEND",
    "debitAccountNumber": "0119536306",
    "createdAt": "2024-01-29T09:24:35.910Z",
    "updatedAt": "2024-01-29T09:24:37.994Z"
  }
}
```

#### Subaccount Created Webhook
```json
{
  "type": "subaccount.created",
  "data": {
    "_id": "68cc5b657c6ed100244e235e",
    "client": "68cc5b647c6ed100244e2359",
    "sessionId": "session_123456",
    "accountName": "John Doe Subaccount",
    "accountNumber": "0117753301",
    "accountType": "Savings",
    "currencyCode": "NGN",
    "description": "Personal savings subaccount",
    "phoneNumber": "+2348012345678",
    "email": "john@example.com",
    "status": "Active",
    "otpVerified": true,
    "otpVerifiedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:25:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Webhook Processing

The webhook handler (`supabase/functions/safehaven-webhook/index.ts`) processes incoming webhooks with:

1. **Signature Verification**: Validates webhook authenticity
2. **Data Storage**: Stores webhook data in appropriate tables
3. **Audit Logging**: Creates comprehensive audit trails
4. **Balance Updates**: Updates user balances for completed transfers
5. **Error Handling**: Retries failed webhook processing

## Monitoring and Compliance

### Real-Time Monitoring

The SafeHaven Monitor provides:

- **Token Expiration Monitoring**: Alerts for expiring tokens
- **API Usage Tracking**: Monitors API call patterns
- **Anomaly Detection**: Identifies suspicious activities
- **Error Rate Monitoring**: Tracks API error rates
- **Performance Metrics**: Response time monitoring

### Compliance Features

- **Audit Trail**: Complete audit trail for all operations
- **Data Retention**: Configurable data retention policies
- **Access Control**: Row-level security for user data
- **Integrity Verification**: Cryptographic integrity checks
- **Regulatory Reporting**: Automated compliance reports

### Monitoring Statistics

```typescript
const stats = await safeHavenMonitor.getMonitoringStats();
console.log('Total Operations:', stats.totalOperations);
console.log('Success Rate:', stats.complianceScore);
console.log('Average Response Time:', stats.averageResponseTime);
console.log('Token Expirations:', stats.tokenExpirations);
```

## Security Features

### Authentication and Authorization

- **JWT Token Management**: Secure token storage and refresh
- **User Isolation**: Row-level security ensures data isolation
- **API Key Management**: Secure API key storage and rotation
- **Access Logging**: Complete access audit trails

### Data Protection

- **Sensitive Data Masking**: Automatic masking of sensitive information
- **Encryption**: Data encryption at rest and in transit
- **Secure Storage**: Secure storage of tokens and credentials
- **Audit Integrity**: Cryptographic integrity verification

### Webhook Security

- **Signature Verification**: HMAC signature validation
- **Rate Limiting**: Protection against webhook spam
- **Retry Logic**: Automatic retry for failed webhooks
- **Error Handling**: Comprehensive error handling and logging

## Error Handling

### Common Error Scenarios

1. **Token Expiration**: Automatic token refresh
2. **API Rate Limiting**: Exponential backoff retry
3. **Network Issues**: Retry with circuit breaker
4. **Invalid Data**: Validation and error reporting
5. **Webhook Failures**: Retry mechanism with dead letter queue

### Error Response Format

```json
{
  "success": false,
  "error": "Transfer failed",
  "details": "Insufficient funds",
  "auditLogId": "audit-log-uuid",
  "responseTime": 1250,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

### 1. Token Management
- Always check token expiration before API calls
- Implement automatic token refresh
- Store tokens securely with encryption
- Monitor token usage patterns

### 2. Error Handling
- Implement comprehensive error handling
- Log all errors with context
- Provide meaningful error messages
- Implement retry logic for transient failures

### 3. Webhook Processing
- Verify webhook signatures
- Implement idempotent processing
- Handle duplicate webhooks gracefully
- Monitor webhook processing performance

### 4. Audit and Compliance
- Log all operations with full context
- Implement data retention policies
- Regular compliance audits
- Monitor for suspicious activities

### 5. Performance Optimization
- Cache frequently accessed data
- Implement request batching
- Monitor API response times
- Optimize database queries

## Troubleshooting

### Common Issues

#### 1. Token Refresh Failures
**Error**: `Failed to refresh SafeHaven token`

**Solutions**:
- Check API credentials configuration
- Verify network connectivity
- Check token expiration
- Review audit logs for details

#### 2. Webhook Processing Failures
**Error**: `Webhook processing failed`

**Solutions**:
- Check webhook signature verification
- Verify webhook payload format
- Check database connectivity
- Review webhook retry logs

#### 3. Transfer Failures
**Error**: `Transfer initiation failed`

**Solutions**:
- Verify account details
- Check account balance
- Validate transfer parameters
- Review SafeHaven API status

### Debugging

#### Enable Debug Logging
```typescript
// Add to environment variables
DEBUG=safehaven:*
```

#### Check Audit Logs
```sql
-- Check recent operations
SELECT * FROM safehaven_audit_logs 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check failed operations
SELECT * FROM safehaven_audit_logs 
WHERE status = 'failed'
ORDER BY created_at DESC;
```

#### Monitor Webhook Processing
```sql
-- Check webhook processing status
SELECT webhook_type, processed, COUNT(*) 
FROM safehaven_webhooks 
GROUP BY webhook_type, processed;

-- Check failed webhooks
SELECT * FROM safehaven_webhooks 
WHERE processed = false 
ORDER BY received_at DESC;
```

## Conclusion

The SafeHaven integration provides a comprehensive, secure, and auditable solution for banking operations. With full API coverage, webhook handling, monitoring, and compliance features, it ensures reliable and compliant banking operations while maintaining complete audit trails for regulatory requirements.

For additional support or questions, please refer to the system documentation or contact the development team.
