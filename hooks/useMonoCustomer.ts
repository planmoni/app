/**
 * Custom hook for managing Mono customer ID
 * Handles fetching and creating Mono customers
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UseMonoCustomerReturn {
  customerId: string | null;
  isLoading: boolean;
  error: string | null;
  createCustomer: (customerData: { name: string; email: string }) => Promise<string>;
  refreshCustomerId: () => Promise<void>;
}

/**
 * Hook to manage Mono customer ID for the current user
 */
export function useMonoCustomer(): UseMonoCustomerReturn {
  const { session } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerId = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('mono_customer_id')
        .eq('id', session.user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        setError(fetchError.message);
        return;
      }

      setCustomerId(profile?.mono_customer_id || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch customer ID';
      setError(errorMessage);
      console.error('Error getting Mono customer ID:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const createCustomer = useCallback(async (
    customerData: { name: string; email: string }
  ): Promise<string> => {
    if (!session?.user?.id) {
      throw new Error('User must be logged in');
    }

    try {
      setIsLoading(true);
      setError(null);

      const monoSecretKey = process.env.EXPO_PUBLIC_MONO_SECRET_KEY;
      
      if (!monoSecretKey) {
        throw new Error('Mono secret key is not configured');
      }

      // Create customer via Mono API
      const response = await fetch('https://api.withmono.com/v2/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mono-sec-key': monoSecretKey,
          'accept': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Failed to create Mono customer' };
        }
        
        // Log full error for debugging
        console.error('Mono customer creation error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        throw new Error(errorData.message || `Failed to create Mono customer: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const newCustomerId = result.data?.id;

      if (!newCustomerId) {
        throw new Error('No customer ID returned from Mono');
      }

      // Store customer ID in user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ mono_customer_id: newCustomerId })
        .eq('id', session.user.id);

      if (updateError) {
        console.error('Error storing Mono customer ID:', updateError);
        // Still return the customer ID even if storage fails
      }

      setCustomerId(newCustomerId);
      return newCustomerId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Mono customer';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const refreshCustomerId = useCallback(async () => {
    await fetchCustomerId();
  }, [fetchCustomerId]);

  // Fetch customer ID on mount and when session changes
  useEffect(() => {
    fetchCustomerId();
  }, [fetchCustomerId]);

  return {
    customerId,
    isLoading,
    error,
    createCustomer,
    refreshCustomerId,
  };
}

