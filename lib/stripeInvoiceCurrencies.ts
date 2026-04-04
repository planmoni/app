/**
 * Currencies Stripe supports for card charges / invoicing (common subset).
 * Labels for UI; codes are lowercase ISO 4217 as Stripe expects.
 * @see https://docs.stripe.com/currencies
 */
export type StripeInvoiceCurrency = {
  code: string;
  label: string;
};

/** Zero-decimal: amount in Stripe API is in whole currency units. */
export const STRIPE_ZERO_DECIMAL = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'huf',
  'isk',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'twd',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

export function stripeCurrencyDecimals(currency: string): 0 | 2 {
  return STRIPE_ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

/** Major units → smallest currency unit (e.g. dollars → cents). */
export function toStripeMinorAmount(major: number, currency: string): number {
  const c = currency.toLowerCase();
  const d = stripeCurrencyDecimals(c);
  const factor = 10 ** d;
  return Math.round(major * factor + Number.EPSILON);
}

export const STRIPE_INVOICE_CURRENCIES: StripeInvoiceCurrency[] = [
  { code: 'usd', label: 'USD — US dollar' },
  { code: 'eur', label: 'EUR — Euro' },
  { code: 'gbp', label: 'GBP — British pound' },
  { code: 'cad', label: 'CAD — Canadian dollar' },
  { code: 'aud', label: 'AUD — Australian dollar' },
  { code: 'nzd', label: 'NZD — New Zealand dollar' },
  { code: 'chf', label: 'CHF — Swiss franc' },
  { code: 'sek', label: 'SEK — Swedish krona' },
  { code: 'nok', label: 'NOK — Norwegian krone' },
  { code: 'dkk', label: 'DKK — Danish krone' },
  { code: 'pln', label: 'PLN — Polish złoty' },
  { code: 'czk', label: 'CZK — Czech koruna' },
  { code: 'huf', label: 'HUF — Hungarian forint' },
  { code: 'ron', label: 'RON — Romanian leu' },
  { code: 'bgn', label: 'BGN — Bulgarian lev' },
  { code: 'hrk', label: 'HRK — Croatian kuna' },
  { code: 'try', label: 'TRY — Turkish lira' },
  { code: 'ils', label: 'ILS — Israeli shekel' },
  { code: 'aed', label: 'AED — UAE dirham' },
  { code: 'sar', label: 'SAR — Saudi riyal' },
  { code: 'qar', label: 'QAR — Qatari riyal' },
  { code: 'hkd', label: 'HKD — Hong Kong dollar' },
  { code: 'sgd', label: 'SGD — Singapore dollar' },
  { code: 'jpy', label: 'JPY — Japanese yen' },
  { code: 'krw', label: 'KRW — South Korean won' },
  { code: 'inr', label: 'INR — Indian rupee' },
  { code: 'idr', label: 'IDR — Indonesian rupiah' },
  { code: 'myr', label: 'MYR — Malaysian ringgit' },
  { code: 'thb', label: 'THB — Thai baht' },
  { code: 'php', label: 'PHP — Philippine peso' },
  { code: 'vnd', label: 'VND — Vietnamese đồng' },
  { code: 'mxn', label: 'MXN — Mexican peso' },
  { code: 'brl', label: 'BRL — Brazilian real' },
  { code: 'clp', label: 'CLP — Chilean peso' },
  { code: 'cop', label: 'COP — Colombian peso' },
  { code: 'zar', label: 'ZAR — South African rand' },
  { code: 'ngn', label: 'NGN — Nigerian naira' },
  { code: 'kes', label: 'KES — Kenyan shilling' },
  { code: 'ghs', label: 'GHS — Ghanaian cedi' },
  { code: 'egp', label: 'EGP — Egyptian pound' },
  { code: 'mad', label: 'MAD — Moroccan dirham' },
  { code: 'twd', label: 'TWD — Taiwan dollar' },
  { code: 'cny', label: 'CNY — Chinese yuan' },
];
