/**
 * Payroll Advances Example
 * 
 * Example of using Planmoni SDK for an employer platform
 * managing salary advances for employees.
 */

import { PlanmoniClient } from '../src';

async function payrollAdvancesExample() {
  const client = new PlanmoniClient({
    apiKey: process.env.PLANMONI_API_KEY!,
  });

  // 1. Create wallet for employee with advance restrictions
  const wallet = await client.wallets.create({
    external_user_id: 'employee_789',
    is_restricted: true,
    restrictions: [
      {
        type: 'max_balance',
        value: { amount: 200000 }, // Max advance of ₦200,000
      },
      {
        type: 'withdrawal_limit',
        value: { amount: 50000 }, // Max withdrawal per transaction
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

  // 2. Request salary advance
  const advance = await client.disbursements.create({
    wallet_id: wallet.wallet.id,
    amount: 30000,
    recipient_account_number: '9876543210',
    recipient_bank_code: '011',
    recipient_account_name: 'Employee Name',
    purpose: 'Salary advance',
  });

  console.log('Advance requested:', advance.disbursement.transaction_id);

  // 3. Get transaction history
  const ledger = await client.audit.getLedger(wallet.wallet.id, {
    limit: 10,
  });

  console.log('Transaction history:', ledger.entries);
}
