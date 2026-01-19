/**
 * Lightweight Verification Check Utility
 * Checks KYC progress and performs basic fraud detection
 */

import { supabase } from '@/lib/supabase';

export interface VerificationResult {
  canProceed: boolean;
  missingSteps: string[];
  reason?: string;
  redirectTo?: string;
}

/**
 * Check if user has completed required verification
 * Requirements: liveness_test_completed AND bvn_verified
 */
export const checkVerificationStatus = async (
  userId: string
): Promise<VerificationResult> => {
  try {
    // Fetch KYC progress
    const { data: progress, error } = await supabase
      .from('kyc_progress')
      .select('liveness_test_completed, bvn_verified')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking KYC progress:', error);
      return {
        canProceed: false,
        missingSteps: [],
        reason: 'Unable to verify account status. Please try again.',
      };
    }

    if (!progress) {
      return {
        canProceed: false,
        missingSteps: ['Liveness Check', 'BVN Verification'],
        reason: 'Please complete your verification to add funds.',
        redirectTo: '/kyc/tier1',
      };
    }

    // Helper to check truthiness
    const isTruthy = (value: any): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
      return Boolean(value);
    };

    const livenessCompleted = isTruthy(progress.liveness_test_completed);
    const bvnVerified = isTruthy(progress.bvn_verified);

    const missingSteps: string[] = [];
    if (!livenessCompleted) missingSteps.push('Liveness Check');
    if (!bvnVerified) missingSteps.push('BVN Verification');

    if (missingSteps.length > 0) {
      return {
        canProceed: false,
        missingSteps,
        reason: `Complete ${missingSteps.join(' and ')} to add funds.`,
        redirectTo: '/kyc/tier1',
      };
    }

    // All checks passed
    return {
      canProceed: true,
      missingSteps: [],
    };
  } catch (error) {
    console.error('Error in checkVerificationStatus:', error);
    return {
      canProceed: false,
      missingSteps: [],
      reason: 'Verification check failed. Please try again.',
    };
  }
};

/**
 * Lightweight fraud check - checks for suspicious patterns
 */
export const performBasicFraudCheck = async (
  userId: string
): Promise<{ passed: boolean; reason?: string }> => {
  try {
    // Check for rapid verification attempts (last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentAttempts, error } = await supabase
      .from('kyc_audit_logs')
      .select('id')
      .eq('user_id', userId)
      .in('operation_type', ['bvn_verified', 'liveness_check'])
      .gte('created_at', fifteenMinutesAgo);

    if (error) {
      // Don't block on query error
      return { passed: true };
    }

    // More than 5 attempts in 15 minutes is suspicious
    if (recentAttempts && recentAttempts.length > 5) {
      return {
        passed: false,
        reason: 'Too many verification attempts. Please wait 15 minutes before trying again.',
      };
    }

    return { passed: true };
  } catch (error) {
    console.error('Error in fraud check:', error);
    // Don't block on error
    return { passed: true };
  }
};
