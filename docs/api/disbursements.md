# Disbursements API

Request controlled disbursements with policy validation and approval triggering.

## Request Disbursement

```http
POST /api/v1/disbursements
```

**Request Body:**
```json
{
  "wallet_id": "uuid",
  "amount": 50000,
  "recipient_account_number": "1234567890",
  "recipient_bank_code": "058",
  "recipient_account_name": "John Doe",
  "purpose": "Salary payment",
  "metadata": {}
}
```

**Response:**
```json
{
  "disbursement": {
    "transaction_id": "uuid",
    "wallet_id": "uuid",
    "amount": 50000,
    "status": "pending_approval",
    "approval_request_id": "uuid",
    "requires_approval": true,
    "policy_evaluation": {
      "decision": "require_approval",
      "matched_rules": [...]
    }
  }
}
```

**Status Values:**
- `pending_approval`: Waiting for approval
- `pending`: Approved, processing
- `completed`: Successfully disbursed
- `failed`: Disbursement failed
- `rejected`: Approval rejected

## Get Disbursement Status

```http
GET /api/v1/disbursements/{disbursement_id}
```

**Response:**
```json
{
  "disbursement": {
    "id": "uuid",
    "wallet_id": "uuid",
    "amount": 50000,
    "status": "completed",
    "reference": "DISP-...",
    "approval_request": {...}
  }
}
```

## Disbursement Flow

1. **Request Created**: Disbursement request is created
2. **Policy Evaluation**: Policies and restrictions are checked
3. **Approval Check**: If required, approval request is created
4. **Approval Process**: Multi-step approval workflow (if applicable)
5. **Execution**: Once approved, disbursement is executed via payment provider
6. **Completion**: Transaction status updated to `completed` or `failed`
