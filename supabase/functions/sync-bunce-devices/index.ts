/**
 * Cron: backfill / refresh Bunce devices from stored push tokens.
 * Paste this whole file into the dashboard. Verify JWT = ON.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const BUNCE_BASE_URL = 'https://api.bunce.so/v1'
const BATCH_LIMIT = 50

type TokenRow = {
  user_id: string
  device_token: string
  device_type: 'ios' | 'android'
  bunce_customer_id: string | null
  email: string | null
}

type BunceDevice = {
  device_id?: string
  device_type?: string
  token?: string
}

function jsonOk(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSupabaseSecretKey(): string | null {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>
      if (keys['default']) return keys['default']
    } catch {
      // fall through
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null
}

function isAuthorized(req: Request, secret: string): boolean {
  const auth = req.headers.get('Authorization')
  return auth === `Bearer ${secret}`
}

function bunceApiKey(): string | undefined {
  return Deno.env.get('BUNCE_API_KEY')
}

function normalizeDeviceType(raw: string | undefined | null): 'ios' | 'android' | null {
  const v = (raw || '').toLowerCase().trim()
  if (v === 'ios') return 'ios'
  if (v === 'android') return 'android'
  return null
}

function unwrapList(json: unknown): unknown[] {
  if (!json || typeof json !== 'object') return []
  const root = json as Record<string, unknown>
  const data = root.data
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const inner = (data as Record<string, unknown>).data
    if (Array.isArray(inner)) return inner
  }
  return []
}

function isAlreadyExists(status: number, json: unknown): boolean {
  if (status === 409) return true
  const msg = JSON.stringify(json || {}).toLowerCase()
  return msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')
}

async function bunceFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = bunceApiKey()
  if (!key) throw new Error('BUNCE_API_KEY is not configured')
  return fetch(`${BUNCE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Authorization': key,
      ...(init?.headers || {}),
    },
  })
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

async function listBunceDevices(customerId: string): Promise<BunceDevice[]> {
  const res = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`)
  return unwrapList(await parseJson(res)) as BunceDevice[]
}

async function lookupCustomerIdByEmail(email: string): Promise<string | null> {
  const res = await bunceFetch(`/customers?emails=${encodeURIComponent(email)}&per_page=1`)
  const list = unwrapList(await parseJson(res))
  if (list.length === 0) return null
  const id = (list[0] as Record<string, unknown>)?.customer_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

async function addBunceDevice(
  customerId: string,
  deviceType: 'ios' | 'android',
  deviceToken: string,
): Promise<{ ok: boolean; device?: BunceDevice; status: number }> {
  const res = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`, {
    method: 'POST',
    body: JSON.stringify({
      devices: [{ device_type: deviceType, device_token: deviceToken }],
    }),
  })
  const body = await parseJson(res)
  const data = (body as Record<string, unknown> | null)?.data
  const created = Array.isArray(data) ? (data[0] as BunceDevice | undefined) : undefined
  return { ok: res.ok || isAlreadyExists(res.status, body), device: created, status: res.status }
}

async function persistCustomerId(admin: SupabaseClient, userId: string, customerId: string) {
  await admin
    .from('profiles')
    .update({ bunce_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('id', userId)
}

async function upsertLocalDevice(
  admin: SupabaseClient,
  row: {
    user_id: string
    bunce_customer_id: string
    device_type: 'ios' | 'android'
    device_token: string
    bunce_device_id?: string | null
  },
) {
  const { error } = await admin.from('bunce_customer_devices').upsert(
    {
      user_id: row.user_id,
      bunce_customer_id: row.bunce_customer_id,
      device_type: row.device_type,
      device_token: row.device_token,
      bunce_device_id: row.bunce_device_id ?? null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_token' },
  )
  if (error) console.error('bunce_customer_devices upsert failed:', error.message)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonOk({ error: 'Method not allowed' }, 405)
  }

  try {
    const secret = getSupabaseSecretKey()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!secret || !supabaseUrl) {
      return jsonOk({ success: true, skipped: true, reason: 'missing_env' })
    }

    if (!isAuthorized(req, secret)) {
      return jsonOk({ error: 'Unauthorized' }, 401)
    }

    if (!bunceApiKey()) {
      return jsonOk({ success: true, skipped: true, reason: 'no_bunce_key' })
    }

    const admin = createClient(supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = (await req.json().catch(() => ({}))) as { limit?: number }
    const limit =
      typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 200) : BATCH_LIMIT

    const { data: pendingRows, error: pendingErr } = await admin.rpc('get_pending_bunce_device_tokens', {
      p_limit: limit,
    })

    if (pendingErr) {
      return jsonOk({ error: 'Failed to load pending devices', details: pendingErr.message }, 500)
    }

    const missing: TokenRow[] = []
    for (const row of pendingRows ?? []) {
      const type = normalizeDeviceType(row.device_type)
      const token = (row.device_token || '').trim()
      if (!type || !token) continue
      missing.push({
        user_id: row.user_id,
        device_token: token,
        device_type: type,
        bunce_customer_id: row.bunce_customer_id ?? null,
        email: row.email ?? null,
      })
    }

    if (missing.length === 0) {
      return jsonOk({ success: true, considered: 0, synced: 0, skipped: 0 })
    }

    let synced = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of missing) {
      try {
        let customerId = (row.bunce_customer_id || '').trim() || null
        const email = (row.email || '').trim().toLowerCase()

        if (!customerId && email) {
          customerId = await lookupCustomerIdByEmail(email)
          if (customerId) await persistCustomerId(admin, row.user_id, customerId)
        }

        if (!customerId) {
          skipped += 1
          continue
        }

        const remote = await listBunceDevices(customerId)
        const remoteMatch = remote.find((d) => (d.token || '').trim() === row.device_token)
        if (remoteMatch) {
          await upsertLocalDevice(admin, {
            user_id: row.user_id,
            bunce_customer_id: customerId,
            device_type: row.device_type,
            device_token: row.device_token,
            bunce_device_id: remoteMatch.device_id ?? null,
          })
          synced += 1
          continue
        }

        const posted = await addBunceDevice(customerId, row.device_type, row.device_token)
        if (posted.ok) {
          await upsertLocalDevice(admin, {
            user_id: row.user_id,
            bunce_customer_id: customerId,
            device_type: row.device_type,
            device_token: row.device_token,
            bunce_device_id: posted.device?.device_id ?? null,
          })
          synced += 1
        } else {
          errors.push(`${row.user_id}:${posted.status}`)
        }
      } catch (err) {
        errors.push(`${row.user_id}:${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return jsonOk({
      success: true,
      considered: missing.length,
      attempted: missing.length,
      synced,
      skipped,
      errors: errors.slice(0, 20),
    })
  } catch (error) {
    console.error('sync-bunce-devices error:', error)
    return jsonOk(
      { error: 'Unhandled error', details: error instanceof Error ? error.message : String(error) },
      500,
    )
  }
})
