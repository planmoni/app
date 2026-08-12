/**
 * Register or rotate a Bunce customer device token.
 *
 * POST  /customers/{id}/devices  — add a new device (multi-device)
 * PATCH /customers/{id}/devices  — rotate token on an existing device
 *
 * Idempotent: same token already on Bunce or in bunce_customer_devices is a no-op.
 */

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

type Body = {
  device_token?: string
  device_type?: string
  current_device_token?: string | null
}

type BunceDevice = {
  device_id?: string
  device_type?: string
  token?: string
}

function jsonOk(body: Record<string, unknown> = { success: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeDeviceType(raw: string | undefined): 'ios' | 'android' | null {
  const v = (raw || '').toLowerCase().trim()
  if (v === 'ios') return 'ios'
  if (v === 'android') return 'android'
  return null
}

async function bunceFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BUNCE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': BUNCE_API_KEY!,
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

function isAlreadyExists(status: number, json: unknown): boolean {
  if (status === 409) return true
  const msg = JSON.stringify(json || {}).toLowerCase()
  return msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')
}

async function lookupCustomerIdByEmail(email: string): Promise<string | null> {
  const res = await bunceFetch(`/customers?emails=${encodeURIComponent(email)}&per_page=1`)
  const json = (await parseJson(res)) as Record<string, unknown> | null
  const wrapper = json?.data
  const list = Array.isArray(wrapper)
    ? wrapper
    : wrapper && typeof wrapper === 'object'
      ? (wrapper as Record<string, unknown>).data
      : null
  if (!Array.isArray(list) || list.length === 0) return null
  const id = (list[0] as Record<string, unknown>)?.customer_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

async function persistCustomerId(admin: SupabaseClient, userId: string, customerId: string) {
  await admin
    .from('profiles')
    .update({ bunce_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('id', userId)
}

async function listBunceDevices(customerId: string): Promise<BunceDevice[]> {
  const res = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`)
  const json = (await parseJson(res)) as Record<string, unknown> | null
  const data = json?.data
  if (Array.isArray(data)) return data as BunceDevice[]
  return []
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

  try {
    if (!BUNCE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonOk({ success: true, skipped: true })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonOk({ success: true, skipped: true })

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user?.id) return jsonOk({ success: true, skipped: true })

    const admin = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : userClient

    const body = (await req.json().catch(() => ({}))) as Body
    const deviceToken = (body.device_token || '').trim()
    const deviceType = normalizeDeviceType(body.device_type)
    const currentToken = (body.current_device_token || '').trim() || null

    if (!deviceToken || !deviceType) {
      return jsonOk({ success: true, skipped: true, reason: 'invalid_device' })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, bunce_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = (profile?.bunce_customer_id || '').trim() || null
    const email = (profile?.email || user.email || '').trim().toLowerCase()

    if (!customerId && email) {
      customerId = await lookupCustomerIdByEmail(email)
      if (customerId) await persistCustomerId(admin, user.id, customerId)
    }

    if (!customerId) {
      return jsonOk({ success: true, skipped: true, reason: 'no_bunce_customer' })
    }

    const { data: localSame } = await admin
      .from('bunce_customer_devices')
      .select('id, bunce_device_id, device_token')
      .eq('user_id', user.id)
      .eq('device_token', deviceToken)
      .maybeSingle()

    if (localSame) {
      return jsonOk({ success: true, skipped: true, reason: 'already_synced' })
    }

    const remoteDevices = await listBunceDevices(customerId)
    const remoteMatch = remoteDevices.find((d) => (d.token || '').trim() === deviceToken)
    if (remoteMatch) {
      await upsertLocalDevice(admin, {
        user_id: user.id,
        bunce_customer_id: customerId,
        device_type: deviceType,
        device_token: deviceToken,
        bunce_device_id: remoteMatch.device_id ?? null,
      })
      return jsonOk({ success: true, skipped: true, reason: 'already_on_bunce' })
    }

    const shouldRotate =
      Boolean(currentToken) && currentToken !== deviceToken

    if (shouldRotate) {
      const patchRes = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`, {
        method: 'PATCH',
        body: JSON.stringify({
          current_device_token: currentToken,
          device_type: deviceType,
          device_token: deviceToken,
        }),
      })
      const patchJson = await parseJson(patchRes)

      if (patchRes.ok) {
        const data = (patchJson as Record<string, unknown>)?.data as BunceDevice | undefined
        await admin
          .from('bunce_customer_devices')
          .delete()
          .eq('user_id', user.id)
          .eq('device_token', currentToken)
        await upsertLocalDevice(admin, {
          user_id: user.id,
          bunce_customer_id: customerId,
          device_type: deviceType,
          device_token: deviceToken,
          bunce_device_id: data?.device_id ?? null,
        })
        return jsonOk({ success: true, action: 'updated' })
      }

      // Old token gone (reinstall / unknown device) — fall through to add.
      console.warn('Bunce device PATCH failed, falling back to POST:', patchRes.status, patchJson)
    }

    const postRes = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`, {
      method: 'POST',
      body: JSON.stringify({
        devices: [{ device_type: deviceType, device_token: deviceToken }],
      }),
    })
    const postJson = await parseJson(postRes)

    if (postRes.ok || isAlreadyExists(postRes.status, postJson)) {
      const data = (postJson as Record<string, unknown>)?.data
      const created = Array.isArray(data) ? (data[0] as BunceDevice | undefined) : undefined
      await upsertLocalDevice(admin, {
        user_id: user.id,
        bunce_customer_id: customerId,
        device_type: deviceType,
        device_token: deviceToken,
        bunce_device_id: created?.device_id ?? null,
      })
      return jsonOk({
        success: true,
        action: postRes.ok ? 'created' : 'already_exists',
      })
    }

    console.error('Bunce device POST failed:', postRes.status, postJson)
    return jsonOk({ success: true, recorded: true, bunce_status: postRes.status })
  } catch (error) {
    console.error('sync-bunce-device error:', error)
    return jsonOk({ success: true, recorded: true })
  }
})
