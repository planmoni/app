import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WalletSummaryData {
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get period from request (daily, weekly, or monthly)
    const { period } = await req.json() as { period: 'daily' | 'weekly' | 'monthly' };

    if (!period || !['daily', 'weekly', 'monthly'].includes(period)) {
      return new Response(
        JSON.stringify({ error: "Invalid period specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${period} wallet summaries...`);

    // Get users who have opted for this period's summary
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, first_name, email_notifications')
      .not('email', 'is', null);

    if (usersError) {
      throw usersError;
    }

    // Filter users who want this period's summary
    const filteredUsers = users?.filter(user => {
      const emailNotifications = user.email_notifications || {};
      return emailNotifications.wallet_summary === period;
    }) || [];

    console.log(`Found ${filteredUsers.length} users subscribed to ${period} summaries`);

    if (filteredUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `No users subscribed to ${period} wallet summaries`,
          sent: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    const emailsSent = [];
    const emailsFailed = [];

    // Process each user
    for (const user of filteredUsers) {
      try {
        // Get wallet details
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('balance, locked_balance')
          .eq('user_id', user.id)
          .single();

        if (walletError) {
          console.error(`Error fetching wallet for user ${user.id}:`, walletError);
          emailsFailed.push({ userId: user.id, error: 'Failed to fetch wallet' });
          continue;
        }

        const balance = wallet?.balance || 0;
        const lockedBalance = wallet?.locked_balance || 0;
        const availableBalance = balance - lockedBalance;

        // Get transactions for the period
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('amount, type, created_at, payout_plan_id, status')
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', now.toISOString())
          .order('created_at', { ascending: false });

        if (txError) {
          console.error(`Error fetching transactions for user ${user.id}:`, txError);
          emailsFailed.push({ userId: user.id, error: 'Failed to fetch transactions' });
          continue;
        }

        // Filter and format deposits
        const deposits = (transactions || [])
          .filter(tx => tx.type === 'deposit' && tx.status === 'completed')
          .map(tx => ({
            amount: `₦${tx.amount.toLocaleString()}`,
            date: new Date(tx.created_at).toLocaleDateString()
          }));

        const totalDeposits = deposits.reduce((sum, d) => {
          const amount = parseFloat(d.amount.replace('₦', '').replace(/,/g, ''));
          return sum + amount;
        }, 0);

        // Filter and format payouts
        const payoutPromises = (transactions || [])
          .filter(tx => tx.type === 'payout' && tx.status === 'completed')
          .map(async (tx) => {
            let planName = 'Payout Plan';
            if (tx.payout_plan_id) {
              const { data: plan } = await supabase
                .from('payout_plans')
                .select('name')
                .eq('id', tx.payout_plan_id)
                .single();
              if (plan) planName = plan.name;
            }
            return {
              amount: `₦${tx.amount.toLocaleString()}`,
              date: new Date(tx.created_at).toLocaleDateString(),
              plan: planName
            };
          });

        const payouts = await Promise.all(payoutPromises);

        const totalPayouts = payouts.reduce((sum, p) => {
          const amount = parseFloat(p.amount.replace('₦', '').replace(/,/g, ''));
          return sum + amount;
        }, 0);

        // Prepare email data
        const emailData: WalletSummaryData = {
          firstName: user.first_name || 'User',
          period,
          balance: `₦${balance.toLocaleString()}`,
          lockedBalance: `₦${lockedBalance.toLocaleString()}`,
          availableBalance: `₦${availableBalance.toLocaleString()}`,
          deposits: deposits.slice(0, 10), // Limit to 10 most recent
          payouts: payouts.slice(0, 10), // Limit to 10 most recent
          totalDeposits: `₦${totalDeposits.toLocaleString()}`,
          totalPayouts: `₦${totalPayouts.toLocaleString()}`,
          date: now.toLocaleDateString()
        };

        // Generate email HTML
        const emailHtml = generateWalletSummaryHtml(emailData);
        const periodTitle = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly';

        // Send email via Resend
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Planmoni <notifications@planmoni.com>",
            to: user.email,
            subject: `${periodTitle} Wallet Summary - Planmoni`,
            html: emailHtml
          })
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error(`Failed to send email to ${user.email}:`, errorData);
          emailsFailed.push({ userId: user.id, email: user.email, error: errorData });
        } else {
          console.log(`Successfully sent ${period} wallet summary to ${user.email}`);
          emailsSent.push({ userId: user.id, email: user.email });
        }

      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        emailsFailed.push({ userId: user.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${period} wallet summaries processed`,
        sent: emailsSent.length,
        failed: emailsFailed.length,
        details: {
          sent: emailsSent,
          failed: emailsFailed
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-wallet-summaries function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateWalletSummaryHtml(data: WalletSummaryData): string {
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
