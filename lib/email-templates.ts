// Email template for welcome message
export function generateWelcomeEmailHtml(data: {
  firstName: string;
  email: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.8;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 32px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 18px;
          opacity: 0.95;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 22px;
          color: #1E3A8A;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          line-height: 1.8;
          color: #4B5563;
          margin-bottom: 20px;
        }
        .signature-box {
          background-color: #F3F4F6;
          border-left: 4px solid #1E3A8A;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .signature-name {
          font-size: 18px;
          font-weight: 600;
          color: #1E3A8A;
          margin-bottom: 5px;
        }
        .signature-title {
          font-size: 14px;
          color: #6B7280;
          font-style: italic;
        }
        .cta-box {
          background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
          padding: 25px;
          border-radius: 8px;
          text-align: center;
          margin: 30px 0;
        }
        .cta-text {
          font-size: 16px;
          color: #1E3A8A;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
          color: white !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 50px;
          margin: 10px 5px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(30, 58, 138, 0.3);
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .features {
          margin: 30px 0;
        }
        .feature-item {
          display: flex;
          align-items: start;
          margin-bottom: 20px;
        }
        .feature-icon {
          background-color: #DBEAFE;
          color: #1E3A8A;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-right: 15px;
          flex-shrink: 0;
        }
        .feature-content h3 {
          margin: 0 0 5px 0;
          font-size: 16px;
          color: #1E3A8A;
          font-weight: 600;
        }
        .feature-content p {
          margin: 0;
          font-size: 14px;
          color: #6B7280;
        }
        .footer {
          background-color: #F9FAFB;
          padding: 30px;
          font-size: 13px;
          color: #6B7280;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        .footer a {
          color: #1E3A8A;
          text-decoration: none;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #1E3A8A;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Planmoni!</h1>
          <p>Your journey to financial freedom starts here</p>
        </div>

        <div class="content">
          <div class="greeting">Hello ${data.firstName}! 👋</div>

          <div class="message">
            <p>I'm <strong>Martins Osodi</strong>, Founder and CEO of Planmoni, and I'm thrilled to personally welcome you to our community!</p>

            <p>Thank you for trusting us with your financial journey. At Planmoni, we believe that everyone deserves the freedom to control when and how they receive their money. You're not just joining an app – you're joining a movement of people who are taking control of their financial future.</p>

            <p>Whether you're saving for something special, managing your cash flow, or simply want the flexibility to access your funds on your terms, we're here to make it effortless and secure.</p>
          </div>

          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">💰</div>
              <div class="feature-content">
                <h3>Flexible Payouts</h3>
                <p>Set up automated payouts on your schedule - daily, weekly, monthly, or custom dates</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <div class="feature-content">
                <h3>Bank-Level Security</h3>
                <p>Your funds are protected with industry-leading encryption and security measures</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <div class="feature-content">
                <h3>Smart Insights</h3>
                <p>Get AI-powered insights to help you make better financial decisions</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div class="feature-content">
                <h3>Instant Access</h3>
                <p>Emergency withdrawal options for when you need your funds immediately</p>
              </div>
            </div>
          </div>

          <div class="cta-box">
            <div class="cta-text">Ready to get started? Set up your first payout plan!</div>
            <a href="https://planmoni.com" class="button">Create Your First Plan</a>
            <a href="https://planmoni.com/help" class="button" style="background: white; color: #1E3A8A !important; border: 2px solid #1E3A8A;">Browse Help Center</a>
          </div>

          <div class="message">
            <p>If you have any questions or need assistance, our support team is always here to help. You can reach us directly through the app or reply to this email.</p>

            <p>Here's to smarter, more flexible money management!</p>
          </div>

          <div class="signature-box">
            <div class="signature-name">Martins Osodi</div>
            <div class="signature-title">Founder & CEO, Planmoni</div>
          </div>
        </div>

        <div class="footer">
          <div class="social-links">
            <a href="https://twitter.com/planmoni">Twitter</a> •
            <a href="https://instagram.com/planmoni">Instagram</a> •
            <a href="https://linkedin.com/company/planmoni">LinkedIn</a>
          </div>
          <p>You're receiving this email because you created a Planmoni account with ${data.email}</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
          <p style="margin-top: 15px; font-size: 11px;">
            Planmoni Technologies | Lagos, Nigeria<br>
            <a href="https://planmoni.com/privacy">Privacy Policy</a> •
            <a href="https://planmoni.com/terms">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email template for new login notification
export function generateLoginNotificationHtml(data: {
  firstName: string;
  device: string;
  location: string;
  time: string;
  ip: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>New Login Detected</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>We detected a new login to your Planmoni account.</p>
        
        <div class="alert">
          <p><strong>If this was you, no action is needed.</strong></p>
          <p>If you didn't log in recently, please secure your account immediately by changing your password.</p>
        </div>
        
        <table>
          <tr>
            <th>Device</th>
            <td>${data.device}</td>
          </tr>
          <tr>
            <th>Location</th>
            <td>${data.location}</td>
          </tr>
          <tr>
            <th>Time</th>
            <td>${data.time}</td>
          </tr>
          <tr>
            <th>IP Address</th>
            <td>${data.ip}</td>
          </tr>
        </table>
        
        <a href="https://planmoni.com/change-password" class="button">Secure Your Account</a>
        
        <p>If you have any questions, please contact our support team.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Email template for payout notification
export function generatePayoutNotificationHtml(data: {
  firstName: string;
  amount: string;
  planName: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  date: string;
  nextPayoutDate?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #22C55E; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .amount { font-size: 24px; font-weight: bold; color: #22C55E; text-align: center; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; width: 40%; }
        .next-payout { background-color: #EFF6FF; border-left: 4px solid #1E3A8A; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Payout Successful</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Great news! Your scheduled payout has been successfully processed.</p>
        
        <div class="amount">${data.amount}</div>
        
        <table>
          <tr>
            <th>Plan Name</th>
            <td>${data.planName}</td>
          </tr>
          <tr>
            <th>Account Name</th>
            <td>${data.accountName}</td>
          </tr>
          <tr>
            <th>Bank</th>
            <td>${data.bankName}</td>
          </tr>
          <tr>
            <th>Account Number</th>
            <td>${data.accountNumber}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>${data.date}</td>
          </tr>
        </table>
        
        ${data.nextPayoutDate ? `
        <div class="next-payout">
          <p><strong>Next Payout:</strong> ${data.nextPayoutDate}</p>
          <p>Your next scheduled payout is on track. You can view your payout schedule in your Planmoni dashboard.</p>
        </div>
        ` : ''}
        
        <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
        
        <p>Thank you for using Planmoni to manage your finances!</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Email template for plan expiry reminder
export function generateExpiryReminderHtml(data: {
  firstName: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  amount: string;
  totalPaid: string;
  remainingPayouts: number;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; width: 40%; }
        .countdown { font-size: 24px; font-weight: bold; color: #F59E0B; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Payout Plan Expiring Soon</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Your payout plan "${data.planName}" is expiring soon.</p>
        
        <div class="countdown">${data.daysRemaining} days remaining</div>
        
        <div class="alert">
          <p><strong>Plan Expiry Date:</strong> ${data.expiryDate}</p>
          <p>You have ${data.remainingPayouts} payouts remaining before this plan expires.</p>
        </div>
        
        <table>
          <tr>
            <th>Plan Name</th>
            <td>${data.planName}</td>
          </tr>
          <tr>
            <th>Payout Amount</th>
            <td>${data.amount}</td>
          </tr>
          <tr>
            <th>Total Paid So Far</th>
            <td>${data.totalPaid}</td>
          </tr>
          <tr>
            <th>Remaining Payouts</th>
            <td>${data.remainingPayouts}</td>
          </tr>
          <tr>
            <th>Expiry Date</th>
            <td>${data.expiryDate}</td>
          </tr>
        </table>
        
        <p>Would you like to set up a new payout plan to continue receiving regular payouts?</p>
        
        <a href="https://planmoni.com/create-payout" class="button">Create New Payout Plan</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Email template for wallet summary
export function generateWalletSummaryHtml(data: {
  firstName: string;
  period: 'daily' | 'weekly' | 'monthly';
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  deposits: { amount: string; date: string }[];
  payouts: { amount: string; date: string; plan: string }[];
  totalDeposits: string;
  totalPayouts: string;
  date: string;
}) {
  const periodTitle = data.period === 'daily' ? 'Daily' : data.period === 'weekly' ? 'Weekly' : 'Monthly';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .summary-box { background-color: #EFF6FF; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .balance { font-size: 24px; font-weight: bold; color: #1E3A8A; margin: 10px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section-title { font-size: 18px; font-weight: bold; margin-top: 30px; color: #1E3A8A; }
        .positive { color: #22C55E; }
        .negative { color: #EF4444; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${periodTitle} Wallet Summary</h2>
        <p>${data.date}</p>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Here's a summary of your Planmoni wallet activity for the ${data.period}:</p>
        
        <div class="summary-box">
          <h3>Current Balance</h3>
          <div class="balance">${data.balance}</div>
          <p><strong>Locked Balance:</strong> ${data.lockedBalance}</p>
          <p><strong>Available Balance:</strong> ${data.availableBalance}</p>
        </div>
        
        <div class="section-title">Transaction Summary</div>
        <table>
          <tr>
            <th>Total Deposits</th>
            <td class="positive">${data.totalDeposits}</td>
          </tr>
          <tr>
            <th>Total Payouts</th>
            <td class="negative">${data.totalPayouts}</td>
          </tr>
        </table>
        
        ${data.deposits.length > 0 ? `
        <div class="section-title">Recent Deposits</div>
        <table>
          <tr>
            <th>Date</th>
            <th>Amount</th>
          </tr>
          ${data.deposits.map(deposit => `
          <tr>
            <td>${deposit.date}</td>
            <td class="positive">${deposit.amount}</td>
          </tr>
          `).join('')}
        </table>
        ` : ''}
        
        ${data.payouts.length > 0 ? `
        <div class="section-title">Recent Payouts</div>
        <table>
          <tr>
            <th>Date</th>
            <th>Plan</th>
            <th>Amount</th>
          </tr>
          ${data.payouts.map(payout => `
          <tr>
            <td>${payout.date}</td>
            <td>${payout.plan}</td>
            <td class="negative">${payout.amount}</td>
          </tr>
          `).join('')}
        </table>
        ` : ''}
        
        <a href="https://planmoni.com/transactions" class="button">View All Transactions</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>You can manage your email preferences in your <a href="https://planmoni.com/settings">account settings</a>.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Email template for account statement
export function generateAccountStatementHtml(data: {
  firstName: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  totalDeposits: string;
  totalPayouts: string;
  netMovement: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .info-box { background-color: #EFF6FF; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; width: 50%; }
        .highlight { font-size: 18px; font-weight: bold; color: #1E3A8A; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Your Account Statement is Ready</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Your requested account statement has been generated and is attached to this email.</p>

        <div class="info-box">
          <p><strong>Statement Period:</strong></p>
          <p class="highlight">${data.startDate} to ${data.endDate}</p>
        </div>

        <table>
          <tr>
            <th>Total Transactions</th>
            <td>${data.transactionCount}</td>
          </tr>
          <tr>
            <th>Total Deposits</th>
            <td style="color: #22C55E; font-weight: 600;">${data.totalDeposits}</td>
          </tr>
          <tr>
            <th>Total Payouts & Withdrawals</th>
            <td style="color: #EF4444; font-weight: 600;">${data.totalPayouts}</td>
          </tr>
          <tr>
            <th>Net Movement</th>
            <td style="font-weight: 600;">${data.netMovement}</td>
          </tr>
        </table>

        <p>The detailed statement is attached to this email as a PDF document. You can download and save it for your records.</p>

        <p>If you need any assistance or have questions about your statement, please don't hesitate to contact our support team.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Email template for marketing campaigns
export function generateMarketingCampaignHtml(data: {
  firstName: string;
  subject: string;
  content: string;
  category: 'promotional' | 'product_update' | 'educational' | 'newsletter';
  unsubscribeToken: string;
  campaignId: string;
}) {
  const categoryColors = {
    promotional: '#F59E0B',
    product_update: '#3B82F6',
    educational: '#8B5CF6',
    newsletter: '#1E3A8A'
  };

  const categoryTitles = {
    promotional: 'Special Offer',
    product_update: 'Product Update',
    educational: 'Tips & Insights',
    newsletter: 'Newsletter'
  };

  const headerColor = categoryColors[data.category];
  const categoryTitle = categoryTitles[data.category];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background-color: ${headerColor};
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .category-badge {
          display: inline-block;
          background-color: rgba(255,255,255,0.2);
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 10px;
        }
        .content {
          padding: 40px 30px;
        }
        .content h2 {
          color: ${headerColor};
          margin-top: 0;
        }
        .content p {
          margin: 15px 0;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          background-color: ${headerColor};
          color: white !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
          font-size: 16px;
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          font-size: 12px;
          color: #666;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 8px 0;
        }
        .footer a {
          color: ${headerColor};
          text-decoration: none;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #666;
          text-decoration: none;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 30px 0;
        }
        .tracking-pixel {
          width: 1px;
          height: 1px;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="category-badge">${categoryTitle}</div>
          <h1>${data.subject}</h1>
        </div>
        <div class="content">
          <p>Hello ${data.firstName},</p>
          ${data.content}
        </div>
        <div class="footer">
          <p><strong>Planmoni</strong></p>
          <p>Your trusted partner for automated payouts and financial planning</p>

          <div class="divider"></div>

          <p>
            <a href="https://planmoni.com">Visit Website</a> •
            <a href="https://planmoni.com/help">Help Center</a> •
            <a href="https://planmoni.com/contact">Contact Us</a>
          </p>

          <div class="divider"></div>

          <p>You're receiving this email because you're subscribed to our ${categoryTitle.toLowerCase()} emails.</p>
          <p>
            <a href="https://planmoni.com/email-preferences">Manage Email Preferences</a> •
            <a href="https://planmoni.com/api/unsubscribe?token=${data.unsubscribeToken}">Unsubscribe</a>
          </p>

          <p style="margin-top: 20px; font-size: 11px; color: #999;">
            Planmoni Financial Services<br>
            Lagos, Nigeria<br>
            &copy; ${new Date().getFullYear()} Planmoni. All rights reserved.
          </p>
        </div>
      </div>

      <!-- Tracking pixel for open tracking -->
      <img src="https://planmoni.com/api/track-open?campaign=${data.campaignId}&user=${data.unsubscribeToken}" class="tracking-pixel" alt="" />
    </body>
    </html>
  `;
}

// Email template for account creation notification
export function generateAccountCreationEmailHtml(data: {
  firstName: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  date: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 32px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 18px;
          opacity: 0.95;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 22px;
          color: #1E3A8A;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          line-height: 1.8;
          color: #4B5563;
          margin-bottom: 30px;
        }
        .account-details {
          background-color: #F0FDF4;
          border: 2px solid #22C55E;
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
        }
        .account-details h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          color: #16A34A;
          font-weight: 600;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #D1FAE5;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #4B5563;
          font-size: 14px;
        }
        .detail-value {
          color: #1E3A8A;
          font-weight: 600;
          font-size: 14px;
          text-align: right;
        }
        .account-number {
          font-size: 24px;
          font-weight: 700;
          color: #16A34A;
          letter-spacing: 2px;
          font-family: 'Courier New', monospace;
        }
        .info-box {
          background-color: #EFF6FF;
          border-left: 4px solid #1E3A8A;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .info-box p {
          margin: 0;
          font-size: 14px;
          color: #4B5563;
        }
        .cta-box {
          background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
          padding: 25px;
          border-radius: 8px;
          text-align: center;
          margin: 30px 0;
        }
        .cta-text {
          font-size: 16px;
          color: #1E3A8A;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
          color: white !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 50px;
          margin: 10px 5px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(30, 58, 138, 0.3);
        }
        .footer {
          background-color: #F9FAFB;
          padding: 30px;
          font-size: 13px;
          color: #6B7280;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        .footer a {
          color: #1E3A8A;
          text-decoration: none;
        }
        .success-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">🎉</div>
          <h1>Your Bank Account Has Been Created!</h1>
          <p>Welcome to SafeHaven Microfinance Bank</p>
        </div>

        <div class="content">
          <div class="greeting">Hello ${data.firstName}! 👋</div>

          <div class="message">
            <p>Congratulations! Your SafeHaven Microfinance Bank account has been successfully created and is ready to use.</p>
            <p>You can now start depositing funds, creating payout plans, and managing your finances with Planmoni.</p>
          </div>

          <div class="account-details">
            <h3>Your Account Details</h3>
            <div class="detail-row">
              <span class="detail-label">Account Number:</span>
              <span class="detail-value account-number">${data.accountNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Account Name:</span>
              <span class="detail-value">${data.accountName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Bank Name:</span>
              <span class="detail-value">${data.bankName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Account Created:</span>
              <span class="detail-value">${data.date}</span>
            </div>
          </div>

          <div class="info-box">
            <p><strong>💡 What's Next?</strong></p>
            <p style="margin-top: 10px;">Your account is now active! You can:</p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #4B5563;">
              <li>Deposit funds to your account</li>
              <li>Create automated payout plans</li>
              <li>Manage your finances with ease</li>
              <li>Access your account anytime through Planmoni</li>
            </ul>
          </div>

          <div class="cta-box">
            <div class="cta-text">Ready to get started? Add funds to your account now!</div>
            <a href="https://planmoni.com/add-funds" class="button">Add Funds</a>
            <a href="https://planmoni.com/dashboard" class="button" style="background: white; color: #1E3A8A !important; border: 2px solid #1E3A8A;">Go to Dashboard</a>
          </div>

          <div class="message">
            <p><strong>Security Reminder:</strong></p>
            <p>Please keep your account details secure. Never share your account number with unauthorized persons. If you notice any suspicious activity, contact our support team immediately.</p>
          </div>
        </div>

        <div class="footer">
          <p><strong>Planmoni</strong></p>
          <p>Your trusted partner for automated payouts and financial planning</p>
          <p style="margin-top: 20px;">
            <a href="https://planmoni.com">Visit Website</a> •
            <a href="https://planmoni.com/help">Help Center</a> •
            <a href="https://planmoni.com/contact">Contact Us</a>
          </p>
          <p style="margin-top: 20px; font-size: 11px; color: #999;">
            Planmoni Financial Services | Lagos, Nigeria<br>
            &copy; ${new Date().getFullYear()} Planmoni. All rights reserved.
          </p>
          <p style="margin-top: 15px; font-size: 11px;">
            <a href="https://planmoni.com/privacy">Privacy Policy</a> •
            <a href="https://planmoni.com/terms">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Simple marketing email wrapper for custom HTML content
export function wrapMarketingEmail(data: {
  firstName: string;
  htmlContent: string;
  category: 'promotional' | 'product_update' | 'educational' | 'newsletter';
  unsubscribeToken: string;
  campaignId: string;
}) {
  const categoryColors = {
    promotional: '#F59E0B',
    product_update: '#3B82F6',
    educational: '#8B5CF6',
    newsletter: '#1E3A8A'
  };

  const categoryTitles = {
    promotional: 'Special Offer',
    product_update: 'Product Update',
    educational: 'Tips & Insights',
    newsletter: 'Newsletter'
  };

  const headerColor = categoryColors[data.category];
  const categoryTitle = categoryTitles[data.category];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .content {
          padding: 40px 30px;
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          font-size: 12px;
          color: #666;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 8px 0;
        }
        .footer a {
          color: ${headerColor};
          text-decoration: none;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 30px 0;
        }
        .tracking-pixel {
          width: 1px;
          height: 1px;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          ${data.htmlContent}
        </div>
        <div class="footer">
          <p><strong>Planmoni</strong></p>
          <p>Your trusted partner for automated payouts and financial planning</p>

          <div class="divider"></div>

          <p>
            <a href="https://planmoni.com">Visit Website</a> •
            <a href="https://planmoni.com/help">Help Center</a> •
            <a href="https://planmoni.com/contact">Contact Us</a>
          </p>

          <div class="divider"></div>

          <p>You're receiving this email because you're subscribed to our ${categoryTitle.toLowerCase()} emails.</p>
          <p>
            <a href="https://planmoni.com/email-preferences">Manage Email Preferences</a> •
            <a href="https://planmoni.com/api/unsubscribe?token=${data.unsubscribeToken}">Unsubscribe</a>
          </p>

          <p style="margin-top: 20px; font-size: 11px; color: #999;">
            Planmoni Financial Services<br>
            Lagos, Nigeria<br>
            &copy; ${new Date().getFullYear()} Planmoni. All rights reserved.
          </p>
        </div>
      </div>

      <!-- Tracking pixel for open tracking -->
      <img src="https://planmoni.com/api/track-open?campaign=${data.campaignId}&user=${data.unsubscribeToken}" class="tracking-pixel" alt="" />
    </body>
    </html>
  `;
}