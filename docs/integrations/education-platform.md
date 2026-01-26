# Education Platform Integration Guide

This guide shows how to integrate Planmoni for managing restricted tuition wallets in an education platform.

## Use Case

Education platforms need to:
- Create restricted wallets for students
- Allow tuition payments only to school accounts
- Enforce spending limits
- Track all transactions for parents/guardians

## Integration Steps

### 1. Create Student Wallet

```typescript
const wallet = await client.wallets.create({
  external_user_id: `student_${studentId}`,
  is_restricted: true,
  restrictions: [
    {
      type: 'max_balance',
      value: { amount: 1000000 }, // Max ₦1,000,000
    },
    {
      type: 'purpose_restriction',
      value: {
        allowed_purposes: ['tuition', 'fees', 'books'],
        blocked_purposes: ['entertainment', 'shopping'],
      },
    },
    {
      type: 'approval_required',
      value: {
        threshold: 100000, // Require approval above ₦100,000
      },
    },
  ],
});
```

### 2. Pay Tuition

```typescript
const tuitionPayment = await client.disbursements.create({
  wallet_id: wallet.wallet.id,
  amount: 150000,
  recipient_account_number: schoolAccountNumber,
  recipient_bank_code: schoolBankCode,
  recipient_account_name: 'School Name',
  purpose: 'tuition',
});
```

### 3. Parent/Guardian Approval

```typescript
// If approval required, get request
if (tuitionPayment.disbursement.requires_approval) {
  const approval = await client.approvals.getRequest(
    tuitionPayment.disbursement.approval_request_id!
  );
  
  // Show to parent for approval
  // When approved:
  await client.approvals.approve(approval.request.id, {
    comments: 'Approved by parent',
  });
}
```

## Widget Integration

Embed wallet balance widget for parents:

```html
<iframe 
  src="https://api.planmoni.com/widgets/wallet-balance?wallet_id=WALLET_ID&api_key=API_KEY"
  width="300"
  height="150"
></iframe>
```
