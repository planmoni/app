import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export type SupabaseLike = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, v: string) => {
        eq: (a2: string, v2: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
          };
        };
      };
      order: (col: string, o: { ascending: boolean }) => {
        limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
      };
    };
  };
};

export function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
}

/** Stripe zero-decimal currencies (amounts in API use whole units). */
const STRIPE_ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "huf", "isk", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "twd", "ugx", "vnd",
  "vuv", "xaf", "xof", "xpf",
]);

export function stripeCurrencyDecimals(currency: string): 0 | 2 {
  return STRIPE_ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

export function toStripeMinorAmount(major: number, currency: string): number {
  const d = stripeCurrencyDecimals(currency);
  return Math.round(major * 10 ** d + Number.EPSILON);
}

/** Convert Stripe invoice/charge amount_paid (minor units) to major units. */
export function majorFromStripeMinor(amountMinor: number, currency: string): number {
  const d = stripeCurrencyDecimals(currency);
  return amountMinor / 10 ** d;
}

async function loadFeeSchedule(supabase: any) {
  const { data: feeRow, error: feeErr } = await supabase
    .from("collect_fee_schedule")
    .select("fee_percent, fee_flat_ngn")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (feeErr) throw feeErr;
  const feePercent = Number((feeRow as { fee_percent?: number })?.fee_percent ?? 0);
  const feeFlat = Number((feeRow as { fee_flat_ngn?: number })?.fee_flat_ngn ?? 0);
  return { feePercent, feeFlat };
}

export async function loadFxAndFee(supabase: any) {
  const { data: rateRow, error: rateErr } = await supabase
    .from("collect_fx_rates")
    .select("rate")
    .eq("base_currency", "USD")
    .eq("quote_currency", "NGN")
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rateErr) throw rateErr;
  const { feePercent, feeFlat } = await loadFeeSchedule(supabase);
  const rate = Number((rateRow as { rate?: number })?.rate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("collect_fx_rates missing or invalid; seed USD→NGN rate in DB");
  }
  return { rate, feePercent, feeFlat };
}

/** FX from invoice currency → NGN (same table as USD; add rows per currency as needed). */
export async function loadFxAndFeeForInvoiceCurrency(supabase: any, invoiceCurrency: string) {
  const base = String(invoiceCurrency ?? "usd").toUpperCase();
  const { data: rateRow, error: rateErr } = await supabase
    .from("collect_fx_rates")
    .select("rate")
    .eq("base_currency", base)
    .eq("quote_currency", "NGN")
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rateErr) throw rateErr;
  const { feePercent, feeFlat } = await loadFeeSchedule(supabase);
  const rate = Number((rateRow as { rate?: number })?.rate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `collect_fx_rates missing ${base}→NGN rate; insert e.g. insert into collect_fx_rates (base_currency, quote_currency, rate) values ('${base}', 'NGN', <rate>);`,
    );
  }
  return { rate, feePercent, feeFlat, base };
}

export function computeNgnSettlement(
  usdGross: number,
  usdStripeFee: number,
  rate: number,
  feePercent: number,
  feeFlat: number,
) {
  const usdNet = Math.max(0, usdGross - usdStripeFee);
  const ngnPre = usdNet * rate;
  const planmoniFeeNgn = (ngnPre * feePercent) / 100 + feeFlat;
  const ngnCredited = Math.max(0, Math.round((ngnPre - planmoniFeeNgn) * 100) / 100);
  return { usdNet, ngnPre, planmoniFeeNgn, ngnCredited };
}
