/**
 * Legacy Stripe Connect Express onboarding (per-user connected accounts).
 * Collect now uses the platform Stripe account (Planmoni, Inc.) only; the app does not call this.
 * Kept for optional admin/testing; safe to leave undeployed.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripe } from "../_shared/collectStripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });
  }

  try {
    const stripe = getStripe();
    const refreshUrl = Deno.env.get("STRIPE_CONNECT_REFRESH_URL") ?? "myapp://(tabs)";
    const returnUrl = Deno.env.get("STRIPE_CONNECT_RETURN_URL") ?? "myapp://(tabs)?balanceTab=collect";

    let { data: row } = await supabase
      .from("collect_connected_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    let accountId = row?.stripe_account_id as string | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "NG",
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_user_id: user.id },
      });
      accountId = account.id;

      const { error: insErr } = await supabase.from("collect_connected_accounts").insert({
        user_id: user.id,
        stripe_account_id: accountId,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      });
      if (insErr) {
        console.error(insErr);
        return new Response(JSON.stringify({ error: "Failed to save Connect account" }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: accountLink.url, stripe_account_id: accountId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Connect error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
