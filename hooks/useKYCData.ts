import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache, toUserFacingError } from '@/lib/supabase-fetch';

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
  account_number?: string;
  bank_code?: string;
  bank_name?: string;
  nin?: string;
  document_type?: 'bvn' | 'nin' | 'passport' | 'drivers_license';
  document_number?: string;

  // Document URLs
  document_front_url?: string;
  document_back_url?: string;
  selfie_url?: string;

  // Address Documents (Optional)
  utility_bill_url?: string;
  utility_bill_validated?: boolean;
  utility_bill_validation_result?: any;

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
  const hasCachedDataRef = useRef(false);

  const loadFormData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      if (!hasCachedDataRef.current) {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await fetchWithRetry(
        () =>
          supabase
            .from('kyc_data')
            .select('*')
            .eq('user_id', session.user.id)
            .single(),
        'KYC form data'
      ) as { data: KYCFormData | null; error: { code?: string; message?: string } | null };

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setFormData(data);
        void writeCache(CACHE_KEYS.kycData(session.user.id), data);
      } else {
        setFormData({});
      }
    } catch (err) {
      console.warn('Error loading KYC form data:', err);
      if (!hasCachedDataRef.current) {
        setError(toUserFacingError(err, false));
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const saveFormData = useCallback(async (updates: Partial<KYCFormData>): Promise<boolean> => {
    if (!session?.user?.id) return false;

    try {
      setLoading(true);
      setError(null);

      console.log('Saving KYC form data:', updates);

      const { error: checkError } = await supabase
        .from('kyc_data')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      let result;

      if (checkError && checkError.code === 'PGRST116') {
        const { data, error: insertError } = await supabase
          .from('kyc_data')
          .insert({
            ...updates,
            user_id: session.user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        result = data;

        await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'kyc_initiated',
          p_verification_type: 'document',
          p_verification_provider: 'internal',
          p_request_data: updates,
          p_response_data: { kyc_data_id: result.id },
          p_status: 'success',
          p_result_message: 'KYC data record created successfully',
          p_metadata: {
            component: 'useKYCData',
            action: 'create_record',
            fields_updated: Object.keys(updates),
          },
        });
      } else if (checkError) {
        throw checkError;
      } else {
        const { data, error: updateError } = await supabase
          .from('kyc_data')
          .update(updates)
          .eq('user_id', session.user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        result = data;

        await supabase.rpc('create_kyc_audit_log', {
          p_user_id: session.user.id,
          p_operation_type: 'kyc_submitted',
          p_verification_type: 'document',
          p_verification_provider: 'internal',
          p_request_data: updates,
          p_response_data: { kyc_data_id: result.id },
          p_status: 'success',
          p_result_message: 'KYC data record updated successfully',
          p_metadata: {
            component: 'useKYCData',
            action: 'update_record',
            fields_updated: Object.keys(updates),
          },
        });
      }

      setFormData(result);
      void writeCache(CACHE_KEYS.kycData(session.user.id), result);
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

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setFormData({});
      return;
    }

    let isMounted = true;

    const init = async () => {
      const cached = await readCache<KYCFormData>(CACHE_KEYS.kycData(session.user.id));
      if (cached && isMounted) {
        setFormData(cached);
        hasCachedDataRef.current = true;
      }

      if (!isMounted) return;
      await loadFormData();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, loadFormData]);

  return {
    formData,
    loading,
    error,
    loadFormData,
    saveFormData,
    setFormData,
  };
};
