import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PaymentMethod = {
  id: string;
  user_id: string;
  type: 'card' | 'bank' | 'ussd';
  provider: string;
  token: string;
  last_four: string;
  exp_month?: string;
  exp_year?: string;
  card_type?: string;
  bank?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchPaymentMethods();
    }
  }, [session?.user?.id]);

  const fetchPaymentMethods = async () => {
    try {
      setError(null);
      
      // For demo purposes, use mock data
      setPaymentMethods([
        {
          id: '1',
          user_id: session?.user?.id || '',
          type: 'card',
          provider: 'paystack',
          token: 'AUTH_123456789',
          last_four: '4242',
          exp_month: '12',
          exp_year: '25',
          card_type: 'visa',
          bank: 'Test Bank',
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          user_id: session?.user?.id || '',
          type: 'card',
          provider: 'paystack',
          token: 'AUTH_987654321',
          last_four: '5678',
          exp_month: '10',
          exp_year: '26',
          card_type: 'mastercard',
          bank: 'Another Bank',
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  const addPaymentMethod = async (methodData: {
    type: 'card' | 'bank' | 'ussd';
    provider: string;
    token: string;
    last_four: string;
    exp_month?: string;
    exp_year?: string;
    card_type?: string;
    bank?: string;
    is_default?: boolean;
  }) => {
    try {
      setError(null);
      
      // For demo purposes, use mock data
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        user_id: session?.user?.id || '',
        ...methodData,
        is_default: methodData.is_default || paymentMethods.length === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setPaymentMethods(prev => [newMethod, ...prev]);
      return newMethod;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
      throw err;
    }
  };

  const setDefaultMethod = async (methodId: string) => {
    try {
      setError(null);
      
      setPaymentMethods(prev => prev.map(method => ({
        ...method,
        is_default: method.id === methodId,
        updated_at: new Date().toISOString()
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default payment method');
      throw err;
    }
  };

  const deletePaymentMethod = async (methodId: string) => {
    try {
      setError(null);
      
      const methodToDelete = paymentMethods.find(m => m.id === methodId);
      const updatedMethods = paymentMethods.filter(m => m.id !== methodId);
      
      // If we deleted the default method and there are other methods, make the first one default
      if (methodToDelete?.is_default && updatedMethods.length > 0) {
        updatedMethods[0].is_default = true;
      }
      
      setPaymentMethods(updatedMethods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
      throw err;
    }
  };

  return {
    paymentMethods,
    isLoading,
    error,
    fetchPaymentMethods,
    addPaymentMethod,
    setDefaultMethod,
    deletePaymentMethod,
  };
}