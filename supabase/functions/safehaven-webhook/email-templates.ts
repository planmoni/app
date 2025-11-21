// Email templates for SafeHaven automated payouts

export function generatePayoutSuccessEmailHtml(data: {
  firstName: string;
  amount: string;
  availableBalance: string;
  date: string;
  reference: string;
  payoutId: string | null;
  planName?: string;
  planType?: string;
  planCreatedDate?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
}) {
  // Format plan description
  const planDescription = data.planName 
    ? `${data.planName}${data.planType ? ` (${data.planType})` : ''}${data.planCreatedDate ? ` created on ${data.planCreatedDate}` : ''}`
    : data.planType 
      ? `${data.planType}${data.planCreatedDate ? ` created on ${data.planCreatedDate}` : ''}`
      : 'payment plan';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payout Successful - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .main-heading { font-size: 24px; font-weight: bold; color: #1E3A8A; margin-bottom: 15px; }
        .greeting { color: #1E3A8A; font-size: 16px; margin-bottom: 15px; }
        .transaction-description { color: #1E3A8A; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
        .details { background: #F9FAFB; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; }
        .detail-row:first-child { margin-top: 0; }
        .detail-row:last-child { margin-bottom: 0; }
        .label { font-weight: 600; color: #1E3A8A; font-size: 14px; }
        .value { color: #1E3A8A; font-size: 14px; }
        .app-buttons { display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
        .app-button { display: inline-flex; align-items: center; padding: 10px 20px; border: 2px solid #1E3A8A; border-radius: 6px; text-decoration: none; background: white; color: #1E3A8A; font-size: 12px; }
        .app-button:hover { background: #1E3A8A; color: white; }
        .app-button-icon { margin-right: 8px; font-size: 18px; }
        .app-button-text { display: flex; flex-direction: column; }
        .app-button-small { font-size: 10px; line-height: 1.2; }
        .app-button-large { font-size: 14px; font-weight: 600; line-height: 1.2; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; line-height: 1.6; }
        .footer a { color: #1E3A8A; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="header-icon">📅</div>
            <h1>Planmoni</h1>
          </div>
          
          <div class="content">
            <div class="main-heading">Your plan has been paid out</div>
            
            <div class="greeting">Dear ${data.firstName},</div>
            
            <div class="transaction-description">
              your ${planDescription} been paid.
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Amount:</span>
                <span class="value">${data.amount}</span>
              </div>
              <div class="detail-row">
                <span class="label">Available balance:</span>
                <span class="value">${data.availableBalance}</span>
              </div>
              <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">${data.date}</span>
              </div>
            </div>
            
            <div class="app-buttons">
              <a href="https://play.google.com/store/apps/details?id=com.planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">▶</span>
                <span class="app-button-text">
                  <span class="app-button-small">GET IT ON</span>
                  <span class="app-button-large">Google Play</span>
                </span>
              </a>
              <a href="https://apps.apple.com/app/planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">🍎</span>
                <span class="app-button-text">
                  <span class="app-button-small">Download on the</span>
                  <span class="app-button-large">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification system from Planmoni.</p>
          <p>If you didn't expect this transaction, please contact support immediately.</p>
          <p><a href="mailto:support@planmoni.com">@planmoni.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generatePayoutFailedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  payoutId: string | null;
  failureReason: string;
  planName?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Failed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; border: 2px solid #1E3A8A; }
        .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .main-heading { font-size: 24px; font-weight: bold; color: #1E3A8A; margin-bottom: 15px; }
        .greeting { color: #1E3A8A; font-size: 16px; margin-bottom: 15px; }
        .transaction-message { color: #4B5563; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
        .app-buttons { display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
        .app-button { display: inline-flex; align-items: center; padding: 10px 20px; border: 2px solid #1E3A8A; border-radius: 6px; text-decoration: none; background: white; color: #1E3A8A; font-size: 12px; }
        .app-button:hover { background: #1E3A8A; color: white; }
        .app-button-icon { margin-right: 8px; font-size: 18px; }
        .app-button-text { display: flex; flex-direction: column; }
        .app-button-small { font-size: 10px; line-height: 1.2; }
        .app-button-large { font-size: 14px; font-weight: 600; line-height: 1.2; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; line-height: 1.6; }
        .footer a { color: #1E3A8A; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="header-icon">📅</div>
            <h1>Planmoni</h1>
          </div>
          
          <div class="content">
            <div class="main-heading">Failed transaction</div>
            
            <div class="greeting">Dear ${data.firstName},</div>
            
            <div class="transaction-message">
              your payout failed. Nothing would be charged from your account as an error occured during the transaction.
            </div>
            
            <div class="app-buttons">
              <a href="https://play.google.com/store/apps/details?id=com.planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">▶</span>
                <span class="app-button-text">
                  <span class="app-button-small">GET IT ON</span>
                  <span class="app-button-large">Google Play</span>
                </span>
              </a>
              <a href="https://apps.apple.com/app/planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">🍎</span>
                <span class="app-button-text">
                  <span class="app-button-small">Download on the</span>
                  <span class="app-button-large">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification system from Planmoni. If you didn't expect this transaction, please contact support immediately.</p>
          <p><a href="mailto:support@planmoni.com">@planmoni.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generatePayoutReversedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  payoutId: string | null;
  failureReason: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payout Reversed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #F59E0B; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .info-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .alert { background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="info-icon">🔄</div>
          <h1>Payout Reversed</h1>
          <p>Hello ${data.firstName}, your payout has been reversed</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="alert">
            <p><strong>Reason:</strong> ${data.failureReason}</p>
            <p>Your funds have been returned to your wallet. The transaction has been reversed and you can try again.</p>
          </div>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            The funds have been returned to your wallet and are available for use. You can retry the payout when ready.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Emergency Withdrawal Email Templates
export function generateEmergencyWithdrawalSuccessEmailHtml(data: {
  firstName: string;
  amount: string;
  netAmount: string;
  feeAmount: string;
  date: string;
  reference: string;
  withdrawalId: string | null;
  planName?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Emergency Withdrawal Successful - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #3B82F6; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .fee-info { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .fee-info p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Emergency Withdrawal Successful!</h1>
          <p>Hello ${data.firstName}, your emergency withdrawal has been processed</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.netAmount}</div>
          
          <div class="fee-info">
            <p><strong>Total Amount:</strong> ${data.amount}</p>
            <p><strong>Withdrawal Fee:</strong> ${data.feeAmount}</p>
            <p><strong>Amount Received:</strong> ${data.netAmount}</p>
          </div>
          
          <div class="details">
            ${data.planName ? `<div class="detail-row">
              <span class="label">Plan Name:</span>
              <span class="value">${data.planName}</span>
            </div>` : ''}
            ${data.accountName ? `<div class="detail-row">
              <span class="label">Account Name:</span>
              <span class="value">${data.accountName}</span>
            </div>` : ''}
            ${data.bankName ? `<div class="detail-row">
              <span class="label">Bank:</span>
              <span class="value">${data.bankName}</span>
            </div>` : ''}
            ${data.accountNumber ? `<div class="detail-row">
              <span class="label">Account Number:</span>
              <span class="value">${data.accountNumber}</span>
            </div>` : ''}
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Your emergency withdrawal has been successfully processed. The funds have been transferred to your bank account. 
            The transaction may take a few minutes to reflect in your account depending on your bank.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateEmergencyWithdrawalFailedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  withdrawalId: string | null;
  failureReason: string;
  planName?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Failed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; border: 2px solid #1E3A8A; }
        .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .main-heading { font-size: 24px; font-weight: bold; color: #1E3A8A; margin-bottom: 15px; }
        .greeting { color: #1E3A8A; font-size: 16px; margin-bottom: 15px; }
        .transaction-message { color: #4B5563; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
        .app-buttons { display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
        .app-button { display: inline-flex; align-items: center; padding: 10px 20px; border: 2px solid #1E3A8A; border-radius: 6px; text-decoration: none; background: white; color: #1E3A8A; font-size: 12px; }
        .app-button:hover { background: #1E3A8A; color: white; }
        .app-button-icon { margin-right: 8px; font-size: 18px; }
        .app-button-text { display: flex; flex-direction: column; }
        .app-button-small { font-size: 10px; line-height: 1.2; }
        .app-button-large { font-size: 14px; font-weight: 600; line-height: 1.2; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; line-height: 1.6; }
        .footer a { color: #1E3A8A; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="header-icon">📅</div>
            <h1>Planmoni</h1>
          </div>
          
          <div class="content">
            <div class="main-heading">Failed transaction</div>
            
            <div class="greeting">Dear ${data.firstName},</div>
            
            <div class="transaction-message">
              your emergency withdrawal failed. Nothing would be charged from your account as an error occured during the transaction.
            </div>
            
            <div class="app-buttons">
              <a href="https://play.google.com/store/apps/details?id=com.planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">▶</span>
                <span class="app-button-text">
                  <span class="app-button-small">GET IT ON</span>
                  <span class="app-button-large">Google Play</span>
                </span>
              </a>
              <a href="https://apps.apple.com/app/planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">🍎</span>
                <span class="app-button-text">
                  <span class="app-button-small">Download on the</span>
                  <span class="app-button-large">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification system from Planmoni. If you didn't expect this transaction, please contact support immediately.</p>
          <p><a href="mailto:support@planmoni.com">@planmoni.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateEmergencyWithdrawalReversedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  withdrawalId: string | null;
  failureReason: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Emergency Withdrawal Reversed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #F59E0B; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .info-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .alert { background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="info-icon">🔄</div>
          <h1>Emergency Withdrawal Reversed</h1>
          <p>Hello ${data.firstName}, your emergency withdrawal has been reversed</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="alert">
            <p><strong>Reason:</strong> ${data.failureReason}</p>
            <p>Your funds have been returned to your wallet. The transaction has been reversed and you can try again.</p>
          </div>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            The funds have been returned to your wallet and are available for use. You can retry the emergency withdrawal when ready.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Deposit Email Templates
export function generateDepositSuccessEmailHtml(data: {
  firstName: string;
  amount: string;
  availableBalance: string;
  date: string;
  reference: string;
  transactionId: string | null;
  senderName?: string;
  senderAccount?: string;
  senderBank?: string;
  narration?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Deposit Successful - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .greeting { font-size: 20px; font-weight: bold; color: #1E3A8A; margin-bottom: 15px; }
        .confirmation-message { color: #4B5563; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
        .details { background: #F9FAFB; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; }
        .detail-row:first-child { margin-top: 0; }
        .detail-row:last-child { margin-bottom: 0; }
        .label { font-weight: 600; color: #1E3A8A; font-size: 14px; }
        .value { color: #1E3A8A; font-size: 14px; }
        .funds-message { text-align: center; color: #4B5563; font-size: 14px; margin: 25px 0; line-height: 1.6; }
        .app-buttons { display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
        .app-button { display: inline-flex; align-items: center; padding: 10px 20px; border: 2px solid #1E3A8A; border-radius: 6px; text-decoration: none; background: white; color: #1E3A8A; font-size: 12px; }
        .app-button:hover { background: #1E3A8A; color: white; }
        .app-button-icon { margin-right: 8px; font-size: 18px; }
        .app-button-text { display: flex; flex-direction: column; }
        .app-button-small { font-size: 10px; line-height: 1.2; }
        .app-button-large { font-size: 14px; font-weight: 600; line-height: 1.2; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="header-icon">📅</div>
            <h1>Planmoni</h1>
          </div>
          
          <div class="content">
            <div class="greeting">Hi ${data.firstName},</div>
            
            <div class="confirmation-message">
              Your deposit was successful and your funds have been added to your wallet balance. Find details below.
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span class="label">Amount:</span>
                <span class="value">${data.amount}</span>
              </div>
              <div class="detail-row">
                <span class="label">Available balance:</span>
                <span class="value">${data.availableBalance}</span>
              </div>
              <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">${data.date}</span>
              </div>
              <div class="detail-row">
                <span class="label">Ref:</span>
                <span class="value">${data.reference}</span>
              </div>
            </div>
            
            <div class="funds-message">
              Your funds are now available in your wallet and ready to be used for your payout plans.
            </div>
            
            <div class="app-buttons">
              <a href="https://play.google.com/store/apps/details?id=com.planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">▶</span>
                <span class="app-button-text">
                  <span class="app-button-small">GET IT ON</span>
                  <span class="app-button-large">Google Play</span>
                </span>
              </a>
              <a href="https://apps.apple.com/app/planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">🍎</span>
                <span class="app-button-text">
                  <span class="app-button-small">Download on the</span>
                  <span class="app-button-large">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification system from Planmoni. If you didn't expect this transaction, please contact support immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Deposit Failed Email Template
export function generateDepositFailedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  transactionId: string | null;
  failureReason: string;
  senderName?: string;
  senderAccount?: string;
  senderBank?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Failed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; border: 2px solid #1E3A8A; }
        .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; }
        .header-icon { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .main-heading { font-size: 24px; font-weight: bold; color: #1E3A8A; margin-bottom: 15px; }
        .greeting { color: #1E3A8A; font-size: 16px; margin-bottom: 15px; }
        .transaction-message { color: #4B5563; font-size: 14px; margin-bottom: 25px; line-height: 1.6; }
        .app-buttons { display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap; }
        .app-button { display: inline-flex; align-items: center; padding: 10px 20px; border: 2px solid #1E3A8A; border-radius: 6px; text-decoration: none; background: white; color: #1E3A8A; font-size: 12px; }
        .app-button:hover { background: #1E3A8A; color: white; }
        .app-button-icon { margin-right: 8px; font-size: 18px; }
        .app-button-text { display: flex; flex-direction: column; }
        .app-button-small { font-size: 10px; line-height: 1.2; }
        .app-button-large { font-size: 14px; font-weight: 600; line-height: 1.2; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; line-height: 1.6; }
        .footer a { color: #1E3A8A; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="header-icon">📅</div>
            <h1>Planmoni</h1>
          </div>
          
          <div class="content">
            <div class="main-heading">Failed transaction</div>
            
            <div class="greeting">Dear ${data.firstName},</div>
            
            <div class="transaction-message">
              your deposit failed. Nothing would be charged from your account as an error occured during the transaction.
            </div>
            
            <div class="app-buttons">
              <a href="https://play.google.com/store/apps/details?id=com.planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">▶</span>
                <span class="app-button-text">
                  <span class="app-button-small">GET IT ON</span>
                  <span class="app-button-large">Google Play</span>
                </span>
              </a>
              <a href="https://apps.apple.com/app/planmoni" class="app-button" target="_blank">
                <span class="app-button-icon">🍎</span>
                <span class="app-button-text">
                  <span class="app-button-small">Download on the</span>
                  <span class="app-button-large">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification system from Planmoni. If you didn't expect this transaction, please contact support immediately.</p>
          <p><a href="mailto:support@planmoni.com">@planmoni.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
