/**
 * Trigger a Bunce engagement event for a customer.
 * Called by DB triggers (service role). Paste this whole file into the dashboard.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const BUNCE_BASE_URL = 'https://api.bunce.so/v1'

type BunceEventKey =
  | 'user_signed_up'
  | 'plan_created'
  | 'wallet_funded'
  | 'plan_completed'
  | 'vault_created'

type BunceCustomerPayload = {
  customer_id: string
  email: string
  first_name?: string
  last_name?: string
  phone_no?: string
  devices?: Array<{ device_type: string; device_token: string }>
}

type Body = {
  event?: string
  user_id?: string
  source_id?: string | null
  extra?: Record<string, string | number | boolean | null | undefined>
}

const EVENT_KEYS = new Set<BunceEventKey>([
  'user_signed_up',
  'plan_created',
  'wallet_funded',
  'plan_completed',
  'vault_created',
])

const EVENT_ENV: Record<BunceEventKey, string> = {
  user_signed_up: 'BUNCE_EVENT_USER_SIGNED_UP',
  plan_created: 'BUNCE_EVENT_PLAN_CREATED',
  wallet_funded: 'BUNCE_EVENT_WALLET_FUNDED',
  plan_completed: 'BUNCE_EVENT_PLAN_COMPLETED',
  vault_created: 'BUNCE_EVENT_VAULT_CREATED',
}

const EVENT_NAME_ALIASES: Record<BunceEventKey, string[]> = {
  user_signed_up: ['user signed up', 'user sign up', 'user signup', 'signed up'],
  plan_created: ['plan is created', 'plan created', 'payout plan created'],
  wallet_funded: ['wallets is funded', 'wallet is funded', 'wallet funded', 'wallets funded'],
  plan_completed: ['plan completed', 'plan is completed', 'payout plan completed'],
  vault_created: ['vault is created', 'vault created'],
}

let eventIdCache: Map<BunceEventKey, string> | null = null
let eventIdCacheAt = 0

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

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+') && cleaned.length >= 11) return cleaned
  if (cleaned.startsWith('234') && cleaned.length >= 13) return `+${cleaned}`
  if (cleaned.startsWith('0') && cleaned.length >= 11) return `+234${cleaned.slice(1)}`
  if (/^\d{10,14}$/.test(cleaned)) return `+${cleaned}`
  return cleaned.length >= 8 ? cleaned : null
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

async function resolveBunceEventId(eventKey: BunceEventKey): Promise<string | null> {
  const fromEnv = (Deno.env.get(EVENT_ENV[eventKey]) || '').trim()
  if (fromEnv) return fromEnv

  const now = Date.now()
  if (!eventIdCache || now - eventIdCacheAt > 10 * 60 * 1000) {
    const res = await bunceFetch('/events?per_page=50')
    const json = (await parseJson(res)) as Record<string, unknown> | null
    if (!res.ok) throw new Error(`Failed to list Bunce events (${res.status})`)
    const rows = unwrapList(json) as Array<{ id: string; name: string }>
    const next = new Map<BunceEventKey, string>()
    const byName = new Map<string, string>()
    for (const row of rows) {
      if (row?.id && row?.name) byName.set(row.name.toLowerCase().replace(/\s+/g, ' ').trim(), row.id)
    }
    for (const key of Object.keys(EVENT_NAME_ALIASES) as BunceEventKey[]) {
      for (const alias of EVENT_NAME_ALIASES[key]) {
        const id = byName.get(alias.toLowerCase().replace(/\s+/g, ' ').trim())
        if (id) {
          next.set(key, id)
          break
        }
      }
    }
    eventIdCache = next
    eventIdCacheAt = now
  }

  return eventIdCache.get(eventKey) ?? null
}

async function triggerBunceEvent(args: {
  eventKey: BunceEventKey
  email: string
  customer: BunceCustomerPayload
  extra?: Record<string, string | number | boolean | null | undefined>
}): Promise<{ ok: boolean; skipped?: boolean; status?: number; body?: unknown; event_id?: string }> {
  const eventId = await resolveBunceEventId(args.eventKey)
  if (!eventId) {
    return { ok: false, skipped: true, body: { error: `No Bunce event id for ${args.eventKey}` } }
  }

  const extra: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(args.extra || {})) {
    if (v == null || v === '') continue
    extra[k] = v
  }

  const post = async (payload: Record<string, unknown>) => {
    const res = await bunceFetch('/events/trigger', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, payload }),
    })
    return { res, body: await parseJson(res) }
  }

  let { res, body } = await post({ email: args.email, customer: args.customer, ...extra })
  if (res.status === 422 && Object.keys(extra).length > 0) {
    const retry = await post({ email: args.email, customer: args.customer })
    res = retry.res
    body = retry.body
  }

  return { ok: res.ok, status: res.status, body, event_id: eventId }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonOk({ error: 'Method not allowed' }, 405)
  }

  const secret = getSupabaseSecretKey()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  let eventKey: BunceEventKey | '' = ''
  let sourceId = ''
  let userId = ''

  try {
    if (!secret || !supabaseUrl) {
      return jsonOk({ success: true, skipped: true, reason: 'missing_env' })
    }

    if (!isAuthorized(req, secret)) {
      return jsonOk({ error: 'Unauthorized' }, 401)
    }

    if (!bunceApiKey()) {
      return jsonOk({ success: true, skipped: true, reason: 'no_bunce_key' })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    eventKey = (body.event || '').trim() as BunceEventKey
    userId = (body.user_id || '').trim()
    sourceId = (body.source_id || userId || '').trim()

    if (!EVENT_KEYS.has(eventKey) || !userId) {
      return jsonOk({ success: true, skipped: true, reason: 'invalid_payload' })
    }

    const admin = createClient(supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (sourceId) {
      const { data: inserted, error: insertErr } = await admin
        .from('bunce_event_deliveries')
        .insert({
          event_key: eventKey,
          source_id: sourceId,
          user_id: userId,
          status: 'pending',
        })
        .select('id')
        .maybeSingle()

      if (insertErr) {
        if (insertErr.code === '23505') {
          return jsonOk({ success: true, skipped: true, reason: 'already_sent' })
        }
        console.error('bunce_event_deliveries insert failed:', insertErr.message)
      }

      if (!inserted && !insertErr) {
        return jsonOk({ success: true, skipped: true, reason: 'already_sent' })
      }
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, bunce_customer_id')
      .eq('id', userId)
      .maybeSingle()

    const email = (profile?.email || '').trim().toLowerCase()
    if (!email) {
      await admin.from('bunce_event_deliveries').delete().eq('event_key', eventKey).eq('source_id', sourceId)
      return jsonOk({ success: true, skipped: true, reason: 'no_email' })
    }

    const { data: kyc } = await admin
      .from('kyc_data')
      .select('phone_number, first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()

    const { data: deviceRows } = await admin
      .from('bunce_customer_devices')
      .select('device_type, device_token')
      .eq('user_id', userId)

    const devices = (deviceRows ?? [])
      .filter((d) => d.device_type && d.device_token)
      .map((d) => ({ device_type: d.device_type as string, device_token: d.device_token as string }))

    const customerId = (profile?.bunce_customer_id || userId).trim()
    const firstName = (profile?.first_name || kyc?.first_name || '').trim()
    const lastName = (profile?.last_name || kyc?.last_name || '').trim()
    const phone = normalizePhone(kyc?.phone_number) || '+2340000000000'

    const result = await triggerBunceEvent({
      eventKey,
      email,
      customer: {
        customer_id: customerId,
        email,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone_no: phone,
        ...(devices.length > 0 ? { devices } : {}),
      },
      extra: body.extra,
    })

    if (!result.ok) {
      await admin.from('bunce_event_deliveries').delete().eq('event_key', eventKey).eq('source_id', sourceId)
      console.error('Bunce event trigger failed:', eventKey, result.status, result.body)
      return jsonOk({
        success: true,
        recorded: true,
        skipped: result.skipped === true,
        bunce_status: result.status ?? null,
      })
    }

    await admin
      .from('bunce_event_deliveries')
      .update({
        status: 'sent',
        bunce_event_id: result.event_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_key', eventKey)
      .eq('source_id', sourceId)

    return jsonOk({ success: true, event: eventKey, event_id: result.event_id })
  } catch (error) {
    console.error('trigger-bunce-event error:', error)
    if (eventKey && sourceId && supabaseUrl && secret) {
      try {
        const admin = createClient(supabaseUrl, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        await admin
          .from('bunce_event_deliveries')
          .delete()
          .eq('event_key', eventKey)
          .eq('source_id', sourceId)
          .eq('status', 'pending')
      } catch {
        // ignore
      }
    }
    return jsonOk({ success: true, recorded: true })
  }
})
