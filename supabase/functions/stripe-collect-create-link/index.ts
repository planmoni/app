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

  let body: { amount_usd?: number; description?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const amountUsd = Number(body.amount_usd);
  const description = String(body.description ?? "Payment").slice(0, 500);
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 1_000_000) {
    return new Response(JSON.stringify({ error: "amount_usd must be between 1 and 1000000" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const successUrl = Deno.env.get("STRIPE_CHECKOUT_SUCCESS_URL") ??
    "myapp://collect/success?session_id={CHECKOUT_SESSION_ID}";
  const cancelUrl = Deno.env.get("STRIPE_CHECKOUT_CANCEL_URL") ?? "myapp://collect/cancel";

  try {
    const stripe = getStripe();

    const { data: linkRow, error: linkInsErr } = await supabase
      .from("collect_links")
      .insert({
        user_id: user.id,
        description,
        amount_usd: amountUsd,
        status: "pending",
      })
      .select("id")
      .single();

    if (linkInsErr || !linkRow) {
      console.error(linkInsErr);
      return new Response(JSON.stringify({ error: "Could not create link record" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: description },
              unit_amount: Math.round(amountUsd * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          supabase_user_id: user.id,
          collect_link_id: linkRow.id,
        },
        payment_intent_data: {
          metadata: {
            supabase_user_id: user.id,
            collect_link_id: linkRow.id,
          },
        },
      },
    );

    await supabase
      .from("collect_links")
      .update({
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkRow.id);

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        collect_link_id: linkRow.id,
        stripe_checkout_session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Stripe error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
