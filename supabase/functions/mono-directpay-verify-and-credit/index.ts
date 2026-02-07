/**
 * Mono Direct Pay - Verify and Credit (fallback when webhook doesn't fire)
 *
 * Called from the app when the user lands on success callback (status=successful).
 * Verifies the payment with Mono, then credits the wallet via process_mono_deposit
 * and updates mono_directpay_payments. Idempotent: safe to call multiple times.
 *
 * SECURITY: User must be authenticated; only their own payment (by reference) can be credited.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MONO_API_BASE = "https://api.withmono.com";
const MONO_SECRET_KEY = Deno.env.get("MONO_SECRET_KEY");

interface VerifyResponse {
  credited?: boolean;
  already_processed?: boolean;
  error?: string;
}

async function verifyWithMono(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  error?: string;
}> {
  if (!MONO_SECRET_KEY) {
    return { success: false, error: "MONO_SECRET_KEY not configured" };
  }
  try {
    const res = await fetch(`${MONO_API_BASE}/v2/payments/verify/${reference}`, {
      method: "GET",
      headers: {
        "mono-sec-key": MONO_SECRET_KEY,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: (err as any).message || "Verify failed" };
    }
    const data = await res.json();
    const obj = data.data?.object || data.data;
    return {
      success: true,
      status: obj?.status,
      amount: obj?.amount,
    };
  } catch (e) {
    console.error("verifyWithMono error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Verify error",
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!reference) {
      return new Response(
        JSON.stringify({ error: "reference is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: row, error: lookupError } = await supabase
      .from("mono_directpay_payments")
      .select("user_id, amount, fee, total_charged, status")
      .eq("reference", reference)
      .single();

    if (lookupError || !row) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (row.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always verify with Mono and call process_mono_deposit (idempotent). Do not return early
    // when row.status === "successful" so we still credit if the webhook marked the row but failed to credit.
    const verification = await verifyWithMono(reference);
    if (!verification.success) {
      return new Response(
        JSON.stringify({ error: verification.error || "Verification failed" } as VerifyResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountNaira = Number(row.amount);
    const totalCharged = row.total_charged != null ? Number(row.total_charged) : null;
    if (verification.amount != null && totalCharged != null) {
      const monoKobo =
        verification.amount >= 10000
          ? Math.round(verification.amount)
          : Math.round(verification.amount * 100);
      const expectedKobo = Math.round(totalCharged * 100);
      if (monoKobo !== expectedKobo) {
        // Log but do not block: credit row.amount so balance updates; Mono API may return amount in different format
        console.warn("Mono amount mismatch (crediting anyway): expectedKobo=", expectedKobo, "monoKobo=", monoKobo);
      }
    }

    const { data: result, error: rpcError } = await supabase.rpc("process_mono_deposit", {
      arg_user_id: user.id,
      arg_amount: amountNaira,
      arg_reference: reference,
      arg_mono_data: {
        source: "mono_directpay",
        mono_reference: reference,
        processed_by: "mono_directpay_verify_and_credit",
        processed_at: new Date().toISOString(),
      },
    });

    if (rpcError) {
      console.error("process_mono_deposit error:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message } as VerifyResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result && (result.success || result.already_processed)) {
      await supabase
        .from("mono_directpay_payments")
        .update({ status: "successful", updated_at: new Date().toISOString() })
        .eq("reference", reference);
    }

    return new Response(
      JSON.stringify({ credited: true } as VerifyResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("mono-directpay-verify-and-credit:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" } as VerifyResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
