/**
 * Healthcare Emergency Fund Example
 * 
 * Example of using Planmoni SDK for a healthcare platform
 * managing emergency funds for patients.
 */

import { PlanmoniClient } from '../src';

async function healthcareEmergencyFundExample() {
  const client = new PlanmoniClient({
    apiKey: process.env.PLANMONI_API_KEY!,
  });

  // 1. Create restricted wallet for patient
  const wallet = await client.wallets.create({
    external_user_id: 'patient_12345',
    is_restricted: true,
    requires_approval: true,
    restrictions: [
      {
        type: 'max_balance',
        value: { amount: 500000 }, // Max ₦500,000
      },
      {
        type: 'daily_limit',
        value: { daily_amount: 100000 }, // Max ₦100,000 per day
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

  console.log('Created wallet:', wallet.wallet.id);

  // 2. Request emergency disbursement
  const disbursement = await client.disbursements.create({
    wallet_id: wallet.wallet.id,
    amount: 75000, // Above threshold - will require approval
    recipient_account_number: '1234567890',
    recipient_bank_code: '058',
    recipient_account_name: 'Patient Name',
    purpose: 'Emergency medical expenses',
  });

  console.log('Disbursement status:', disbursement.disbursement.status);

  // 3. If approval required, check status
  if (disbursement.disbursement.requires_approval) {
    const approval = await client.approvals.getRequest(
      disbursement.disbursement.approval_request_id!
    );
    console.log('Approval step:', approval.request.current_step + 1, '/', approval.request.total_steps);
  }

  // 4. Get wallet balance
  const balance = await client.wallets.getBalance(wallet.wallet.id);
  console.log('Available balance:', balance.balance.available);
}
