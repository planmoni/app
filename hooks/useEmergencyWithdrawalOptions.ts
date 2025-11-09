import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface EmergencyWithdrawalOption {
  id: string;
  type: string;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export function useEmergencyWithdrawalOptions() {
  const [options, setOptions] = useState<EmergencyWithdrawalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmergencyWithdrawalOptions();
  }, []);

  const fetchEmergencyWithdrawalOptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('emergency_withdrawal_options')
        .select('*')
        .order('percentage', { ascending: false }); // Order by percentage descending (highest first)

      if (fetchError) {
        throw fetchError;
      }

      setOptions(data || []);
    } catch (err) {
      console.error('Error fetching emergency withdrawal options:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch emergency withdrawal options');
    } finally {
      setLoading(false);
    }
  };

  const getOptionByType = (type: string) => {
    return options.find(option => option.type === type);
  };

  const getDisplayName = (type: string) => {
    switch (type) {
      case 'instant':
        return 'Instant withdrawal';
      case '24hrs':
        return '24-hour withdrawal';
      case '72hrs':
        return '72-hour withdrawal';
      default:
        return type;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'instant':
        return '#EF4444'; // Red
      case '24hrs':
        return '#F59E0B'; // Orange
      case '72hrs':
        return '#22C55E'; // Green
      default:
        return '#6B7280'; // Gray
    }
  };

  return {
    options,
    loading,
    error,
    refetch: fetchEmergencyWithdrawalOptions,
    getOptionByType,
    getDisplayName,
    getColorForType,
  };
}
