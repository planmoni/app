# Payroll System Integration Guide

This guide shows how to integrate Planmoni for managing salary advances in a payroll system.

## Use Case

Payroll systems need to:
- Create wallets for employees
- Allow salary advances with restrictions
- Enforce time-based limits (business hours only)
- Track advance repayments

## Integration Steps

### 1. Create Employee Wallet

```typescript
const wallet = await client.wallets.create({
  external_user_id: `employee_${employeeId}`,
  is_restricted: true,
  restrictions: [
    {
      type: 'max_balance',
      value: { amount: 200000 }, // Max advance of ₦200,000
    },
    {
      type: 'withdrawal_limit',
      value: { amount: 50000 }, // Max ₦50,000 per transaction
    },
    {
      type: 'time_restriction',
      value: {
        allowed_hours: [{ start: '09:00', end: '17:00' }],
        allowed_days: [1, 2, 3, 4, 5], // Monday-Friday
      },
    },
  ],
});
```

### 2. Request Salary Advance

```typescript
const advance = await client.disbursements.create({
  wallet_id: wallet.wallet.id,
  amount: 30000,
  recipient_account_number: employeeAccountNumber,
  recipient_bank_code: employeeBankCode,
  recipient_account_name: employeeName,
  purpose: 'Salary advance',
});
```

### 3. Process Salary (Credit to Wallet)

```typescript
// When processing salary, credit the wallet
// This would be done via your backend, not the API
// The wallet balance would be updated through your system
```

### 4. Monitor Employee Advances

```typescript
// Get all wallets for employees
const wallets = await client.wallets.list();

// Get transaction history
for (const wallet of wallets.wallets) {
  const ledger = await client.audit.getLedger(wallet.id);
  // Process ledger entries for reporting
}
```

## Webhook Events

Subscribe to these events:
- `wallet.balance_changed`: When wallet balance changes
- `disbursement.completed`: When advance is disbursed
- `disbursement.failed`: If disbursement fails
