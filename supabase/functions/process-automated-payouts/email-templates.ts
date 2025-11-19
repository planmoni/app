// Email templates for SafeHaven automated payouts

export function generatePayoutSuccessEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  payoutId: string | null;
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
      <title>Payout Successful - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #22C55E; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Payout Successful!</h1>
          <p>Hello ${data.firstName}, your payout has been processed</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
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
            Your funds have been successfully transferred to your bank account. 
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
      <title>Payout Failed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #EF4444; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .error-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .alert { background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="error-icon">⚠️</div>
          <h1>Payout Failed</h1>
          <p>Hello ${data.firstName}, we encountered an issue processing your payout</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="alert">
            <p><strong>Reason:</strong> ${data.failureReason}</p>
            <p>We're sorry for the inconvenience. Please try again or contact support if the issue persists.</p>
          </div>
          
          <div class="details">
            ${data.planName ? `<div class="detail-row">
              <span class="label">Plan Name:</span>
              <span class="value">${data.planName}</span>
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
            <a href="https://planmoni.com/support" class="button">Contact Support</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Your funds remain safe in your wallet. You can retry the payout or contact our support team for assistance.
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

