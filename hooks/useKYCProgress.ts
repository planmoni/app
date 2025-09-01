import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type KYCStep = 'personal' | 'bvn_verification' | 'id_face_match' | 'address_details' | 'review';

export interface KYCProgress {
  id?: string;
  user_id?: string;
  current_step: KYCStep;
  personal_info_completed: boolean;
  bvn_verified: boolean;
  documents_verified: boolean;
  address_completed: boolean;
  overall_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useKYCProgress = () => {
  const { session } = useAuth();
  const [progress, setProgress] = useState<KYCProgress>({
    current_step: 'personal',
    personal_info_completed: false,
    bvn_verified: false,
    documents_verified: false,
    address_completed: false,
    overall_completed: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load KYC progress
  const loadProgress = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Use the function to get or create progress
      const { data, error: fetchError } = await supabase
        .rpc('get_or_create_kyc_progress', {
          user_uuid: session.user.id
        });

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setProgress(data);
      }
    } catch (err) {
      console.error('Error loading KYC progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Update KYC progress
  const updateProgress = useCallback(async (updates: Partial<KYCProgress>): Promise<boolean> => {
    if (!session?.user?.id) return false;

    try {
      setLoading(true);
      setError(null);

      console.log('Updating KYC progress:', updates);

      const { data, error: updateError } = await supabase
        .from('kyc_progress')
        .update(updates)
        .eq('user_id', session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProgress(data);
      console.log('KYC progress updated successfully');
      return true;
    } catch (err) {
      console.error('Error updating KYC progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to update progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Calculate progress percentage
  const getProgressPercentage = useCallback(() => {
    let completedSteps = 0;
    const totalSteps = 5;

    if (progress.personal_info_completed) completedSteps++;
    if (progress.bvn_verified) completedSteps++;
    if (progress.documents_verified) completedSteps++;
    if (progress.address_completed) completedSteps++;
    if (progress.overall_completed) completedSteps++;

    return Math.round((completedSteps / totalSteps) * 100);
  }, [progress]);

  // Get current step progress
  const getStepProgress = useCallback(() => {
    switch (progress.current_step) {
      case 'personal': return 20;
      case 'bvn_verification': return 40;
      case 'id_face_match': return 60;
      case 'address_details': return 80;
      case 'review': return 100;
      default: return 0;
    }
  }, [progress.current_step]);

  // Load progress on mount and when session changes
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  return {
    progress,
    loading,
    error,
    loadProgress,
    updateProgress,
    getProgressPercentage,
    getStepProgress,
    setProgress
  };
}; 