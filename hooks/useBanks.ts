import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';

export type Bank = {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
  type: string;
  is_active: boolean;
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

      // For web demo, use mock data
      if (Platform.OS === 'web') {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use a subset of Nigerian banks for the demo
        setBanks([
          { id: 1, name: 'Access Bank', code: '044', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 2, name: 'Citibank Nigeria', code: '023', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 3, name: 'Ecobank Nigeria', code: '050', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 4, name: 'Fidelity Bank', code: '070', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 5, name: 'First Bank of Nigeria', code: '011', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 6, name: 'First City Monument Bank', code: '214', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 7, name: 'Guaranty Trust Bank', code: '058', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 8, name: 'Heritage Bank', code: '030', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 9, name: 'Keystone Bank', code: '082', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 10, name: 'Polaris Bank', code: '076', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 11, name: 'Stanbic IBTC Bank', code: '221', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 12, name: 'Standard Chartered Bank', code: '068', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 13, name: 'Sterling Bank', code: '232', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 14, name: 'Union Bank of Nigeria', code: '032', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 15, name: 'United Bank for Africa', code: '033', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 16, name: 'Unity Bank', code: '215', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 17, name: 'Wema Bank', code: '035', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
          { id: 18, name: 'Zenith Bank', code: '057', country: 'Nigeria', currency: 'NGN', type: 'nuban', is_active: true },
        ]);
        setIsLoading(false);
        return;
      }

      // For native platforms, use actual API
      const token = session?.access_token;
      const response = await fetch('/api/banks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch banks');
      }

      const data = await response.json();
      setBanks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch banks');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    banks,
    isLoading,
    error,
    fetchBanks
  };
}