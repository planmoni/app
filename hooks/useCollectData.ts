import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type CollectLinkRow = {
  id: string;
  description: string;
  amount_usd: number;
  status: string;
  checkout_url: string | null;
  created_at: string;
};

export type CollectInvoiceRow = {
  id: string;
  client_email: string;
  client_name: string | null;
  description: string;
  amount_usd: number;
  currency: string | null;
  status: string;
  hosted_invoice_url: string | null;
  created_at: string;
};

export type CollectSettlementRow = {
  id: string;
  usd_gross: number;
  ngn_credited: number;
  created_at: string;
  source_type: string;
  metadata: Record<string, unknown> | null;
};

export type CollectDataSnapshot = {
  links: CollectLinkRow[];
  invoices: CollectInvoiceRow[];
  settlements: CollectSettlementRow[];
  fxRate: number | null;
  summary: { totalUsd: number; totalNgn: number };
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useCollectData(userId: string | undefined): CollectDataSnapshot {
  const [links, setLinks] = useState<CollectLinkRow[]>([]);
  const [invoices, setInvoices] = useState<CollectInvoiceRow[]>([]);
  const [settlements, setSettlements] = useState<CollectSettlementRow[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLinks([]);
      setInvoices([]);
      setSettlements([]);
      setFxRate(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [linksRes, invRes, setRes, rateRes] = await Promise.all([
        supabase
          .from('collect_links')
          .select('id, description, amount_usd, status, checkout_url, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('collect_invoices')
          .select('id, client_email, client_name, description, amount_usd, currency, status, hosted_invoice_url, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('collect_settlements')
          .select('id, usd_gross, ngn_credited, created_at, source_type, metadata')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('collect_fx_rates')
          .select('rate')
          .eq('base_currency', 'USD')
          .eq('quote_currency', 'NGN')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (linksRes.error) throw linksRes.error;
      if (invRes.error) throw invRes.error;
      if (setRes.error) throw setRes.error;
      if (rateRes.error) throw rateRes.error;

      setLinks((linksRes.data as CollectLinkRow[]) ?? []);
      setInvoices((invRes.data as CollectInvoiceRow[]) ?? []);
      setSettlements((setRes.data as CollectSettlementRow[]) ?? []);
      setFxRate(rateRes.data?.rate != null ? Number(rateRes.data.rate) : null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load Collect';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const totalUsd = settlements.reduce((s, r) => s + (Number(r.usd_gross) || 0), 0);
    const totalNgn = settlements.reduce((s, r) => s + (Number(r.ngn_credited) || 0), 0);
    return { totalUsd, totalNgn };
  }, [settlements]);

  return {
    links,
    invoices,
    settlements,
    fxRate,
    summary,
    loading,
    error,
    refresh,
  };
}
