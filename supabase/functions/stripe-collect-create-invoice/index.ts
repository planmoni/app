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

  let body: {
    amount_usd?: number;
    description?: string;
    client_email?: string;
    client_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const amountUsd = Number(body.amount_usd);
  const description = String(body.description ?? "Invoice").slice(0, 500);
  const clientEmail = String(body.client_email ?? "").trim();
  const clientName = String(body.client_name ?? "").trim() || undefined;

  if (!clientEmail || !clientEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid client_email required" }), {
      status: 400,
      headers: corsHeaders,
    });
  }
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 1_000_000) {
    return new Response(JSON.stringify({ error: "amount_usd must be between 1 and 1000000" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const stripe = getStripe();

    const { data: invRow, error: invInsErr } = await supabase
      .from("collect_invoices")
      .insert({
        user_id: user.id,
        client_email: clientEmail,
        client_name: clientName ?? null,
        description,
        amount_usd: amountUsd,
        status: "draft",
      })
      .select("id")
      .single();

    if (invInsErr || !invRow) {
      console.error(invInsErr);
      return new Response(JSON.stringify({ error: "Could not create invoice record" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const customer = await stripe.customers.create({
      email: clientEmail,
      name: clientName,
      metadata: { supabase_user_id: user.id, collect_invoice_id: invRow.id },
    });

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 14,
      metadata: {
        supabase_user_id: user.id,
        collect_invoice_id: invRow.id,
      },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amountUsd * 100),
      currency: "usd",
      description,
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    try {
      await stripe.invoices.sendInvoice(finalized.id);
    } catch (sendErr) {
      console.warn("sendInvoice skipped or failed:", sendErr);
    }

    await supabase
      .from("collect_invoices")
      .update({
        stripe_invoice_id: finalized.id,
        stripe_customer_id: customer.id,
        hosted_invoice_url: finalized.hosted_invoice_url,
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invRow.id);

    return new Response(
      JSON.stringify({
        collect_invoice_id: invRow.id,
        hosted_invoice_url: finalized.hosted_invoice_url,
        stripe_invoice_id: finalized.id,
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
