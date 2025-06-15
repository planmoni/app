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
      console.log('Fetching payment methods...');
      
      // Try to fetch from the database first
      const { data: dbData, error: dbError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });
      
      if (dbError) {
        console.warn('Database error when fetching payment methods:', dbError);
        // Fall back to mock data if database query fails
        useMockData();
        return;
      }
      
      if (dbData && dbData.length > 0) {
        console.log(`Found ${dbData.length} payment methods in database`);
        setPaymentMethods(dbData);
      } else {
        console.log('No payment methods found in database, using mock data');
        useMockData();
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error in fetchPaymentMethods:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment methods');
      // Fall back to mock data on error
      useMockData();
    }
  };
  
  const useMockData = () => {
    console.log('Using mock payment method data');
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
      console.log('Adding payment method:', {
        type: methodData.type,
        provider: methodData.provider,
        last_four: methodData.last_four,
        is_default: methodData.is_default
      });
      
      // Try to insert into the database
      const { data, error: insertError } = await supabase
        .from('payment_methods')
        .insert({
          user_id: session?.user?.id,
          ...methodData,
          is_default: methodData.is_default || paymentMethods.length === 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        console.error('Error inserting payment method:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      if (data && data.length > 0) {
        console.log('Payment method added to database:', data[0].id);
        // Update local state
        setPaymentMethods(prev => [data[0], ...prev]);
        return data[0];
      } else {
        // Fall back to mock implementation if database insert doesn't return data
        console.log('Using mock implementation for addPaymentMethod');
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
      }
    } catch (err) {
      console.error('Error in addPaymentMethod:', err);
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
      throw err;
    }
  };

  const setDefaultMethod = async (methodId: string) => {
    try {
      setError(null);
      console.log('Setting default payment method:', methodId);
      
      // Try to update in the database
      const { error: updateError } = await supabase.rpc('set_default_payment_method', {
        p_method_id: methodId,
        p_user_id: session?.user?.id
      });
      
      if (updateError) {
        console.error('Error setting default method in database:', updateError);
        // Fall back to local state update
        console.log('Falling back to local state update for default method');
      }
      
      // Update local state regardless of database result
      setPaymentMethods(prev => prev.map(method => ({
        ...method,
        is_default: method.id === methodId,
        updated_at: new Date().toISOString()
      })));
    } catch (err) {
      console.error('Error in setDefaultMethod:', err);
      setError(err instanceof Error ? err.message : 'Failed to set default payment method');
      throw err;
    }
  };

  const deletePaymentMethod = async (methodId: string) => {
    try {
      setError(null);
      console.log('Deleting payment method:', methodId);
      
      // Try to delete from the database
      const { error: deleteError } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId)
        .eq('user_id', session?.user?.id);
      
      if (deleteError) {
        console.error('Error deleting payment method from database:', deleteError);
        // Continue with local state update even if database delete fails
      }
      
      const methodToDelete = paymentMethods.find(m => m.id === methodId);
      const updatedMethods = paymentMethods.filter(m => m.id !== methodId);
      
      // If we deleted the default method and there are other methods, make the first one default
      if (methodToDelete?.is_default && updatedMethods.length > 0) {
        updatedMethods[0].is_default = true;
        
        // Try to update the new default in the database
        try {
          await supabase.rpc('set_default_payment_method', {
            p_method_id: updatedMethods[0].id,
            p_user_id: session?.user?.id
          });
        } catch (defaultError) {
          console.error('Error setting new default after deletion:', defaultError);
          // Continue even if setting new default fails
        }
      }
      
      setPaymentMethods(updatedMethods);
    } catch (err) {
      console.error('Error in deletePaymentMethod:', err);
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