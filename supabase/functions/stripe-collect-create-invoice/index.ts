import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripe, stripeCurrencyDecimals, toStripeMinorAmount } from "../_shared/collectStripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Lowercase codes accepted for invoicing (subset of Stripe charge currencies). */
const ALLOWED_CURRENCIES = new Set([
  "usd", "eur", "gbp", "cad", "aud", "nzd", "chf", "sek", "nok", "dkk", "pln", "czk", "huf", "ron",
  "bgn", "hrk", "try", "ils", "aed", "sar", "qar", "hkd", "sgd", "jpy", "krw", "inr", "idr", "myr",
  "thb", "php", "vnd", "mxn", "brl", "clp", "cop", "zar", "ngn", "kes", "ghs", "egp", "mad", "twd",
  "cny",
]);

type LineIn = { description?: string; quantity?: number; unit_amount?: number };

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
    client_email?: string;
    client_name?: string;
    currency?: string;
    due_at?: string;
    line_items?: LineIn[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const clientEmail = String(body.client_email ?? "").trim();
  const clientName = String(body.client_name ?? "").trim() || undefined;
  const currency = String(body.currency ?? "usd").trim().toLowerCase();
  const dueRaw = body.due_at ? String(body.due_at) : "";
  const linesIn = Array.isArray(body.line_items) ? body.line_items : [];

  if (!clientEmail || !clientEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid client_email required" }), {
      status: 400,
      headers: corsHeaders,
    });
  }
  if (!ALLOWED_CURRENCIES.has(currency)) {
    return new Response(JSON.stringify({ error: "Unsupported currency" }), { status: 400, headers: corsHeaders });
  }
  if (linesIn.length < 1 || linesIn.length > 50) {
    return new Response(JSON.stringify({ error: "Provide 1–50 line items" }), { status: 400, headers: corsHeaders });
  }

  const lines: { description: string; quantity: number; unit_amount: number }[] = [];
  let totalMajor = 0;
  for (const raw of linesIn) {
    const description = String(raw.description ?? "").trim().slice(0, 500);
    const quantity = Math.floor(Number(raw.quantity));
    const unitAmount = Number(raw.unit_amount);
    if (!description) {
      return new Response(JSON.stringify({ error: "Each line needs a description" }), { status: 400, headers: corsHeaders });
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999_999) {
      return new Response(JSON.stringify({ error: "Invalid quantity on a line" }), { status: 400, headers: corsHeaders });
    }
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return new Response(JSON.stringify({ error: "Each line needs a positive unit amount" }), { status: 400, headers: corsHeaders });
    }
    const lineTotal = unitAmount * quantity;
    totalMajor += lineTotal;
    lines.push({ description, quantity, unit_amount: unitAmount });
  }

  const d = stripeCurrencyDecimals(currency);
  const minMajor = d === 0 ? 1 : 0.01;
  if (totalMajor < minMajor || totalMajor > 1_000_000_000) {
    return new Response(JSON.stringify({ error: "Invoice total out of allowed range" }), { status: 400, headers: corsHeaders });
  }

  let dueAt: Date;
  if (dueRaw) {
    dueAt = new Date(dueRaw);
    if (Number.isNaN(dueAt.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid due_at" }), { status: 400, headers: corsHeaders });
    }
  } else {
    dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 14);
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (dueAt.getTime() < startOfToday.getTime()) {
    return new Response(JSON.stringify({ error: "Due date must be today or later" }), { status: 400, headers: corsHeaders });
  }

  const summaryDescription = lines.length === 1
    ? lines[0].description
    : `${lines[0].description}${lines.length > 1 ? ` (+${lines.length - 1} more)` : ""}`.slice(0, 500);

  try {
    const stripe = getStripe();

    const { data: invRow, error: invInsErr } = await supabase
      .from("collect_invoices")
      .insert({
        user_id: user.id,
        client_email: clientEmail,
        client_name: clientName ?? null,
        description: summaryDescription,
        amount_usd: totalMajor,
        currency,
        due_at: dueAt.toISOString(),
        line_items: lines,
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

    const dueTs = Math.floor(dueAt.getTime() / 1000);

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      due_date: dueTs,
      metadata: {
        supabase_user_id: user.id,
        collect_invoice_id: invRow.id,
      },
    });

    for (const line of lines) {
      const unitMinor = toStripeMinorAmount(line.unit_amount, currency);
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        currency,
        unit_amount: unitMinor,
        quantity: line.quantity,
        description: line.description,
      });
    }

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
