// Follow Deno's ES modules convention
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: "Server configuration error"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { startDate, endDate, downloadPdf = false } = await req.json();
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({
        error: 'Start date and end date are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Check rate limit
    const { data: canRequest, error: limitError } = await supabase.rpc('check_statement_request_limit', {
      p_user_id: user.id
    });
    if (limitError) {
      console.error('Error checking request limit:', limitError);
      return new Response(JSON.stringify({
        error: 'Failed to check request limit'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!canRequest) {
      return new Response(JSON.stringify({
        error: 'Daily limit reached',
        message: 'You have reached your daily limit of 4 statement requests. Please try again tomorrow.'
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', user.id).single();
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user profile'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get transactions
    const { data: transactions, error: transactionsError } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', {
      ascending: false
    });
    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch transactions'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Calculate summaries
    const totalDeposits = transactions.filter((t)=>t.type === 'deposit').reduce((sum, t)=>sum + t.amount, 0);
    const totalPayouts = transactions.filter((t)=>t.type === 'payout').reduce((sum, t)=>sum + t.amount, 0);
    const totalWithdrawals = transactions.filter((t)=>t.type === 'withdrawal').reduce((sum, t)=>sum + t.amount, 0);
    const netMovement = totalDeposits - totalPayouts - totalWithdrawals;
    // Format functions
    const formatCurrency = (amount)=>{
      return `₦${amount.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    };
    const formatDate = (date)=>{
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    const formatDateTime = (dateString)=>{
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };
    // Generate transaction rows for PDF and email
    const transactionRows = transactions.map((transaction, index)=>{
      const isCredit = transaction.type === 'deposit';
      const amount = isCredit ? transaction.amount : -transaction.amount;
      const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
      return `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 12px;">
            ${formatDateTime(transaction.created_at)}
          </td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 12px;">
            ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
          </td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 12px; text-align: right; color: ${isCredit ? '#22c55e' : '#ef4444'}; font-weight: 600;">
            ${formatCurrency(amount)}
          </td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 12px;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; ${transaction.status === 'completed' ? 'background-color: #dcfce7; color: #15803d;' : transaction.status === 'pending' ? 'background-color: #fef3c7; color: #a16207;' : 'background-color: #fee2e2; color: #b91c1c;'}">
              ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
    // Generate PDF-optimized HTML for statement
    const statementHTML = `
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
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 30px;
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
          td {
            padding: 12px 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Planmoni</div>
          <div class="statement-title">Account Statement</div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <div class="info-label">Account Holder</div>
            <div class="info-value">${profile.first_name || 'User'} ${profile.last_name || ''}</div>
            <div class="info-value" style="font-weight: 400; margin-top: 4px;">${profile.email || user.email || ''}</div>
          </div>
          <div class="info-block" style="text-align: right;">
            <div class="info-label">Statement Period</div>
            <div class="info-value">${formatDate(start)}</div>
            <div class="info-value">to ${formatDate(end)}</div>
          </div>
        </div>

        <div class="summary-section">
          <div class="summary-item">
            <div class="summary-label">Total Deposits</div>
            <div class="summary-value positive">${formatCurrency(totalDeposits)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Payouts</div>
            <div class="summary-value negative">${formatCurrency(totalPayouts)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Withdrawals</div>
            <div class="summary-value negative">${formatCurrency(totalWithdrawals)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Net Movement</div>
            <div class="summary-value ${netMovement >= 0 ? 'positive' : 'negative'}">
              ${formatCurrency(netMovement)}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Type</th>
              <th style="text-align: right;">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows || '<tr><td colspan="4" style="text-align: center; padding: 40px;">No transactions found for the selected period.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <div>This is a system-generated document. For any inquiries, please contact support@planmoni.com</div>
          <div style="margin-top: 8px; font-style: italic;">
            Generated on ${formatDateTime(new Date().toISOString())}
          </div>
        </div>
      </body>
      </html>
    `;

    // Check if user wants to download PDF instead of receiving email
    if (downloadPdf) {
      console.log("PDF download requested - generating PDF...");
      let pdfBase64 = null;
      try {
        console.log("Generating PDF from statement HTML...");
        const API2PDF_API_KEY = Deno.env.get("API2PDF_API_KEY");
        const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");

        // Try API2PDF first
        if (API2PDF_API_KEY) {
          try {
            console.log("Attempting PDF generation with API2PDF...");
            const pdfResponse = await fetch("https://v2018.api2pdf.com/chrome/html", {
              method: "POST",
              headers: {
                "Authorization": API2PDF_API_KEY,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                html: statementHTML,
                inlinePdf: true,
                fileName: `Planmoni_Statement_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`,
                options: {
                  landscape: false,
                  displayHeaderFooter: false,
                  printBackground: true,
                  preferCSSPageSize: false
                }
              })
            });

            if (pdfResponse.ok) {
              const pdfData = await pdfResponse.json();
              if (pdfData.pdf) {
                pdfBase64 = pdfData.pdf;
                console.log("PDF generated successfully using API2PDF");
              } else {
                throw new Error("PDF data not found in API2PDF response");
              }
            } else {
              const errorData = await pdfResponse.text();
              console.error("API2PDF error:", errorData);
              throw new Error(`API2PDF failed: ${errorData}`);
            }
          } catch (api2pdfError) {
            console.error("API2PDF failed, trying PDFShift fallback:", api2pdfError);

            // Try PDFShift as fallback
            if (PDFSHIFT_API_KEY && !pdfBase64) {
              console.log("Attempting PDF generation with PDFShift...");
              const pdfResponse = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
                method: "POST",
                headers: {
                  "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  source: statementHTML,
                  format: "A4",
                  margin: "20mm",
                  landscape: false
                })
              });

              if (pdfResponse.ok) {
                const pdfBuffer = await pdfResponse.arrayBuffer();
                pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
                console.log("PDF generated successfully using PDFShift");
              } else {
                const errorData = await pdfResponse.text();
                console.error("PDFShift error:", errorData);
                throw new Error(`PDFShift failed: ${errorData}`);
              }
            }
          }
        } else if (PDFSHIFT_API_KEY) {
          // If only PDFShift is configured
          console.log("Attempting PDF generation with PDFShift...");
          const pdfResponse = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              source: statementHTML,
              format: "A4",
              margin: "20mm",
              landscape: false
            })
          });

          if (pdfResponse.ok) {
            const pdfBuffer = await pdfResponse.arrayBuffer();
            pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
            console.log("PDF generated successfully using PDFShift");
          } else {
            const errorData = await pdfResponse.text();
            console.error("PDFShift error:", errorData);
            throw new Error(`PDFShift failed: ${errorData}`);
          }
        } else {
          throw new Error("No PDF generation service configured. Please set API2PDF_API_KEY or PDFSHIFT_API_KEY.");
        }

        if (!pdfBase64) {
          throw new Error("PDF generation failed with all available services");
        }
      } catch (pdfGenError) {
        console.error("Error generating PDF:", pdfGenError);
        const pdfError = pdfGenError.message || pdfGenError.toString();

        // Record failed attempt
        await supabase.from('account_statement_requests').insert({
          user_id: user.id,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          status: 'failed',
          email: profile.email || user.email || '',
          error_message: pdfError
        });

        return new Response(JSON.stringify({
          error: 'Failed to generate PDF',
          details: pdfError
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // If we reach here, PDF was generated successfully
      // Record the successful request
      await supabase.from('account_statement_requests').insert({
        user_id: user.id,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        status: 'completed',
        email: profile.email || user.email || ''
      });

      // Return the PDF directly
      const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      const fileName = `Planmoni_Statement_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`;

      return new Response(pdfBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });
    }

    // If we reach here, user wants email delivery (not PDF download)
    console.log("Email delivery requested - preparing to send statement via email...");

    // Get Resend API key from environment variables
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu";
    if (!RESEND_API_KEY) {
      console.error("Resend API key not configured");
      return new Response(JSON.stringify({
        error: "Email service not properly configured"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // Validate recipient email
    const recipientEmail = (profile.email || user.email || '').toLowerCase().trim();
    if (!recipientEmail) {
      console.error("No recipient email found");
      return new Response(JSON.stringify({
        success: false,
        error: 'No recipient email address found',
        message: 'Cannot send statement: user email is missing'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    console.log(`Sending email to: ${recipientEmail}`);
    console.log(`Subject: Account Statement - ${formatDate(start)} to ${formatDate(end)}`);

    // Generate PDF for email attachment
    let pdfBase64 = null;
    let pdfError = null;

    try {
      console.log("Generating PDF for email attachment...");
      const API2PDF_API_KEY = Deno.env.get("API2PDF_API_KEY");
      const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");

      // Try API2PDF first
      if (API2PDF_API_KEY) {
        try {
          console.log("Attempting PDF generation with API2PDF...");
          const pdfResponse = await fetch("https://v2018.api2pdf.com/chrome/html", {
            method: "POST",
            headers: {
              "Authorization": API2PDF_API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              html: statementHTML,
              inlinePdf: true,
              fileName: `Planmoni_Statement_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`,
              options: {
                landscape: false,
                displayHeaderFooter: false,
                printBackground: true,
                preferCSSPageSize: false
              }
            })
          });

          if (pdfResponse.ok) {
            const pdfData = await pdfResponse.json();
            if (pdfData.pdf) {
              pdfBase64 = pdfData.pdf;
              console.log("PDF generated successfully using API2PDF for email attachment");
            } else {
              throw new Error("PDF data not found in API2PDF response");
            }
          } else {
            const errorData = await pdfResponse.text();
            console.error("API2PDF error:", errorData);
            throw new Error(`API2PDF failed: ${errorData}`);
          }
        } catch (api2pdfError) {
          console.error("API2PDF failed, trying PDFShift fallback:", api2pdfError);

          // Try PDFShift as fallback
          if (PDFSHIFT_API_KEY && !pdfBase64) {
            console.log("Attempting PDF generation with PDFShift...");
            const pdfResponse = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                source: statementHTML,
                format: "A4",
                margin: "20mm",
                landscape: false
              })
            });

            if (pdfResponse.ok) {
              const pdfBuffer = await pdfResponse.arrayBuffer();
              pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
              console.log("PDF generated successfully using PDFShift for email attachment");
            } else {
              const errorData = await pdfResponse.text();
              console.error("PDFShift error:", errorData);
              throw new Error(`PDFShift failed: ${errorData}`);
            }
          }
        }
      } else if (PDFSHIFT_API_KEY) {
        // If only PDFShift is configured
        console.log("Attempting PDF generation with PDFShift...");
        const pdfResponse = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: statementHTML,
            format: "A4",
            margin: "20mm",
            landscape: false
          })
        });

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
          console.log("PDF generated successfully using PDFShift for email attachment");
        } else {
          const errorData = await pdfResponse.text();
          console.error("PDFShift error:", errorData);
          throw new Error(`PDFShift failed: ${errorData}`);
        }
      } else {
        console.warn("No PDF generation service configured. Email will be sent without PDF attachment.");
        pdfError = "No PDF generation service configured";
      }

      if (!pdfBase64) {
        throw new Error("PDF generation failed with all available services");
      }
    } catch (pdfGenError) {
      console.error("Error generating PDF for email:", pdfGenError);
      pdfError = pdfGenError.message || pdfGenError.toString();
      // Continue with email sending even if PDF generation fails
      console.log("Will send email without PDF attachment due to generation error");
    }

    // Generate simple email HTML with PDF attachment message
    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #1E3A8A;
            margin-bottom: 20px;
          }
          .message {
            font-size: 16px;
            line-height: 1.8;
            color: #4B5563;
            margin-bottom: 25px;
          }
          .info-box {
            background-color: #EFF6FF;
            border-left: 4px solid #1E3A8A;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .info-label {
            font-weight: 600;
            color: #1E3A8A;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .info-value {
            font-size: 16px;
            color: #1F2937;
          }
          .attachment-notice {
            background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%);
            border: 2px solid #22C55E;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
          }
          .attachment-icon {
            font-size: 32px;
            margin-bottom: 10px;
          }
          .attachment-text {
            font-size: 16px;
            font-weight: 600;
            color: #15803D;
            margin-bottom: 5px;
          }
          .attachment-subtext {
            font-size: 14px;
            color: #16A34A;
          }
          .footer {
            background-color: #F9FAFB;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #E5E7EB;
          }
          .footer p {
            margin: 5px 0;
            font-size: 13px;
            color: #6B7280;
          }
          .support-link {
            color: #1E3A8A;
            text-decoration: none;
            font-weight: 500;
          }
          .support-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Statement</h1>
            <p>Statement Period: ${formatDate(start)} - ${formatDate(end)}</p>
          </div>

          <div class="content">
            <p class="greeting">Hello ${profile.first_name || 'User'},</p>

            <p class="message">
              Your requested account statement has been generated and is ${pdfBase64 ? 'attached to this email as a PDF document' : 'being prepared'}.
            </p>

            <div class="info-box">
              <div class="info-label">Statement Period</div>
              <div class="info-value">${formatDate(start)} to ${formatDate(end)}</div>
              <div class="info-label" style="margin-top: 15px;">Account Holder</div>
              <div class="info-value">${profile.first_name || 'User'} ${profile.last_name || ''}</div>
              <div class="info-label" style="margin-top: 15px;">Email</div>
              <div class="info-value">${profile.email || user.email || ''}</div>
            </div>

            ${pdfBase64 ? `
              <div class="attachment-notice">
                <div class="attachment-icon">📎</div>
                <div class="attachment-text">PDF Statement Attached</div>
                <div class="attachment-subtext">Open the attached PDF to view your complete transaction history and account details</div>
              </div>
            ` : `
              <p style="color: #DC2626; padding: 15px; background-color: #FEE2E2; border-radius: 8px; text-align: center;">
                <strong>Note:</strong> PDF generation encountered an issue. Please contact support or try requesting your statement again.
              </p>
            `}

            <p class="message">
              The PDF contains a complete breakdown of all your transactions, including deposits, payouts, withdrawals, and your account summary for the selected period.
            </p>

            <p class="message" style="font-size: 14px; color: #6B7280;">
              If you have any questions about your statement or need assistance, please don't hesitate to contact our support team at <a href="mailto:support@planmoni.com" class="support-link">support@planmoni.com</a>
            </p>
          </div>

          <div class="footer">
            <p><strong>Planmoni</strong></p>
            <p>This is an automated message, please do not reply directly to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
            <p style="margin-top: 15px; font-size: 12px;">Generated on ${formatDateTime(new Date().toISOString())}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    // Prepare email payload
    const emailPayload = {
      from: "Planmoni Accounts<account@planmoni.com>",
      to: recipientEmail,
      subject: `Account Statement - ${formatDate(start)} to ${formatDate(end)}`,
      html: emailHTML
    };
    // Add PDF attachment if generated successfully
    if (pdfBase64) {
      const fileName = `Planmoni_Statement_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`;
      emailPayload.attachments = [
        {
          filename: fileName,
          content: pdfBase64,
          content_type: "application/pdf"
        }
      ];
      console.log(`PDF attachment prepared: ${fileName}`);
    } else {
      console.warn("PDF generation failed, sending email without PDF attachment:", pdfError);
    }
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });
    let emailData;
    try {
      emailData = await emailResponse.json();
    } catch (parseError) {
      const responseText = await emailResponse.text();
      console.error("Failed to parse email response:", responseText);
      emailData = {
        error: "Failed to parse response",
        raw: responseText
      };
    }
    console.log(`Email API response status: ${emailResponse.status}`);
    console.log(`Email API response:`, JSON.stringify(emailData, null, 2));
    if (!emailResponse.ok) {
      console.error("Error sending email:", emailData);
      console.error(`Email failed with status ${emailResponse.status}`);
      // Record failed attempt
      try {
        await supabase.from('account_statement_requests').insert({
          user_id: user.id,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          status: 'failed',
          email: recipientEmail,
          error_message: JSON.stringify(emailData)
        });
      } catch (dbError) {
        console.error("Failed to record failed request:", dbError);
      }
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        message: emailData.message || emailData.error?.message || 'Email delivery failed',
        debug: {
          emailError: emailData,
          status: emailResponse.status,
          recipientEmail: recipientEmail
        }
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Record successful request
    try {
      await supabase.from('account_statement_requests').insert({
        user_id: user.id,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        status: 'completed',
        email: recipientEmail
      });
      console.log(`Successfully recorded request in database`);
    } catch (dbError) {
      console.error("Failed to record successful request:", dbError);
    // Don't fail the request if DB insert fails - email was sent successfully
    }
    console.log(`Account statement email sent successfully to ${recipientEmail}`);
    console.log(`Email ID: ${emailData.id || 'unknown'}`);
    return new Response(JSON.stringify({
      success: true,
      message: 'Account statement sent to your email successfully',
      emailId: emailData.id
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(JSON.stringify({
      error: error.message || "Internal server error",
      details: error.stack || "No additional details available"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
