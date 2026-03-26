import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VaultEmailType = "vault_fully_funded" | "vault_started";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function utcTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shouldSendVaultEmail(emailNotifications: any | null | undefined): boolean {
  // Default-on. Users can disable by setting { vault_alerts: false }.
  if (!emailNotifications) return true;
  if (typeof emailNotifications !== "object") return true;
  return emailNotifications.vault_alerts !== false;
}

function buildEmailPayload(args: {
  type: VaultEmailType;
  firstName: string;
  vaultName: string;
  totalBudget: number;
  currentBalance: number;
  startDate?: string | null;
}) {
  const firstName = args.firstName || "User";
  const vaultName = args.vaultName || "Your vault";

  if (args.type === "vault_fully_funded") {
    const subject = `Vault funded: ${vaultName} is ready`;
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 24px; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
            .title { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
            .muted { color: #475569; margin: 0 0 16px; }
            .pill { display: inline-block; background: #ecfeff; color: #155e75; border: 1px solid #a5f3fc; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
            .row { margin: 10px 0; }
            .label { color: #64748b; font-size: 12px; margin-bottom: 2px; }
            .value { font-size: 15px; font-weight: 700; }
            .footer { margin-top: 18px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="pill">Vault funded</div>
            <h1 class="title">Hi ${firstName}, your vault is fully funded.</h1>
            <p class="muted">"${vaultName}" is ready to use.</p>

            <div class="row">
              <div class="label">Vault amount</div>
              <div class="value">${formatCurrency(args.totalBudget)}</div>
            </div>
            <div class="row">
              <div class="label">Current balance</div>
              <div class="value">${formatCurrency(args.currentBalance)}</div>
            </div>
            ${args.startDate ? `
              <div class="row">
                <div class="label">Start date</div>
                <div class="value">${formatDate(args.startDate)}</div>
              </div>
            ` : ""}

            <div class="footer">
              This is an automated message, please do not reply to this email.
            </div>
          </div>
        </body>
      </html>
    `;

    return { subject, html };
  }

  const subject = `Your vault starts today: ${vaultName}`;
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
          .muted { color: #475569; margin: 0 0 16px; }
          .pill { display: inline-block; background: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
          .row { margin: 10px 0; }
          .label { color: #64748b; font-size: 12px; margin-bottom: 2px; }
          .value { font-size: 15px; font-weight: 700; }
          .footer { margin-top: 18px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="pill">Vault started</div>
          <h1 class="title">Hi ${firstName}, your vault starts today.</h1>
          <p class="muted">"${vaultName}" is now active.</p>

          <div class="row">
            <div class="label">Vault amount</div>
            <div class="value">${formatCurrency(args.totalBudget)}</div>
          </div>
          <div class="row">
            <div class="label">Current balance</div>
            <div class="value">${formatCurrency(args.currentBalance)}</div>
          </div>

          <div class="footer">
            This is an automated message, please do not reply to this email.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

async function insertPendingLog(args: {
  supabase: any;
  userId: string;
  planId: string;
  type: VaultEmailType;
  toEmail: string;
  subject: string;
}) {
  const { data, error } = await args.supabase
    .from("vault_email_logs")
    .insert({
      user_id: args.userId,
      plan_id: args.planId,
      type: args.type,
      status: "pending",
      to_email: args.toEmail,
      subject: args.subject,
    })
    .select("id")
    .single();

  if (error) {
    // Unique violation -> already processed/scheduled.
    if ((error as any).code === "23505") return { inserted: false as const };
    throw error;
  }

  return { inserted: true as const, logId: data.id as string };
}

async function updateLog(args: {
  supabase: any;
  logId: string;
  status: "sent" | "failed";
  providerResponse?: any;
  errorMessage?: string;
}) {
  const patch: Record<string, any> = {
    status: args.status,
  };

  if (args.status === "sent") {
    patch.sent_at = new Date().toISOString();
  }
  if (args.providerResponse !== undefined) {
    patch.provider_response = args.providerResponse;
  }
  if (args.errorMessage) {
    patch.error_message = args.errorMessage;
  }

  const { error } = await args.supabase
    .from("vault_email_logs")
    .update(patch)
    .eq("id", args.logId);

  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = utcTodayYYYYMMDD();

    // Fetch active vaults with profile data
    const { data: plans, error: plansError } = await supabase
      .from("budget_plans")
      .select(`
        id,
        user_id,
        name,
        total_budget,
        current_balance,
        start_date,
        status,
        profiles!budget_plans_user_id_fkey (
          id,
          first_name,
          email,
          email_notifications
        )
      `)
      .eq("status", "active");

    if (plansError) throw plansError;

    const results: any[] = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const plan of plans || []) {
      const profile = (plan as any).profiles;
      const toEmail = profile?.email;

      if (!toEmail) {
        skipped++;
        continue;
      }

      if (!shouldSendVaultEmail(profile?.email_notifications)) {
        skipped++;
        continue;
      }

      const planId = (plan as any).id as string;
      const userId = (plan as any).user_id as string;
      const vaultName = (plan as any).name as string;
      const totalBudget = Number((plan as any).total_budget || 0);
      const currentBalance = Number((plan as any).current_balance || 0);
      const startDate = (plan as any).start_date as string | null;

      const typesToCheck: VaultEmailType[] = [];

      // 1) Fully funded
      if (totalBudget > 0 && currentBalance >= totalBudget) {
        typesToCheck.push("vault_fully_funded");
      }

      // 2) Vault starts today
      if (startDate && startDate === today) {
        typesToCheck.push("vault_started");
      }

      for (const type of typesToCheck) {
        const { subject, html } = buildEmailPayload({
          type,
          firstName: profile?.first_name || "User",
          vaultName,
          totalBudget,
          currentBalance,
          startDate,
        });

        let logId: string | undefined;

        try {
          const insertRes = await insertPendingLog({
            supabase,
            userId,
            planId,
            type,
            toEmail,
            subject,
          });

          if (!insertRes.inserted) {
            skipped++;
            continue;
          }

          logId = insertRes.logId;

          // Send via existing Resend-backed edge function
          const { data: emailRes, error: emailErr } = await supabase.functions.invoke("send-email", {
            body: { to: toEmail, subject, html },
          });

          if (emailErr || !emailRes?.success) {
            const msg = emailErr?.message || emailRes?.error || "Failed to send email";
            await updateLog({
              supabase,
              logId,
              status: "failed",
              providerResponse: emailRes,
              errorMessage: msg,
            });
            failed++;
            results.push({ planId, type, status: "failed", error: msg });
            continue;
          }

          await updateLog({
            supabase,
            logId,
            status: "sent",
            providerResponse: emailRes,
          });

          sent++;
          results.push({ planId, type, status: "sent", to: toEmail });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          if (logId) {
            try {
              await updateLog({
                supabase,
                logId,
                status: "failed",
                errorMessage: msg,
              });
            } catch {
              // ignore log update errors
            }
          }
          failed++;
          results.push({ planId, type, status: "failed", error: msg });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        processed: plans?.length || 0,
        sent,
        skipped,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-vault-emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

