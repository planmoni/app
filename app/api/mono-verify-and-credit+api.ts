/**
 * Mono Direct Pay - Verify and Credit (API route fallback when Edge Function is not deployed)
 *
 * Same behavior as supabase/functions/mono-directpay-verify-and-credit.
 * POST with Authorization: Bearer <session_token> and body: { reference }.
 * Idempotent: safe to call multiple times.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MONO_API_BASE = 'https://api.withmono.com';
// Server-side only; do not use EXPO_PUBLIC_* for secrets
const MONO_SECRET_KEY = process.env.MONO_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jsonResponse(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function verifyWithMono(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  error?: string;
}> {
  if (!MONO_SECRET_KEY) {
    return { success: false, error: 'MONO_SECRET_KEY not configured' };
  }
  try {
    const res = await fetch(`${MONO_API_BASE}/v2/payments/verify/${reference}`, {
      method: 'GET',
      headers: {
        'mono-sec-key': MONO_SECRET_KEY,
        accept: 'application/json',
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: (err as any).message || 'Verify failed' };
    }
    const data = await res.json();
    const obj = data.data?.object || data.data;
    return {
      success: true,
      status: obj?.status,
      amount: obj?.amount,
    };
  } catch (e) {
    console.error('verifyWithMono error:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Verify error' };
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    if (!reference) {
      return jsonResponse({ error: 'reference is required' }, 400);
    }

    const { data: row, error: lookupError } = await supabase
      .from('mono_directpay_payments')
      .select('user_id, amount, fee, total_charged, status')
      .eq('reference', reference)
      .single();

    if (lookupError || !row) {
      return jsonResponse({ error: 'Payment not found' }, 404);
    }

    if (row.user_id !== user.id) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const verification = await verifyWithMono(reference);
    if (!verification.success) {
      return jsonResponse(
        { error: verification.error || 'Verification failed' },
        400
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
        console.warn('Mono amount mismatch (crediting anyway): expectedKobo=', expectedKobo, 'monoKobo=', monoKobo);
      }
    }

    const { data: result, error: rpcError } = await supabase.rpc('process_mono_deposit', {
      arg_user_id: user.id,
      arg_amount: amountNaira,
      arg_reference: reference,
      arg_mono_data: {
        source: 'mono_directpay',
        mono_reference: reference,
        processed_by: 'mono_verify_and_credit_api',
        processed_at: new Date().toISOString(),
      },
    });

    if (rpcError) {
      console.error('process_mono_deposit error:', rpcError);
      return jsonResponse({ error: rpcError.message }, 500);
    }

    if (result && (result.success || result.already_processed)) {
      await supabase
        .from('mono_directpay_payments')
        .update({ status: 'successful', updated_at: new Date().toISOString() })
        .eq('reference', reference);
    }

    return jsonResponse({ credited: true }, 200);
  } catch (err) {
    console.error('mono-verify-and-credit api:', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
}
