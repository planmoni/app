import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Import SVG components - commented out due to TypeScript issue
// import UnionBankLogo from '@/assets/banks/union_bank.svg';

export type Bank = {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
  type: string;
  is_active: boolean;
  logo?: string | any; // Can be URL string or local asset object
  logoSvg?: any; // For SVG components
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

      const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!;
      
      console.log('useBanks - Starting fetchBanks');
      console.log('useBanks - PAYSTACK_SECRET_KEY exists:', !!PAYSTACK_SECRET_KEY);
      
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
      }
      
      console.log('PAYSTACK_SECRET_KEY', PAYSTACK_SECRET_KEY);
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
      const transformedBanks: Bank[] = data.data.map((bank: any, index: number) => {
        console.log(`Processing bank: ${bank.name} with code: ${bank.code}`);
        const bankIcon = getBankIcon(bank.name, bank.code);
        return {
          id: bank.id || index + 1,
          name: bank.name,
          code: bank.code,
          country: bank.country || 'Nigeria',
          currency: bank.currency || 'NGN',
          type: bank.type || 'nuban',
          is_active: bank.active !== false,
          shortName: getShortName(bank.name),
          category: determineCategory(bank.name),
          logo: bankIcon.logo,
          logoSvg: bankIcon.logoSvg,
        };
      });

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
  const getBankIcon = (bankName: string, bankCode: string): { logo?: any; logoSvg?: any } => {
    if (!bankCode) {
      console.warn(`Bank code is missing for bank: ${bankName}`);
      return {};
    }
    // Map bank codes to local asset names
    const localBankIcons: { [key: string]: any } = {
      '035': require('@/assets/banks/wema_bank.png'), // Wema Bank
      '057': require('@/assets/banks/zenith_bank.png'), // Zenith Bank
      '566': require('@/assets/banks/vfd_bank.png'), // VFD Merchant Bank
      '51355': require('@/assets/banks/waya_bank.png'),
      '050020': require('@/assets/banks/vale_bank.png'),
      '215': require('@/assets/banks/unity_bank.png'),
      '033': require('@/assets/banks/united_bank.png'),
      '51322': require('@/assets/banks/uhuru_bank.png'),
      '102': require('@/assets/banks/titan_bank.png'),
      '302': require('@/assets/banks/taj_bank.png'),
      '100': require('@/assets/banks/suntrust_bank.png'),
      '51310': require('@/assets/banks/sparkle_bank.png'),
      '125': require('@/assets/banks/rubies_bank.png'),
      '50761': require('@/assets/banks/rehoboth_bank.png'),
      '90067': require('@/assets/banks/refuge_bank.png'),
      '51293': require('@/assets/banks/quick_fund_bank.png'),
      '050023': require('@/assets/banks/prosperis_bank.png'),
      '268': require('@/assets/banks/platinum_bank.png'),
      '51146': require('@/assets/banks/personal_trust_bank.png'),
      '311': require('@/assets/banks/parkway_readycash_bank.png'),
      '51142': require('@/assets/banks/navy_bank.png'),
      '090679': require('@/assets/banks/ndcc_bank.png'),
      '120003': require('@/assets/banks/mtn_mono_bank.png'),
      '090171': require('@/assets/banks/main_street_bank.png'),
      '303': require('@/assets/banks/lotus_bank.png'),
      '031': require('@/assets/banks/living_trust_bank.png'),
      '50549': require('@/assets/banks/links_bank.png'),
      '50200': require('@/assets/banks/kredi_bank.png'),
      '100025': require('@/assets/banks/kongapay_bank.png'),
      '899': require('@/assets/banks/kolomoni_bank.png'),
      '301': require('@/assets/banks/jaiz_bank.png'),
      '415': require('@/assets/banks/imperial_bank.png'),
      '51244': require('@/assets/banks/ibile_bank.png'),
      '50383': require('@/assets/banks/hasal_bank.png'),
      '562': require('@/assets/banks/greenwich_bank.png'),
      '812': require('@/assets/banks/gateway_bank.png'),
      '51314': require('@/assets/banks/firmus_bank.png'),
      '50298': require('@/assets/banks/fedeth_bank.png'),
      '51318': require('@/assets/banks/fair_money_bank.png'),
      '090678': require('@/assets/banks/excel_bank.png'),
      '50263': require('@/assets/banks/ekimogun_bank.png'),
      '51334': require('@/assets/banks/davenport_bank.png'),
      'FC40128': require('@/assets/banks/country_bank.png'),
      '50910': require('@/assets/banks/consumer_bank.png'),
      '070027': require('@/assets/banks/citycode_bank.png'),
      '50171': require('@/assets/banks/chanelle_bank.png'),
      '50823': require('@/assets/banks/cemcs_bank.png'),
      '865': require('@/assets/banks/cashconnect_bank.png'),
      '50931': require('@/assets/banks/bowen_bank.png'),
      '51100': require('@/assets/banks/bell_bank.png'),
      'MFB50992': require('@/assets/banks/baobab_bank.png'),
      '51351': require('@/assets/banks/awacash_bank.png'),
      'MFB50094': require('@/assets/banks/astrapolaris_bank.png'),
      '90077': require('@/assets/banks/ag_bank.png'),
      '602': require('@/assets/banks/accion_bank.png'),
      '120001': require('@/assets/banks/9mobile_bank.png'),
      // Add more mappings as you add more bank logos
    };

    // Special handling for SVG files - using dynamic import
    const getSvgIcon = (code: string) => {
      if (!code) {
        console.warn('Bank code is undefined or empty');
        return null;
      }
      
      try {
        switch (code) {
          case '032':
            return require('@/assets/banks/union_bank.svg');
          case '076':
            return require('@/assets/banks/polaris_bank.svg');
          case '51269':
            return require('@/assets/banks/tangerine_bank.svg');
          case '232':
            return require('@/assets/banks/sterling_bank.svg');
          case '51253':
            return require('@/assets/banks/stallas_bank.svg');
          case '068':
            return require('@/assets/banks/standard_chartered_bank.svg');
          case '221':
            return require('@/assets/banks/stanbic_bank.svg');
          case '106':
            return require('@/assets/banks/signature_bank.svg');
          case '51113':
            return require('@/assets/banks/safe_haven_bank.svg');
          case '502':
            return require('@/assets/banks/rand_marchant_bank.svg');
          case '101':
            return require('@/assets/banks/providus_bank.svg');
          case '105':
            return require('@/assets/banks/premium_trust_bank.svg');
          case '00716':
            return require('@/assets/banks/pocket_bank.svg');
          case '51226':
            return require('@/assets/banks/pecan_trust_bank.svg');
          case '104':
            return require('@/assets/banks/parrallex_bank.svg');
          case '999991':
            return require('@/assets/banks/palmpay.svg');
          case '100002':
            return require('@/assets/banks/paga_bank.svg');
          case '107':
            return require('@/assets/banks/optimus_bank.svg');
          case '999992':
            return require('@/assets/banks/opay_bank.svg');
          case '50515':
            return require('@/assets/banks/moniepoint_bank.svg');
          case '50491':
            return require('@/assets/banks/loma_bank.svg');
          case '50211':
            return require('@/assets/banks/kuda_bank.svg');
          case '082':
            return require('@/assets/banks/keystone_bank.svg');
          case '120002':
            return require('@/assets/banks/hope_bank.svg');
          case '058':
            return require('@/assets/banks/gt_bank.svg');
          case '100022':
            return require('@/assets/banks/go_bank.svg');
          case '090574':
            return require('@/assets/banks/goldman_bank.svg');
          case '00103':
            return require('@/assets/banks/globus_bank.svg');
          case '501':
            return require('@/assets/banks/fsdh_bank.svg');
          case '413':
            return require('@/assets/banks/first_trust_bank.svg');
          case '011':
            return require('@/assets/banks/first_bank.svg');
          case '214':
            return require('@/assets/banks/fcmb_bank.svg');
          case '50126':
            return require('@/assets/banks/eyowo_bank.svg');
          case '050':
            return require('@/assets/banks/eco_bank.svg');
          case '098':
            return require('@/assets/banks/ekondo_bank.svg');
          case '50162':
            return require('@/assets/banks/dot_bank.svg');
          case '090560':
            return require('@/assets/banks/crust_bank.svg');
          case '40119':
            return require('@/assets/banks/credit_direct_bank.svg');
          case '559':
            return require('@/assets/banks/coronation_bank.svg');
          case '50204':
            return require('@/assets/banks/corestep_bank.svg');
          case '023':
            return require('@/assets/banks/citi_bank.svg');
          case '51353':
            return require('@/assets/banks/cashbridge_bank.svg');
          case '565':
            return require('@/assets/banks/carbon_bank.svg');
          case '50645':
            return require('@/assets/banks/buypower_bank.svg');
          case 'FC40163':
            return require('@/assets/banks/branch_bank.svg');
          case '51229':
            return require('@/assets/banks/baines_credit_bank.svg');
          case '401':
            return require('@/assets/banks/aso_savings_bank.svg');
          case '035A':
            return require('@/assets/banks/alat_wema_bank.svg');
          case '51336':
            return require('@/assets/banks/aku_bank.svg');
          case '120004':
            return require('@/assets/banks/airtel_smartcash_bank.svg');
          case '063':
            return require('@/assets/banks/access_diamond_bank.svg');
          case '044':
            return require('@/assets/banks/access_bank.svg');
          case '404':
            return require('@/assets/banks/abbey_bank.svg');
          default:
            return null;
        }
      } catch (error) {
        console.warn(`Failed to load SVG for bank code ${code}:`, error);
        return null;
      }
    };

    // Try to get SVG first
    const svgIcon = getSvgIcon(bankCode);
    if (svgIcon) {
      return { logoSvg: svgIcon };
    }

    // If no SVG, try regular image
    if (localBankIcons[bankCode]) {
      return { logo: localBankIcons[bankCode] };
    }

    // Return empty object for banks without logos (will show icon instead)
    return {};
  };

  return {
    banks,
    isLoading,
    error,
    fetchBanks
  };
}