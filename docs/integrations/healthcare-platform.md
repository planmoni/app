# Healthcare Platform Integration Guide

This guide shows how to integrate Planmoni for managing emergency funds in a healthcare platform.

## Use Case

Healthcare platforms need to:
- Create restricted wallets for patients
- Control access to emergency funds
- Require approvals for large disbursements
- Track all transactions for audit

## Integration Steps

### 1. Initialize SDK

```typescript
import { PlanmoniClient } from '@planmoni/sdk';

const client = new PlanmoniClient({
  apiKey: process.env.PLANMONI_API_KEY,
});
```

### 2. Create Patient Wallet

```typescript
// When patient registers
const wallet = await client.wallets.create({
  external_user_id: `patient_${patientId}`,
  is_restricted: true,
  requires_approval: true,
  restrictions: [
    {
      type: 'max_balance',
      value: { amount: 500000 }, // Max ₦500,000
    },
    {
      type: 'daily_limit',
      value: { daily_amount: 100000 }, // Max ₦100,000/day
    },
    {
      type: 'approval_required',
      value: {
        threshold: 50000, // Require approval above ₦50,000
        workflow_id: 'emergency-approval-workflow',
      },
    },
  ],
});
```

### 3. Request Emergency Disbursement

```typescript
// When patient needs emergency funds
const disbursement = await client.disbursements.create({
  wallet_id: wallet.wallet.id,
  amount: 75000, // Above threshold - requires approval
  recipient_account_number: patientAccountNumber,
  recipient_bank_code: patientBankCode,
  recipient_account_name: patientName,
  purpose: 'Emergency medical expenses',
});

if (disbursement.disbursement.requires_approval) {
  // Notify approvers
  notifyApprovers(disbursement.disbursement.approval_request_id);
}
```

### 4. Handle Approvals

```typescript
// In your approval interface
const approval = await client.approvals.getRequest(approvalRequestId);

// When approver approves
await client.approvals.approve(approvalRequestId, {
  comments: 'Approved for emergency medical treatment',
});

// Check if all steps complete
if (approval.request.status === 'approved') {
  // Disbursement will proceed automatically
}
```

### 5. Monitor Transactions

```typescript
// Get audit ledger
const ledger = await client.audit.getLedger(walletId, {
  from_date: startDate,
  to_date: endDate,
});

// Verify integrity
const integrity = await client.audit.verifyIntegrity(walletId);
```

## Webhook Setup

Configure webhooks to receive real-time updates:

```typescript
await client.webhooks.create({
  url: 'https://your-platform.com/webhooks/planmoni',
  events: [
    'disbursement.requested',
    'disbursement.approved',
    'disbursement.completed',
    'approval.required',
  ],
});
```

## Complete Example

See [healthcare-emergency-fund.ts](../../packages/planmoni-sdk/examples/healthcare-emergency-fund.ts) for a complete example.
