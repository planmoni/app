import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { computeNgnSettlement, getStripe, loadFxAndFee } from "../_shared/collectStripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripe = getStripe();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing STRIPE_WEBHOOK_SECRET or Supabase env");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (e) {
    console.error("Stripe signature verification failed:", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await supabase
        .from("collect_connected_accounts")
        .update({
          details_submitted: account.details_submitted ?? false,
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", account.id);
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripeAccount = (event as Stripe.Event & { account?: string | null }).account ?? undefined;
      await handleCheckoutCompleted(stripe, supabase, session, stripeAccount);
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeAccount = (event as Stripe.Event & { account?: string | null }).account ?? undefined;
      if (invoice.metadata?.collect_invoice_id) {
        await handleInvoicePaid(stripe, supabase, invoice, stripeAccount);
      }
    }
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  const { error: logErr } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload_summary: { type: event.type, account: (event as any).account ?? null },
  });
  if (logErr) {
    const msg = String(logErr.message ?? "");
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      console.warn("stripe_webhook_events log insert:", logErr);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
});

function stripeAcctOpts(stripeAccount?: string) {
  return stripeAccount ? { stripeAccount } : {};
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  stripeAccount?: string,
) {
  const userId = session.metadata?.supabase_user_id;
  const linkIdRaw = session.metadata?.collect_link_id;
  const linkId = linkIdRaw && String(linkIdRaw).length > 0 ? String(linkIdRaw) : null;
  if (!userId || !session.payment_intent) {
    console.warn("Checkout session missing metadata or payment_intent");
    return;
  }

  const piId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;

  const acct = stripeAcctOpts(stripeAccount);
  const pi = await stripe.paymentIntents.retrieve(piId, acct);
  const latestCharge = pi.latest_charge;
  if (!latestCharge || typeof latestCharge !== "string") {
    console.warn("No charge on payment intent", piId);
    return;
  }

  const charge = await stripe.charges.retrieve(latestCharge, {
    expand: ["balance_transaction"],
  }, acct);

  const bt = charge.balance_transaction as Stripe.BalanceTransaction;
  const usdGross = (session.amount_total ?? 0) / 100;
  const usdStripeFee = bt ? bt.fee / 100 : 0;

  const { rate, feePercent, feeFlat } = await loadFxAndFee(supabase);
  const { usdNet, planmoniFeeNgn, ngnCredited } = computeNgnSettlement(
    usdGross,
    usdStripeFee,
    rate,
    feePercent,
    feeFlat,
  );

  const meta = {
    stripe_checkout_session_id: session.id,
    usd_gross: usdGross,
    usd_stripe_fee: usdStripeFee,
    usd_net: usdNet,
    fx_rate: rate,
    planmoni_fee_ngn: planmoniFeeNgn,
    collect_link_id: linkId,
  };

  const { data: result, error } = await supabase.rpc("finalize_collect_stripe_settlement", {
    p_user_id: userId,
    p_stripe_payment_intent_id: piId,
    p_source_type: "checkout",
    p_usd_gross: usdGross,
    p_usd_stripe_fee: usdStripeFee,
    p_usd_net: usdNet,
    p_fx_rate: rate,
    p_planmoni_fee_ngn: planmoniFeeNgn,
    p_ngn_credited: ngnCredited,
    p_collect_link_id: linkId,
    p_collect_invoice_id: null,
    p_metadata: meta,
  });

  if (error) {
    console.error("finalize_collect_stripe_settlement", error);
    throw error;
  }
  console.log("Collect checkout settled:", result);
}

async function handleInvoicePaid(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  stripeAccount?: string,
) {
  const userId = invoice.metadata?.supabase_user_id;
  const invoiceRowId = invoice.metadata?.collect_invoice_id;
  if (!userId || !invoiceRowId) return;

  const piRef = invoice.payment_intent;
  const piId = typeof piRef === "string" ? piRef : piRef?.id;
  if (!piId) {
    console.warn("invoice.paid without payment_intent");
    return;
  }

  const acct = stripeAcctOpts(stripeAccount);
  const pi = await stripe.paymentIntents.retrieve(piId, acct);
  const latestCharge = pi.latest_charge;
  if (!latestCharge || typeof latestCharge !== "string") return;

  const charge = await stripe.charges.retrieve(latestCharge, {
    expand: ["balance_transaction"],
  }, acct);

  const bt = charge.balance_transaction as Stripe.BalanceTransaction;
  const usdGross = (invoice.amount_paid ?? 0) / 100;
  const usdStripeFee = bt ? bt.fee / 100 : 0;

  const { rate, feePercent, feeFlat } = await loadFxAndFee(supabase);
  const { usdNet, planmoniFeeNgn, ngnCredited } = computeNgnSettlement(
    usdGross,
    usdStripeFee,
    rate,
    feePercent,
    feeFlat,
  );

  const meta = {
    stripe_invoice_id: invoice.id,
    usd_gross: usdGross,
    usd_stripe_fee: usdStripeFee,
    usd_net: usdNet,
    fx_rate: rate,
    planmoni_fee_ngn: planmoniFeeNgn,
    collect_invoice_id: invoiceRowId,
  };

  const { error } = await supabase.rpc("finalize_collect_stripe_settlement", {
    p_user_id: userId,
    p_stripe_payment_intent_id: piId,
    p_source_type: "invoice",
    p_usd_gross: usdGross,
    p_usd_stripe_fee: usdStripeFee,
    p_usd_net: usdNet,
    p_fx_rate: rate,
    p_planmoni_fee_ngn: planmoniFeeNgn,
    p_ngn_credited: ngnCredited,
    p_collect_link_id: null,
    p_collect_invoice_id: invoiceRowId,
    p_metadata: meta,
  });

  if (error) {
    console.error("finalize_collect_stripe_settlement (invoice)", error);
    throw error;
  }
}
