import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Bank = {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
  type: string;
  is_active: boolean;
  logo?: string | any; // Can be URL string or local asset object
  shortName?: string;
  category?: 'commercial' | 'microfinance';
};

export function useBanks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchBanks();
    }
  }, [session?.user?.id]);

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;
      
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
      }

      const response = await fetch('https://api.paystack.co/bank', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch banks');
      }

      if (!data.status) {
        throw new Error(data.message || 'Failed to fetch banks');
      }

      // Transform Paystack bank data to our format
      const transformedBanks: Bank[] = data.data.map((bank: any, index: number) => ({
        id: bank.id || index + 1,
        name: bank.name,
        code: bank.code,
        country: bank.country || 'Nigeria',
        currency: bank.currency || 'NGN',
        type: bank.type || 'nuban',
        is_active: bank.active !== false,
        shortName: getShortName(bank.name),
        category: determineCategory(bank.name),
        logo: getBankIcon(bank.name, bank.code), // Use icon instead of logo
      }));

      setBanks(transformedBanks);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch banks');
      setIsLoading(false);
    }
  };

  // Helper function to get short name
  const getShortName = (bankName: string): string => {
    const shortNames: { [key: string]: string } = {
      'Access Bank': 'Access',
      'Guaranty Trust Bank': 'GTBank',
      'First Bank of Nigeria': 'FirstBank',
      'First City Monument Bank': 'FCMB',
      'United Bank for Africa': 'UBA',
      'Zenith Bank': 'Zenith',
      'Ecobank Nigeria': 'Ecobank',
      'Fidelity Bank': 'Fidelity',
      'Union Bank of Nigeria': 'Union Bank',
      'Wema Bank': 'Wema',
      'Sterling Bank': 'Sterling',
      'Stanbic IBTC Bank': 'Stanbic',
      'Standard Chartered Bank': 'StanChart',
      'Heritage Bank': 'Heritage',
      'Keystone Bank': 'Keystone',
      'Polaris Bank': 'Polaris',
      'Unity Bank': 'Unity',
      'Jaiz Bank': 'Jaiz',
      'Titan Trust Bank': 'Titan',
      'Providus Bank': 'Providus',
      'SunTrust Bank': 'SunTrust',
    };

    return shortNames[bankName] || bankName.split(' ')[0];
  };

  // Helper function to determine bank category
  const determineCategory = (bankName: string): 'commercial' | 'microfinance' => {
    const microfinanceBanks = [
      'OPay', 'Kuda', 'Paga', 'Carbon', 'FairMoney', 'Branch', 'Quickteller',
      'VFD Microfinance Bank', 'LAPO Microfinance Bank', 'Accion Microfinance Bank',
      'AB Microfinance Bank', 'Baobab Microfinance Bank', 'Finca Microfinance Bank',
      'Grooming Microfinance Bank', 'Mutual Trust Microfinance Bank',
      'Rephidim Microfinance Bank', 'Shepherd Trust Microfinance Bank',
      'Empire Trust Microfinance Bank', 'Fidfund Microfinance Bank',
      'Fina Trust Microfinance Bank', 'Peace Microfinance Bank',
      'Infinity Microfinance Bank', 'Seed Capital Microfinance Bank',
      'New Dawn Microfinance Bank', 'Credit Afrique Microfinance Bank'
    ];

    return microfinanceBanks.some(mfb => bankName.toLowerCase().includes(mfb.toLowerCase())) 
      ? 'microfinance' 
      : 'commercial';
  };

  // Helper function to get bank icon (using local assets)
  const getBankIcon = (bankName: string, bankCode: string): string | any => {
    // Map bank codes to local asset names
    const localBankIcons: { [key: string]: any } = {
      '035': require('@/assets/banks/wema_bank.png'), // Wema Bank
      '057': require('@/assets/banks/zenith_bank.png'), // Zenith Bank
      '566': require('@/assets/banks/vfd_bank.png'), // VFD Merchant Bank
      '51355': require('@/assets/banks/waya_bank.png'),
      '050020': require('@/assets/banks/vale_bank.png'),
      '215': require('@/assets/banks/unity_bank.png'),
      '033': require('@/assets/banks/united_bank.png'),
      '022': require('@/assets/banks/unity_bank.png'),
      // Add more mappings as you add more bank logos
    };

    // If we have a local icon for this bank, use it
    if (localBankIcons[bankCode]) {
      return localBankIcons[bankCode];
    }

    // Return null for banks without logos (will show icon instead)
    return null;
  };

  return {
    banks,
    isLoading,
    error,
    fetchBanks
  };
}