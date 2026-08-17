/**
 * Shared Bunce API helpers for customer, device, event, and attribute calls.
 */

export const BUNCE_BASE_URL = 'https://api.bunce.so/v1'

export type BunceEventKey =
  | 'user_signed_up'
  | 'plan_created'
  | 'wallet_funded'
  | 'plan_completed'
  | 'vault_created'

export type BunceDevice = {
  device_id?: string
  device_type?: string
  token?: string
}

export type BunceCustomerPayload = {
  customer_id: string
  email: string
  first_name?: string
  last_name?: string
  phone_no?: string
  devices?: Array<{ device_type: string; device_token: string }>
}

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

type BunceEventRow = {
  id: string
  name: string
}

let eventIdCache: Map<BunceEventKey, string> | null = null
let eventIdCacheAt = 0
const EVENT_CACHE_MS = 10 * 60 * 1000

export function bunceApiKey(): string | undefined {
  return Deno.env.get('BUNCE_API_KEY')
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function normalizePhone(raw: string | null | undefined): string | null {
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

export function normalizeDeviceType(raw: string | undefined | null): 'ios' | 'android' | null {
  const v = (raw || '').toLowerCase().trim()
  if (v === 'ios') return 'ios'
  if (v === 'android') return 'android'
  return null
}

export function toUtcIsoZ(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function bunceFetch(path: string, init?: RequestInit, attempts = 4): Promise<Response> {
  const key = bunceApiKey()
  if (!key) throw new Error('BUNCE_API_KEY is not configured')

  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BUNCE_BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Authorization': key,
          ...(init?.headers || {}),
        },
      })

      if (res.status === 429 || res.status >= 500) {
        if (i < attempts - 1) {
          await sleep(500 * Math.pow(2, i))
          continue
        }
      }

      return res
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await sleep(500 * Math.pow(2, i))
        continue
      }
    }
  }
  throw new Error(`Bunce request failed: ${String(lastErr)}`)
}

export async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

export function isAlreadyExists(status: number, json: unknown): boolean {
  if (status === 409) return true
  const msg = JSON.stringify(json || {}).toLowerCase()
  return msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')
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

export async function listBunceDevices(customerId: string): Promise<BunceDevice[]> {
  const res = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`)
  const json = await parseJson(res)
  return unwrapList(json) as BunceDevice[]
}

export async function lookupCustomerIdByEmail(email: string): Promise<string | null> {
  const res = await bunceFetch(`/customers?emails=${encodeURIComponent(email)}&per_page=1`)
  const json = await parseJson(res)
  const list = unwrapList(json)
  if (list.length === 0) return null
  const id = (list[0] as Record<string, unknown>)?.customer_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function normalizeEventName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

async function fetchAllBunceEvents(): Promise<BunceEventRow[]> {
  const events: BunceEventRow[] = []
  let cursor: string | null = null

  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ per_page: '50' })
    if (cursor) qs.set('cursor', cursor)
    const res = await bunceFetch(`/events?${qs.toString()}`)
    const json = (await parseJson(res)) as Record<string, unknown> | null
    if (!res.ok) {
      throw new Error(`Failed to list Bunce events (${res.status}): ${JSON.stringify(json)}`)
    }
    const rows = unwrapList(json) as BunceEventRow[]
    events.push(...rows.filter((e) => e?.id && e?.name))

    const meta = json?.meta as Record<string, unknown> | undefined
    if (!meta?.has_next_page) break
    cursor = typeof meta.next_page_cursor === 'string' ? meta.next_page_cursor : null
    if (!cursor) break
  }

  return events
}

export async function resolveBunceEventId(eventKey: BunceEventKey): Promise<string | null> {
  const envName = EVENT_ENV[eventKey]
  const fromEnv = (Deno.env.get(envName) || '').trim()
  if (fromEnv) return fromEnv

  const now = Date.now()
  if (!eventIdCache || now - eventIdCacheAt > EVENT_CACHE_MS) {
    const rows = await fetchAllBunceEvents()
    const next = new Map<BunceEventKey, string>()
    const byName = new Map<string, string>()
    for (const row of rows) byName.set(normalizeEventName(row.name), row.id)

    for (const key of Object.keys(EVENT_NAME_ALIASES) as BunceEventKey[]) {
      for (const alias of EVENT_NAME_ALIASES[key]) {
        const id = byName.get(normalizeEventName(alias))
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

export async function triggerBunceEvent(args: {
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

  const payloadFull = {
    email: args.email,
    customer: args.customer,
    ...extra,
  }

  const post = async (payload: Record<string, unknown>) => {
    const res = await bunceFetch('/events/trigger', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, payload }),
    })
    const body = await parseJson(res)
    return { res, body }
  }

  let { res, body } = await post(payloadFull)

  // Unknown extra parameters can 422; retry with identity fields only.
  if (res.status === 422 && Object.keys(extra).length > 0) {
    const retry = await post({ email: args.email, customer: args.customer })
    res = retry.res
    body = retry.body
  }

  return { ok: res.ok, status: res.status, body, event_id: eventId }
}

export async function addBunceDevice(
  customerId: string,
  deviceType: 'ios' | 'android',
  deviceToken: string,
): Promise<{ ok: boolean; already: boolean; device?: BunceDevice; status: number; body: unknown }> {
  const res = await bunceFetch(`/customers/${encodeURIComponent(customerId)}/devices`, {
    method: 'POST',
    body: JSON.stringify({
      devices: [{ device_type: deviceType, device_token: deviceToken }],
    }),
  })
  const body = await parseJson(res)
  const already = isAlreadyExists(res.status, body)
  const data = (body as Record<string, unknown> | null)?.data
  const created = Array.isArray(data) ? (data[0] as BunceDevice | undefined) : undefined
  return { ok: res.ok || already, already, device: created, status: res.status, body }
}
