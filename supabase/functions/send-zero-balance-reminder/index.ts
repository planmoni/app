import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ZERO_BALANCE_DAYS = 3;
const COOLDOWN_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const zeroBalanceCutoff = new Date();
    zeroBalanceCutoff.setDate(zeroBalanceCutoff.getDate() - ZERO_BALANCE_DAYS);
    const zeroBalanceCutoffIso = zeroBalanceCutoff.toISOString();

    const cooldownCutoff = new Date();
    cooldownCutoff.setDate(cooldownCutoff.getDate() - COOLDOWN_DAYS);
    const cooldownCutoffIso = cooldownCutoff.toISOString();

    // Users who have a wallet at zero balance.
    const { data: zeroWallets, error: walletError } = await supabase
      .from("wallets")
      .select("user_id")
      .lte("balance", 0);

    if (walletError) {
      throw walletError;
    }

    const zeroBalanceUserIds = [...new Set((zeroWallets || []).map((w) => w.user_id).filter(Boolean))];
    if (zeroBalanceUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with zero wallet balance",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Eligible if last_seen_at is null or older than 3 days,
    // and reminder has never been sent or cooldown (7 days) elapsed.
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id,last_seen_at,zero_balance_reminder_sent_at")
      .in("id", zeroBalanceUserIds);

    if (profileError) {
      throw profileError;
    }

    const eligibleIds = (profiles || [])
      .filter((p) => {
        const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : null;
        const sentAt = p.zero_balance_reminder_sent_at
          ? new Date(p.zero_balance_reminder_sent_at).getTime()
          : null;
        const passesInactivity = lastSeen === null || lastSeen <= new Date(zeroBalanceCutoffIso).getTime();
        const passesCooldown = sentAt === null || sentAt <= new Date(cooldownCutoffIso).getTime();
        return passesInactivity && passesCooldown;
      })
      .map((p) => p.id);
    if (eligibleIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible users for zero-balance reminder",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const sentUserIds: string[] = [];

    for (const userId of eligibleIds) {
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_ids: [userId],
          notification_type: "deposit_updates",
          title: "Your wallet is empty",
          body: "Add funds to stay on track with your money plans.",
          data: {
            type: "zero_balance_reminder",
            route: "/(tabs)/",
            action: "fund_wallet",
          },
        }),
      });

      if (!pushResponse.ok) {
        failedCount += 1;
        continue;
      }

      const result = await pushResponse.json();
      const userSent = result.sent_count ?? 0;
      sentCount += userSent;
      failedCount += result.failed_count ?? 0;
      if (userSent > 0) {
        sentUserIds.push(userId);
      }
    }

    if (sentUserIds.length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ zero_balance_reminder_sent_at: new Date().toISOString() })
        .in("id", sentUserIds);

      if (updateError) {
        console.warn("Failed to set zero_balance_reminder_sent_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Zero-balance reminder completed",
        eligible: eligibleIds.length,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Zero-balance reminder error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
