import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripe } from "../_shared/collectStripe.ts";

/** Same subset as app lib/stripeInvoiceCurrencies — Stripe Checkout card currencies */
const ALLOWED_CURRENCIES = new Set([
  "usd", "eur", "gbp", "cad", "aud", "nzd", "chf", "sek", "nok", "dkk", "pln", "czk", "huf", "ron", "bgn", "hrk",
  "try", "ils", "aed", "sar", "qar", "hkd", "sgd", "jpy", "krw", "inr", "idr", "myr", "thb", "php", "vnd", "mxn",
  "brl", "clp", "cop", "zar", "ngn", "kes", "ghs", "egp", "mad", "twd", "cny",
]);

const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "huf", "isk", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "twd", "ugx", "vnd", "vuv",
  "xaf", "xof", "xpf",
]);

function stripeDecimals(currency: string): 0 | 2 {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

function toStripeMinorAmount(major: number, currency: string): number {
  const d = stripeDecimals(currency);
  const factor = 10 ** d;
  return Math.round(major * factor + Number.EPSILON);
}

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

  let body: { amount_usd?: number; description?: string; currency?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const currency = String(body.currency ?? "usd").toLowerCase().trim();
  if (!ALLOWED_CURRENCIES.has(currency)) {
    return new Response(JSON.stringify({ error: "Unsupported currency" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const amountMajor = Number(body.amount_usd);
  const description = String(body.description ?? "Payment").slice(0, 500);
  const dec = stripeDecimals(currency);
  const minMajor = dec === 0 ? 1 : 1;
  const maxMajor = 1_000_000;
  if (!Number.isFinite(amountMajor) || amountMajor < minMajor || amountMajor > maxMajor) {
    return new Response(
      JSON.stringify({ error: `amount must be between ${minMajor} and ${maxMajor} in the selected currency` }),
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  }

  const unitAmountMinor = toStripeMinorAmount(amountMajor, currency);
  if (unitAmountMinor < 1) {
    return new Response(JSON.stringify({ error: "Amount too small for this currency" }), {
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
        amount_usd: amountMajor,
        currency,
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
              currency,
              product_data: { name: description },
              unit_amount: unitAmountMinor,
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
