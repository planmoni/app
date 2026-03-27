import { useState, useEffect, useMemo } from 'react';
import { getSafeHavenBanks } from '@/lib/safehaven-bank-mapper';
import { getBankIconLogo } from '@/lib/bankIcons';

export type SafeHavenBankForPayout = {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
  type: string;
  is_active: boolean;
  logo?: string | any;
  logoSvg?: any;
  shortName?: string;
  category?: 'commercial' | 'microfinance';
};

/**
 * Returns only SafeHaven-supported banks for payout account selection.
 * Transfers are SafeHaven-only; Paystack is used only for deposits.
 */
export function useSafeHavenBanksForPayout() {
  const [banks, setBanks] = useState<SafeHavenBankForPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setError(null);
      const safeHavenBanks = getSafeHavenBanks();
      const mapped: SafeHavenBankForPayout[] = safeHavenBanks.map((bank, index) => {
        const bankIcon = getBankIconLogo(bank.name);
        return {
          id: index + 1,
          name: bank.name.replace(/\b\w/g, (c) => c.toUpperCase()),
          code: bank.bankCode,
          country: 'Nigeria',
          currency: 'NGN',
          type: 'nuban',
          is_active: true,
          shortName: bank.name.split(' ')[0],
          category: 'commercial',
          logo: bankIcon?.logo,
          logoSvg: bankIcon?.logoSvg,
        };
      });
      setBanks(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SafeHaven banks');
      setBanks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    banks,
    isLoading,
    error,
    refetch: () => {
      setIsLoading(true);
      try {
        const safeHavenBanks = getSafeHavenBanks();
        const mapped: SafeHavenBankForPayout[] = safeHavenBanks.map((bank, index) => {
          const bankIcon = getBankIconLogo(bank.name);
          return {
            id: index + 1,
            name: bank.name.replace(/\b\w/g, (c) => c.toUpperCase()),
            code: bank.bankCode,
            country: 'Nigeria',
            currency: 'NGN',
            type: 'nuban',
            is_active: true,
            shortName: bank.name.split(' ')[0],
            category: 'commercial',
            logo: bankIcon?.logo,
            logoSvg: bankIcon?.logoSvg,
          };
        });
        setBanks(mapped);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load SafeHaven banks');
        setBanks([]);
      } finally {
        setIsLoading(false);
      }
    },
  };
}
