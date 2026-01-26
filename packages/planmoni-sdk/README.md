# Planmoni SDK

TypeScript/JavaScript SDK for Planmoni Platform API.

## Installation

```bash
npm install @planmoni/sdk
```

## Usage

```typescript
import { PlanmoniClient } from '@planmoni/sdk';

// Initialize client
const client = new PlanmoniClient({
  apiKey: 'pk_live_your_api_key',
  baseUrl: 'https://api.planmoni.com', // Optional
});

// Create a restricted wallet
const wallet = await client.wallets.create({
  external_user_id: 'user_123',
  is_restricted: true,
  restrictions: [
    {
      type: 'max_balance',
      value: { amount: 100000 },
    },
    {
      type: 'daily_limit',
      value: { daily_amount: 50000 },
    },
  ],
});

// Request disbursement
const disbursement = await client.disbursements.create({
  wallet_id: wallet.wallet.id,
  amount: 10000,
  recipient_account_number: '1234567890',
  recipient_bank_code: '058',
  recipient_account_name: 'John Doe',
  purpose: 'Salary payment',
});

// Check approval status
if (disbursement.disbursement.requires_approval) {
  const approval = await client.approvals.getRequest(
    disbursement.disbursement.approval_request_id!
  );
  console.log('Approval status:', approval.request.status);
}
```

## Resources

- **Wallets**: Create and manage restricted wallets
- **Disbursements**: Request controlled disbursements
- **Policies**: Manage wallet policies
- **Approvals**: Handle approval workflows
- **Audit**: Query audit ledger and events
- **Partners**: Manage partner settings and API keys

## Examples

See `examples/` directory for use case examples.
