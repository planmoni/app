import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

type BunceAttribute = {
  id: string
  name: string
  data_type: string
}

type Profile = {
  id: string
  email: string | null
  created_at: string | null
  account_verified: boolean | null
  kyc_tier: number | null
  last_seen_at: string | null
}

type PayoutPlan = {
  user_id: string
  created_at: string | null
}

type Txn = {
  user_id: string
  amount: number | string | null
  created_at: string | null
}

type BudgetPlan = {
  user_id: string
  created_at: string | null
  funding_method: string | null
}

type BunceAttributeRow = {
  id: string
  customer_email: string
  value: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const BUNCE_API_KEY = Deno.env.get('BUNCE_API_KEY')

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!BUNCE_API_KEY) throw new Error('BUNCE_API_KEY is required')

function getSupabaseSecretKey(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>
      if (keys['default']) return keys['default']
    } catch {
      // fall through to legacy key
    }
  }

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  throw new Error(
    'No Supabase secret key found. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS with a default key.',
  )
}

const SUPABASE_SECRET_KEY = getSupabaseSecretKey()

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BUNCE_BASE_URL = 'https://api.bunce.so/v1'
const PROFILE_PAGE_SIZE = 500
const USER_ID_CHUNK_SIZE = 80
const BUNCE_WRITE_BATCH_SIZE = 50

const TARGET_ATTRIBUTE_NAMES = [
  'Created_at',
  'account_verified',
  'kyc_tier',
  'last_seen_at',
  'amount_funded',
  'plan_created',
  'has_funded',
  'no_of_plans_created',
  'last_time_plan_created',
  'last_deposit_at',
  'vault_created',
  'last_time_vault_wascreated',
  'funding_method',
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function bunceFetch(path: string, init?: RequestInit, attempts = 4): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BUNCE_BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': BUNCE_API_KEY!,
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

function toNumeric(val: number | string | null | undefined): number {
  if (val == null) return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0
  const parsed = Number(val)
  return Number.isFinite(parsed) ? parsed : 0
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

function toUtcIsoZ(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function formatBunceValue(
  value: string | number | boolean | null | undefined,
  dataType: string,
): string | null {
  if (value == null || value === '') return null

  if (dataType === 'numeric') {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? String(n) : null
  }

  if (dataType === 'timestamp' || dataType === 'date') {
    return typeof value === 'string' ? value : null
  }

  return String(value)
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('Authorization')
  return auth === `Bearer ${SUPABASE_SECRET_KEY}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit_users?: number; dry_run?: boolean }
    const limitUsers = typeof body.limit_users === 'number' && body.limit_users > 0 ? body.limit_users : null
    const dryRun = body.dry_run === true

    const attrsRes = await bunceFetch('/attributes?per_page=100')
    if (!attrsRes.ok) {
      const text = await attrsRes.text()
      return Response.json(
        { error: 'Failed to fetch Bunce attributes', bunce_status: attrsRes.status, details: text },
        { status: 502 },
      )
    }

    const attrsJson = (await attrsRes.json()) as { data?: BunceAttribute[] }
    const attrList = attrsJson.data ?? []

    const attrByName = new Map<string, BunceAttribute>()
    for (const a of attrList) attrByName.set(a.name, a)

    const missingAttributes = TARGET_ATTRIBUTE_NAMES.filter((n) => !attrByName.has(n))
    if (missingAttributes.length > 0) {
      return Response.json(
        {
          error: 'Missing Bunce attributes',
          missing_attributes: missingAttributes,
        },
        { status: 400 },
      )
    }

    const profileRows: Profile[] = []
    let from = 0

    while (true) {
      const to = from + PROFILE_PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,created_at,account_verified,kyc_tier,last_seen_at')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)

      if (error) {
        return Response.json({ error: 'Failed to read profiles', details: error.message }, { status: 500 })
      }

      const chunk = (data ?? []) as Profile[]
      if (chunk.length === 0) break

      profileRows.push(...chunk)
      from += PROFILE_PAGE_SIZE

      if (limitUsers && profileRows.length >= limitUsers) {
        profileRows.splice(limitUsers)
        break
      }

      if (chunk.length < PROFILE_PAGE_SIZE) break
    }

    const userIds = profileRows.map((p) => p.id)

    const planStats = new Map<string, { count: number; last: string | null }>()
    const depositStats = new Map<string, { total: number; last: string | null }>()
    const budgetStats = new Map<string, { exists: boolean; last: string | null; funding_method: string | null }>()

    if (userIds.length > 0) {
      const idChunks = chunkArray(userIds, USER_ID_CHUNK_SIZE)

      for (const ids of idChunks) {
        const { data: plans, error: plansErr } = await supabase
          .from('payout_plans')
          .select('user_id,created_at')
          .in('user_id', ids)

        if (plansErr) {
          console.error('payout_plans query failed:', plansErr)
          return Response.json(
            {
              error: 'Failed to read payout_plans',
              details: plansErr.message,
              code: plansErr.code,
              hint: plansErr.hint,
              chunk_size: ids.length,
            },
            { status: 500 },
          )
        }

        for (const p of (plans ?? []) as PayoutPlan[]) {
          const prev = planStats.get(p.user_id) ?? { count: 0, last: null }
          prev.count += 1
          prev.last = maxIso(prev.last, p.created_at)
          planStats.set(p.user_id, prev)
        }
      }

      for (const ids of idChunks) {
        const { data: txns, error: txnsErr } = await supabase
          .from('transactions')
          .select('user_id,amount,created_at')
          .eq('type', 'deposit')
          .eq('status', 'completed')
          .in('user_id', ids)

        if (txnsErr) {
          return Response.json({ error: 'Failed to read transactions', details: txnsErr.message }, { status: 500 })
        }

        for (const t of (txns ?? []) as Txn[]) {
          const prev = depositStats.get(t.user_id) ?? { total: 0, last: null }
          prev.total += toNumeric(t.amount)
          prev.last = maxIso(prev.last, t.created_at)
          depositStats.set(t.user_id, prev)
        }
      }

      for (const ids of idChunks) {
        const { data: budgets, error: budgetsErr } = await supabase
          .from('budget_plans')
          .select('user_id,created_at,funding_method')
          .in('user_id', ids)

        if (budgetsErr) {
          return Response.json({ error: 'Failed to read budget_plans', details: budgetsErr.message }, { status: 500 })
        }

        for (const b of (budgets ?? []) as BudgetPlan[]) {
          const prev = budgetStats.get(b.user_id) ?? { exists: false, last: null, funding_method: null }
          const newLast = maxIso(prev.last, b.created_at)
          const shouldReplaceFunding = !prev.last || (b.created_at && newLast === b.created_at)

          budgetStats.set(b.user_id, {
            exists: true,
            last: newLast,
            funding_method: shouldReplaceFunding ? (b.funding_method ?? prev.funding_method) : prev.funding_method,
          })
        }
      }
    }

    const payload: BunceAttributeRow[] = []

    for (const p of profileRows) {
      if (!p.email) continue

      const plans = planStats.get(p.id) ?? { count: 0, last: null }
      const deps = depositStats.get(p.id) ?? { total: 0, last: null }
      const budgets = budgetStats.get(p.id) ?? { exists: false, last: null, funding_method: null }

      const values: Record<string, string | number | boolean | null> = {
        Created_at: toUtcIsoZ(p.created_at),
        account_verified: Boolean(p.account_verified),
        kyc_tier: p.kyc_tier ?? 0,
        last_seen_at: toUtcIsoZ(p.last_seen_at),
        amount_funded: deps.total,
        plan_created: plans.count > 0,
        has_funded: deps.total > 0,
        no_of_plans_created: plans.count,
        last_time_plan_created: toUtcIsoZ(plans.last),
        last_deposit_at: toUtcIsoZ(deps.last),
        vault_created: budgets.exists,
        last_time_vault_wascreated: toUtcIsoZ(budgets.last),
        funding_method: budgets.funding_method,
      }

      for (const name of TARGET_ATTRIBUTE_NAMES) {
        const attr = attrByName.get(name)!
        const formatted = formatBunceValue(values[name], attr.data_type)
        if (formatted === null) continue

        payload.push({
          id: attr.id,
          customer_email: p.email,
          value: formatted,
        })
      }
    }

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        users_selected: profileRows.length,
        attributes_per_user: TARGET_ATTRIBUTE_NAMES.length,
        records_prepared: payload.length,
        records_skipped_null: profileRows.length * TARGET_ATTRIBUTE_NAMES.length - payload.length,
      })
    }

    let sent = 0
    for (let i = 0; i < payload.length; i += BUNCE_WRITE_BATCH_SIZE) {
      const slice = payload.slice(i, i + BUNCE_WRITE_BATCH_SIZE)
      const res = await bunceFetch('/attributes/customers', {
        method: 'POST',
        body: JSON.stringify({ attributes: slice }),
      })

      if (!res.ok) {
        const text = await res.text()
        return Response.json(
          {
            error: 'Failed to send attributes to Bunce',
            bunce_status: res.status,
            sent_records: sent,
            failed_batch_start: i,
            failed_batch_size: slice.length,
            details: text,
          },
          { status: 502 },
        )
      }

      sent += slice.length
    }

    return Response.json({
      success: true,
      users_synced: profileRows.length,
      attributes_per_user: TARGET_ATTRIBUTE_NAMES.length,
      records_sent: sent,
    })
  } catch (err) {
    return Response.json(
      { error: 'Unhandled error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
})
