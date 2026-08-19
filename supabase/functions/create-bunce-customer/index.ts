import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const BUNCE_BASE_URL = 'https://api.bunce.so/v1'
const BUNCE_API_KEY = Deno.env.get('BUNCE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

type CreateBody = {
  userId?: string
  email?: string
  first_name?: string
  last_name?: string
  phone_no?: string | null
  devices?: Array<{ device_type: string; device_token: string }> | null
}

function jsonOk(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

function extractCustomerId(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const id = (data as Record<string, unknown>).customer_id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

async function persistBunceCustomerId(
  admin: SupabaseClient | null,
  userId: string,
  customerId: string,
) {
  if (!admin) return
  const { error } = await admin
    .from('profiles')
    .update({ bunce_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) console.error('Failed to persist bunce_customer_id:', error.message)
}

function toUtcIsoZ(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
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

async function triggerUserSignedUpEvent(args: {
  email: string
  customer_id: string
  first_name: string | null
  last_name: string | null
  phone_no: string | null
}): Promise<{ ok: boolean; skipped?: boolean; status?: number; body?: unknown; event_id?: string }> {
  if (!BUNCE_API_KEY) return { ok: false, skipped: true }

  const eventIdEnv = (Deno.env.get('BUNCE_EVENT_USER_SIGNED_UP') || '').trim()
  let eventId = eventIdEnv || 'a23218a6-4e10-49f7-a656-a521dae23fca'

  if (!eventId) {
    const listRes = await fetch(`${BUNCE_BASE_URL}/events?per_page=50`, {
      headers: { 'X-Authorization': BUNCE_API_KEY, Accept: 'application/json' },
    })
    const listJson = await listRes.json().catch(() => null)
    const rows = unwrapList(listJson) as Array<{ id: string; name: string }>
    const aliases = [
      'user_signed_up',
      'user signed up',
      'user sign up',
      'user signup',
      'signed up',
    ]
    for (const row of rows) {
      const name = (row?.name || '').toLowerCase().replace(/\s+/g, ' ').trim()
      if (aliases.includes(name)) {
        eventId = row.id
        break
      }
    }
  }

  if (!eventId) return { ok: false, skipped: true, body: { error: 'No Bunce event id for user_signed_up' } }

  const payload = {
    email: args.email,
    customer: {
      email: args.email,
      first_name: args.first_name || undefined,
      last_name: args.last_name || undefined,
      phone_no: args.phone_no || undefined,
    },
    'First name': args.first_name || 'User',
    'Last name': args.last_name || 'Customer',
    Date: toUtcIsoZ(new Date()),
  }

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`${BUNCE_BASE_URL}/events/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': BUNCE_API_KEY!,
      },
      body: JSON.stringify({ event_id: eventId, payload: body }),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    return { res, json }
  }

  let { res, json } = await post(payload)
  if (res.status === 422) {
    const retry = await post({ email: args.email, customer: payload.customer })
    res = retry.res
    json = retry.json
  }

  return { ok: res.ok, status: res.status, body: json, event_id: eventId }
}

async function lookupBunceCustomerIdByEmail(email: string): Promise<string | null> {
  if (!BUNCE_API_KEY) return null
  try {
    const res = await fetch(
      `${BUNCE_BASE_URL}/customers?emails=${encodeURIComponent(email)}&per_page=1`,
      { headers: { 'X-Authorization': BUNCE_API_KEY, 'Content-Type': 'application/json' } },
    )
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const wrapper = json?.data
    const list = Array.isArray(wrapper)
      ? wrapper
      : wrapper && typeof wrapper === 'object'
        ? (wrapper as Record<string, unknown>).data
        : null
    if (!Array.isArray(list) || list.length === 0) return null
    const id = (list[0] as Record<string, unknown>)?.customer_id
    return typeof id === 'string' && id.trim() ? id.trim() : null
  } catch (e) {
    console.error('Bunce customer lookup failed:', e)
    return null
  }
}

async function fireUserSignedUp(
  admin: SupabaseClient | null,
  args: {
    userId: string | null
    email: string | null
    first_name: string | null
    last_name: string | null
    phone_no: string | null
    customer_id: string | null
  },
) {
  if (!admin || !args.userId || !args.email || !args.customer_id) return
  try {
    const { error } = await admin.from('bunce_event_deliveries').insert({
      event_key: 'user_signed_up',
      source_id: args.userId,
      user_id: args.userId,
      status: 'pending',
    })
    if (error?.code === '23505') return
    if (error) console.error('bunce_event_deliveries insert failed:', error.message)

    const result = await triggerUserSignedUpEvent({
      email: args.email,
      customer_id: args.customer_id,
      first_name: args.first_name,
      last_name: args.last_name,
      phone_no: args.phone_no,
    })

    if (result.ok) {
      await admin
        .from('bunce_event_deliveries')
        .update({
          status: 'sent',
          bunce_event_id: result.event_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('event_key', 'user_signed_up')
        .eq('source_id', args.userId)
    } else {
      await admin
        .from('bunce_event_deliveries')
        .delete()
        .eq('event_key', 'user_signed_up')
        .eq('source_id', args.userId)
      console.error('Bunce user_signed_up failed:', result.status, result.body)
    }
  } catch (e) {
    try {
      await admin
        .from('bunce_event_deliveries')
        .delete()
        .eq('event_key', 'user_signed_up')
        .eq('source_id', args.userId)
        .eq('status', 'pending')
    } catch {
      // ignore
    }
    console.error('fireUserSignedUp failed:', e)
  }
}

async function recordBunceError(
  admin: SupabaseClient | null,
  row: {
    user_id?: string | null
    email?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_no?: string | null
    error_message: string
    bunce_status?: number | null
    request_payload?: Record<string, unknown> | null
    response_body?: unknown
  },
) {
  if (!admin) {
    console.error('bunce_customer_errors (no admin client):', row.error_message)
    return
  }
  try {
    const { error } = await admin.from('bunce_customer_errors').insert({
      user_id: row.user_id ?? null,
      email: row.email ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      phone_no: row.phone_no ?? null,
      error_message: row.error_message,
      bunce_status: row.bunce_status ?? null,
      request_payload: row.request_payload ?? null,
      response_body: row.response_body ?? null,
    })
    if (error) console.error('Failed to insert bunce_customer_errors:', error.message)
  } catch (e) {
    console.error('Failed to insert bunce_customer_errors:', e)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  // Always return a calm 200 to the app — never surface Bunce failures to users.
  let admin: SupabaseClient | null = null
  let userId: string | null = null
  let email: string | null = null
  let first_name: string | null = null
  let last_name: string | null = null
  let phone_no: string | null = null
  let payload: Record<string, unknown> | null = null

  try {
    if (!BUNCE_API_KEY) {
      await recordBunceError(null, { error_message: 'BUNCE_API_KEY is not configured' })
      return jsonOk({ success: true, recorded: true, skipped: true })
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      await recordBunceError(null, { error_message: 'Supabase env missing' })
      return jsonOk({ success: true, recorded: true, skipped: true })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      // Auth missing — still silent to client caller if any
      return jsonOk({ success: true, skipped: true })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user?.id) {
      return jsonOk({ success: true, skipped: true })
    }

    admin = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

    const body = (await req.json().catch(() => ({}))) as CreateBody
    userId = body.userId || user.id

    if (userId !== user.id) {
      await recordBunceError(admin, {
        user_id: user.id,
        error_message: 'userId does not match session',
      })
      return jsonOk({ success: true, recorded: true, skipped: true })
    }

    const db = admin ?? userClient

    const { data: profile } = await db
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    const { data: kyc } = await db
      .from('kyc_data')
      .select('phone_number')
      .eq('user_id', userId)
      .maybeSingle()

    first_name = (body.first_name || profile?.first_name || user.user_metadata?.first_name || '').trim()
    last_name = (body.last_name || profile?.last_name || user.user_metadata?.last_name || '').trim()
    email = (body.email || profile?.email || user.email || '').trim().toLowerCase()

    if (!first_name || !last_name) {
      await recordBunceError(admin, {
        user_id: userId,
        email,
        first_name,
        last_name,
        error_message: 'first_name and last_name are required',
      })
      return jsonOk({ success: true, recorded: true, skipped: true })
    }

    if (!email) {
      await recordBunceError(admin, {
        user_id: userId,
        first_name,
        last_name,
        error_message: 'email is required for Bunce customer',
      })
      return jsonOk({ success: true, recorded: true, skipped: true })
    }

    phone_no =
      normalizePhone(body.phone_no) ||
      normalizePhone(kyc?.phone_number) ||
      '+2340000000000'

    payload = {
      customer_id: userId,
      email,
      first_name,
      last_name,
      phone_no,
    }
    if (Array.isArray(body.devices) && body.devices.length > 0) {
      payload.devices = body.devices.filter((d) => d?.device_type && d?.device_token)
    }

    const bunceRes = await fetch(`${BUNCE_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': BUNCE_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const text = await bunceRes.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }

    if (!bunceRes.ok) {
      const lower = text.toLowerCase()
      if (
        bunceRes.status === 409 ||
        lower.includes('already') ||
        lower.includes('exists') ||
        lower.includes('duplicate')
      ) {
        const existingId = await lookupBunceCustomerIdByEmail(email)
        if (existingId) await persistBunceCustomerId(admin, userId, existingId)
        await fireUserSignedUp(admin, {
          userId: userId,
          email,
          first_name,
          last_name,
          phone_no: phone_no || '+2340000000000',
          customer_id: existingId || userId,
        })
        return jsonOk({
          success: true,
          skipped: true,
          message: 'Customer already exists in Bunce',
        })
      }

      await recordBunceError(admin, {
        user_id: userId,
        email,
        first_name,
        last_name,
        phone_no,
        error_message: `Bunce create failed (${bunceRes.status}): ${text.slice(0, 2000)}`,
        bunce_status: bunceRes.status,
        request_payload: payload,
        response_body: json,
      })
      return jsonOk({ success: true, recorded: true })
    }

    const createdId = extractCustomerId(json) || userId
    await persistBunceCustomerId(admin, userId, createdId)
    await fireUserSignedUp(admin, {
      userId: userId,
      email,
      first_name,
      last_name,
      phone_no: phone_no || '+2340000000000',
      customer_id: createdId,
    })
    console.log('Bunce customer created for', email, createdId)
    return jsonOk({ success: true, customer_id: createdId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('create-bunce-customer error:', message)
    await recordBunceError(admin, {
      user_id: userId,
      email,
      first_name,
      last_name,
      phone_no,
      error_message: message,
      request_payload: payload,
    })
    return jsonOk({ success: true, recorded: true })
  }
})
