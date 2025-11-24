import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu';

function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function generateStatementHTML(data: any) {
  const { userInfo, dateRange, transactions, summary } = data;

  const transactionRows = transactions.map((transaction: any, index: number) => {
    const isCredit = transaction.type === 'deposit';
    const amount = isCredit ? transaction.amount : -transaction.amount;

    return `
      <tr style="${index % 2 === 0 ? 'background-color: #f9fafb;' : ''}">
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          ${formatDateTime(transaction.created_at)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          ${transaction.source}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          ${transaction.destination}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; color: ${isCredit ? '#22c55e' : '#ef4444'}; font-weight: 600;">
          ${formatCurrency(amount)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; ${
            transaction.status === 'completed'
              ? 'background-color: #dcfce7; color: #15803d;'
              : transaction.status === 'pending'
              ? 'background-color: #fef3c7; color: #a16207;'
              : 'background-color: #fee2e2; color: #b91c1c;'
          }">
            ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          color: #111827;
          padding: 40px;
          background: white;
        }
        .header {
          margin-bottom: 40px;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 20px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        .company-name {
          font-size: 28px;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 4px;
        }
        .statement-title {
          font-size: 20px;
          font-weight: 600;
          color: #374151;
          margin-top: 10px;
        }
        .info-section {
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
        }
        .info-block {
          flex: 1;
        }
        .info-label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
        }
        .summary-section {
          background: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .summary-item {
          background: white;
          padding: 16px;
          border-radius: 6px;
        }
        .summary-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 6px;
        }
        .summary-value {
          font-size: 18px;
          font-weight: 700;
        }
        .summary-value.positive {
          color: #22c55e;
        }
        .summary-value.negative {
          color: #ef4444;
        }
        .table-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        thead {
          background: #1e3a8a;
          color: white;
        }
        th {
          padding: 12px 8px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #6b7280;
          text-align: center;
        }
        .footer-note {
          margin-bottom: 8px;
        }
        .generated-date {
          font-style: italic;
        }
        .empty-state {
          padding: 40px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px dashed #d1d5db;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <div class="company-name">Planmoni</div>
        </div>
        <div class="statement-title">Account Statement</div>
      </div>

      <div class="info-section">
        <div class="info-block">
          <div class="info-label">Account Holder</div>
          <div class="info-value">${userInfo.firstName} ${userInfo.lastName}</div>
          <div class="info-value" style="font-weight: 400; margin-top: 4px;">${userInfo.email}</div>
        </div>
        <div class="info-block" style="text-align: right;">
          <div class="info-label">Statement Period</div>
          <div class="info-value">${formatDate(new Date(dateRange.start))}</div>
          <div class="info-value">to ${formatDate(new Date(dateRange.end))}</div>
        </div>
      </div>

      <div class="summary-section">
        <div class="summary-item">
          <div class="summary-label">Total Deposits</div>
          <div class="summary-value positive">${formatCurrency(summary.totalDeposits)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Payouts</div>
          <div class="summary-value negative">${formatCurrency(summary.totalPayouts)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Withdrawals</div>
          <div class="summary-value negative">${formatCurrency(summary.totalWithdrawals)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Net Movement</div>
          <div class="summary-value ${summary.netMovement >= 0 ? 'positive' : 'negative'}">
            ${formatCurrency(summary.netMovement)}
          </div>
        </div>
      </div>

      <div class="table-section">
        <div class="section-title">Transaction History</div>
        ${transactions.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Source</th>
                <th>Destination</th>
                <th style="text-align: right;">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
          </table>
        ` : `
          <div class="empty-state">
            No transactions found for the selected period.
          </div>
        `}
      </div>

      <div class="footer">
        <div class="footer-note">
          This is a system-generated document. For any inquiries, please contact support@planmoni.com
        </div>
        <div class="generated-date">
          Generated on ${formatDateTime(new Date().toISOString())}
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailHTML(data: any) {
  const { firstName, startDate, endDate, transactionCount, totalDeposits, totalPayouts, netMovement } = data;

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
        <p>Hello ${firstName},</p>
        <p>Your requested account statement has been generated and is attached to this email.</p>

        <div class="info-box">
          <p><strong>Statement Period:</strong></p>
          <p class="highlight">${startDate} to ${endDate}</p>
        </div>

        <table>
          <tr>
            <th>Total Transactions</th>
            <td>${transactionCount}</td>
          </tr>
          <tr>
            <th>Total Deposits</th>
            <td style="color: #22C55E; font-weight: 600;">${totalDeposits}</td>
          </tr>
          <tr>
            <th>Total Payouts & Withdrawals</th>
            <td style="color: #EF4444; font-weight: 600;">${totalPayouts}</td>
          </tr>
          <tr>
            <th>Net Movement</th>
            <td style="font-weight: 600;">${netMovement}</td>
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

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return createJsonResponse({ error: 'Start date and end date are required' }, 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return createJsonResponse({ error: 'Invalid date format' }, 400);
    }

    if (start > end) {
      return createJsonResponse({ error: 'Start date must be before end date' }, 400);
    }

    const { data: canRequest, error: limitError } = await supabase
      .rpc('check_statement_request_limit', { p_user_id: user.id });

    if (limitError) {
      console.error('Error checking request limit:', limitError);
      return createJsonResponse({ error: 'Failed to check request limit' }, 500);
    }

    if (!canRequest) {
      return createJsonResponse({
        error: 'Daily limit reached',
        message: 'You have reached your daily limit of 10 statement requests. Please try again tomorrow.'
      }, 429);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return createJsonResponse({ error: 'Failed to fetch user profile' }, 500);
    }

    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return createJsonResponse({ error: 'Failed to fetch transactions' }, 500);
    }

    const totalDeposits = transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPayouts = transactions
      .filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);

    const netMovement = totalDeposits - totalPayouts - totalWithdrawals;

    const statementData = {
      userInfo: {
        firstName: profile.first_name || 'User',
        lastName: profile.last_name || '',
        email: profile.email || user.email || '',
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      transactions,
      summary: {
        totalDeposits,
        totalPayouts,
        totalWithdrawals,
        netMovement,
      },
    };

    const pdfHTML = generateStatementHTML(statementData);
    const pdfBuffer = Buffer.from(pdfHTML);
    const pdfBase64 = pdfBuffer.toString('base64');

    const emailHTML = generateEmailHTML({
      firstName: profile.first_name || 'User',
      startDate: formatDate(start),
      endDate: formatDate(end),
      transactionCount: transactions.length,
      totalDeposits: formatCurrency(totalDeposits),
      totalPayouts: formatCurrency(totalPayouts + totalWithdrawals),
      netMovement: formatCurrency(netMovement),
    });

    const fileName = `Planmoni_Statement_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Planmoni <notifications@planmoni.com>',
        to: profile.email || user.email,
        subject: `Account Statement - ${formatDate(start)} to ${formatDate(end)}`,
        html: emailHTML,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
            content_type: 'application/pdf',
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Failed to send email:', errorData);

      await supabase
        .from('account_statement_requests')
        .insert({
          user_id: user.id,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          status: 'failed',
          email: profile.email || user.email || '',
          error_message: JSON.stringify(errorData),
        });

      return createJsonResponse({
        error: 'Failed to send email',
        details: errorData
      }, 500);
    }

    await supabase
      .from('account_statement_requests')
      .insert({
        user_id: user.id,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        status: 'completed',
        email: profile.email || user.email || '',
      });

    return createJsonResponse({
      success: true,
      message: 'Account statement sent to your email successfully',
    });

  } catch (error) {
    console.error('Error generating account statement:', error);
    return createJsonResponse({
      error: 'Failed to generate account statement',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: canRequest, error: limitError } = await supabase
      .rpc('check_statement_request_limit', { p_user_id: user.id });

    if (limitError) {
      console.error('Error checking request limit:', limitError);
      return createJsonResponse({ error: 'Failed to check request limit' }, 500);
    }

    const { data: requests, error: requestsError } = await supabase
      .from('account_statement_requests')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return createJsonResponse({ error: 'Failed to fetch requests' }, 500);
    }

    return createJsonResponse({
      canRequest,
      requestsToday: requests?.length || 0,
      maxRequests: 10,
      requests: requests || [],
    });

  } catch (error) {
    console.error('Error checking statement status:', error);
    return createJsonResponse({
      error: 'Failed to check statement status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
