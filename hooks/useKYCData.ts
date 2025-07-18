import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface KYCFormData {
  id?: string;
  user_id?: string;
  
  // Personal Information
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  date_of_birth?: string;
  phone_number?: string;
  
  // Address Information
  address?: string;
  address_no?: string;
  house_url?: string;
  address_lat?: string;
  address_lon?: string;
  address_place_id?: string;
  lga?: string;
  state?: string;
  
  // Identity Information
  bvn?: string;
  nin?: string;
  document_type?: 'bvn' | 'nin' | 'passport' | 'drivers_license';
  document_number?: string;
  
  // Document URLs
  document_front_url?: string;
  document_back_url?: string;
  selfie_url?: string;
  
  // Address Documents (Optional)
  utility_bill_url?: string;
  
  // Admin Approval
  approved?: boolean;
  
  created_at?: string;
  updated_at?: string;
}

export const useKYCData = () => {
  const { session } = useAuth();
  const [formData, setFormData] = useState<KYCFormData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load KYC form data
  const loadFormData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('kyc_data')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setFormData(data);
      } else {
        setFormData({});
      }
    } catch (err) {
      console.error('Error loading KYC form data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Save KYC form data
  const saveFormData = useCallback(async (updates: Partial<KYCFormData>): Promise<boolean> => {
    if (!session?.user?.id) return false;

    try {
      setLoading(true);
      setError(null);

      console.log('Saving KYC form data:', updates);

      // Check if record exists
      const { data: existingData, error: checkError } = await supabase
        .from('kyc_data')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      let result;

      if (checkError && checkError.code === 'PGRST116') {
        // Create new record
        const { data, error: insertError } = await supabase
          .from('kyc_data')
          .insert({
            ...updates,
            user_id: session.user.id
          })
          .select()
          .single();

        if (insertError) throw insertError;
        result = data;
      } else if (checkError) {
        throw checkError;
      } else {
        // Update existing record
        const { data, error: updateError } = await supabase
          .from('kyc_data')
          .update(updates)
          .eq('user_id', session.user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        result = data;
      }

      
      setFormData(result);
      console.log('KYC form data saved successfully');
      return true;
    } catch (err) {
      console.error('Error saving KYC form data:', err);
      setError(err instanceof Error ? err.message : 'Failed to save form data');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Load data on mount and when session changes
  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  return {
    formData,
    loading,
    error,
    loadFormData,
    saveFormData,
    setFormData
  };
}; 