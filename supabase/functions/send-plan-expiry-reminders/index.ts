import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpiryReminderEmailData {
  firstName: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  amount: string;
  totalPaid: string;
  remainingPayouts: number;
}

function generateExpiryReminderHtml(data: ExpiryReminderEmailData): string {
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
        <h2>${data.remainingPayouts === 1 ? 'One Payout Remaining!' : 'Payout Plan Expiring Soon'}</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        ${data.remainingPayouts === 1
          ? `<p>Your payout plan "<strong>${data.planName}</strong>" has only <strong>one more payout remaining</strong>.</p>`
          : `<p>Your payout plan "<strong>${data.planName}</strong>" is approaching expiry.</p>`
        }

        <div class="countdown">${data.remainingPayouts === 1 ? '1 Payout Remaining' : `${data.remainingPayouts} Payouts Remaining`}</div>

        <div class="alert">
          <p><strong>Plan Expiry Date:</strong> ${data.expiryDate}</p>
          ${data.remainingPayouts === 1
            ? '<p><strong>This is your last payout!</strong> Consider adding new plans to continue receiving regular payouts.</p>'
            : `<p>You have ${data.remainingPayouts} payouts remaining before this plan expires.</p>`
          }
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

        <p><strong>Don't let your payouts stop!</strong> Set up a new payout plan today to continue receiving regular payouts and stay on track with your financial goals.</p>

        <a href="https://planmoni.com/create-payout" class="button">Create New Payout Plan</a>

        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          <strong>Why continue with Planmoni?</strong><br>
          ✓ Automated regular payouts<br>
          ✓ Stay disciplined with your finances<br>
          ✓ Reach your financial goals faster
        </p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail(to: string, subject: string, html: string): Promise<any> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Planmoni <no-reply@planmoni.com>",
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return await response.json();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function calculateDaysRemaining(expiryDate: string): number {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting plan expiry reminder processing...");

    // Get all active payout plans (include push_notifications for push reminders)
    const { data: activePlans, error: plansError } = await supabase
      .from("payout_plans")
      .select(`
        id,
        user_id,
        name,
        payout_amount,
        duration,
        completed_payouts,
        next_payout_date,
        profiles!payout_plans_user_id_fkey (
          id,
          first_name,
          email,
          email_notifications,
          push_notifications
        )
      `)
      .eq("status", "active")
      .not("next_payout_date", "is", null);

    if (plansError) {
      console.error("Error fetching active plans:", plansError);
      throw plansError;
    }

    console.log(`Found ${activePlans?.length || 0} active plans`);

    if (!activePlans || activePlans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active plans found",
          sent: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const results = [];
    let sentCount = 0;
    let skippedCount = 0;

    for (const plan of activePlans) {
      try {
        const profile = plan.profiles;

        if (!profile || !profile.email) {
          console.log(`Skipping plan ${plan.id} - no profile or email found`);
          skippedCount++;
          continue;
        }

        // Check if user has expiry reminders enabled
        const emailNotifications = profile.email_notifications || { expiry_reminders: true };
        if (!emailNotifications.expiry_reminders) {
          console.log(`Skipping plan ${plan.id} - user has disabled expiry reminders`);
          skippedCount++;
          continue;
        }

        const remainingPayouts = plan.duration - plan.completed_payouts;

        // Only send reminders when:
        // 1. Only 1 payout remaining (most important)
        // 2. 3 payouts remaining
        // 3. 7 payouts remaining
        const shouldSendReminder = remainingPayouts === 1 || remainingPayouts === 3 || remainingPayouts === 7;

        if (!shouldSendReminder) {
          continue;
        }

        // Calculate expiry date estimate
        const today = new Date();
        const nextPayoutDate = new Date(plan.next_payout_date);

        // Estimate based on current payout date and remaining payouts
        // This is approximate - actual expiry depends on frequency
        const daysToExpiry = calculateDaysRemaining(plan.next_payout_date) + (remainingPayouts - 1) * 7; // Assume weekly for estimation
        const expiryDate = new Date(today);
        expiryDate.setDate(expiryDate.getDate() + daysToExpiry);

        const totalPaid = plan.payout_amount * plan.completed_payouts;

        const emailData: ExpiryReminderEmailData = {
          firstName: profile.first_name || 'User',
          planName: plan.name,
          expiryDate: formatDate(expiryDate.toISOString()),
          daysRemaining: Math.max(1, daysToExpiry),
          amount: formatCurrency(plan.payout_amount),
          totalPaid: formatCurrency(totalPaid),
          remainingPayouts: remainingPayouts,
        };

        const subject = remainingPayouts === 1
          ? `Only 1 Payout Remaining - ${plan.name} | Planmoni`
          : `Your Plan "${plan.name}" is Expiring Soon | Planmoni`;

        const html = generateExpiryReminderHtml(emailData);

        await sendEmail(profile.email, subject, html);

        console.log(`Sent expiry reminder for plan ${plan.id} to ${profile.email}`);
        sentCount++;

        // Send push notification (in addition to email) if user has push enabled and plan/payout alerts on
        const pushPrefs = profile.push_notifications || {};
        const pushEnabled = pushPrefs.enabled !== false;
        const planRemindersEnabled = pushPrefs.plan_reminders !== false && pushPrefs.payout_alerts !== false;
        if (pushEnabled && planRemindersEnabled) {
          try {
            const pushTitle = remainingPayouts === 1 ? "One payout remaining!" : "Plan ending soon";
            const pushBody = remainingPayouts === 1
              ? `Only 1 payout left for "${plan.name}". Tap to view plan.`
              : `Only ${remainingPayouts} payouts left for "${plan.name}". Tap to view plan.`;
            const pushResponse = await fetch(
              `${supabaseUrl}/functions/v1/send-push-notification`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseServiceKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  user_ids: [plan.user_id],
                  notification_type: "payout_ready",
                  title: pushTitle,
                  body: pushBody,
                  data: {
                    type: "plan_expiry_reminder",
                    plan_id: plan.id,
                    route: `/view-payout/${plan.id}`,
                    action: "view_plan",
                    remaining_payouts: remainingPayouts,
                    plan_name: plan.name,
                  },
                }),
              }
            );
            if (pushResponse.ok) {
              console.log(`Sent plan-expiry push for plan ${plan.id} to user ${plan.user_id}`);
            } else {
              console.warn(`Push failed for plan ${plan.id}:`, await pushResponse.text());
            }
          } catch (pushErr) {
            console.warn(`Push notification error for plan ${plan.id}:`, pushErr);
          }
        }

        results.push({
          planId: plan.id,
          planName: plan.name,
          email: profile.email,
          remainingPayouts: remainingPayouts,
          status: 'sent',
        });

      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error);
        results.push({
          planId: plan.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Completed: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${activePlans.length} plans`,
        sent: sentCount,
        skipped: skippedCount,
        results: results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error in send-plan-expiry-reminders:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
