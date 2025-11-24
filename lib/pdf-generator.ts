import * as RNHTMLtoPDF from 'react-native-html-to-pdf';
import { Platform } from 'react-native';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  source: string;
  destination: string;
  created_at: string;
}

interface StatementData {
  userInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  transactions: Transaction[];
  summary: {
    totalDeposits: number;
    totalPayouts: number;
    totalWithdrawals: number;
    netMovement: number;
  };
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

function generateStatementHTML(data: StatementData): string {
  const { userInfo, dateRange, transactions, summary } = data;

  const transactionRows = transactions.map((transaction, index) => {
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
        .logo {
          width: 120px;
          height: auto;
          margin-bottom: 8px;
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
        .summary-value.neutral {
          color: #1e3a8a;
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
        th:last-child {
          text-align: left;
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
          <div class="info-value">${formatDate(dateRange.start)}</div>
          <div class="info-value">to ${formatDate(dateRange.end)}</div>
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

export async function generateAccountStatementPDF(data: StatementData): Promise<string> {
  try {
    const html = generateStatementHTML(data);

    const fileName = `Planmoni_Statement_${data.dateRange.start.toISOString().split('T')[0]}_to_${data.dateRange.end.toISOString().split('T')[0]}`;

    const options = {
      html,
      fileName,
      directory: Platform.OS === 'ios' ? 'Documents' : 'Downloads',
      base64: true,
    };

    const file = await RNHTMLtoPDF.convert(options);

    return file.filePath || '';
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF statement');
  }
}

export async function generateStatementBase64(data: StatementData): Promise<string> {
  try {
    const html = generateStatementHTML(data);

    const fileName = `Planmoni_Statement_${data.dateRange.start.toISOString().split('T')[0]}_to_${data.dateRange.end.toISOString().split('T')[0]}`;

    const options = {
      html,
      fileName,
      directory: Platform.OS === 'ios' ? 'Documents' : 'Downloads',
      base64: true,
    };

    const file = await RNHTMLtoPDF.convert(options);

    return file.base64 || '';
  } catch (error) {
    console.error('Error generating PDF base64:', error);
    throw new Error('Failed to generate PDF statement');
  }
}
