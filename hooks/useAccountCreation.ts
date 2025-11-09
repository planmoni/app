/**
 * Account Creation Hook
 * 
 * This hook provides a robust account creation process with proper UI state management
 * to prevent blank screens and ensure smooth user experience.
 */

import { useState, useCallback, useRef } from 'react';
import { accountCreationHandler } from '@/scripts/account-creation-handler';
import { useHaptics } from './useHaptics';
import { Platform } from 'react-native';

interface AccountCreationState {
  isCreating: boolean;
  progress: string;
  error: string | null;
  retryCount: number;
  showRetryOptions: boolean;
}

interface AccountCreationOptions {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: string) => void;
}

export function useAccountCreation() {
  const [state, setState] = useState<AccountCreationState>({
    isCreating: false,
    progress: '',
    error: null,
    retryCount: 0,
    showRetryOptions: false,
  });

  const haptics = useHaptics();
  const isCreatingRef = useRef(false);

  const updateState = useCallback((updates: Partial<AccountCreationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const createAccount = useCallback(async (options: AccountCreationOptions) => {
    // Prevent multiple simultaneous calls
    if (isCreatingRef.current || state.isCreating) {
      console.warn('Account creation already in progress');
      return { success: false, error: 'Account creation already in progress' };
    }

    try {
      isCreatingRef.current = true;
      updateState({
        isCreating: true,
        error: null,
        showRetryOptions: false,
        progress: 'Initializing...'
      });

      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      const result = await accountCreationHandler.createAccount({
        ...options,
        referralCode: options.referralCode ?? '',
        onProgress: (progress: any) => {
          updateState({ progress });
          options.onProgress?.(progress);
        },
        onError: (error: any) => {
          console.error('Account creation error:', error);
          updateState({
            error: error.message,
            progress: '',
            showRetryOptions: true,
            retryCount: state.retryCount + 1
          });
          
          if (Platform.OS !== 'web') {
            haptics.error();
          }
          
          options.onError?.(error);
        },
        onSuccess: (data: any) => {
          updateState({
            progress: 'Account created successfully!',
            error: null,
            showRetryOptions: false
          });
          
          if (Platform.OS !== 'web') {
            haptics.success();
          }
          
          options.onSuccess?.(data);
        }
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      console.error('Account creation failed:', errorMessage);
      
      updateState({
        error: errorMessage,
        progress: '',
        showRetryOptions: true,
        retryCount: state.retryCount + 1
      });
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
      
      return { success: false, error: errorMessage };
    } finally {
      isCreatingRef.current = false;
      updateState({ isCreating: false });
    }
  }, [state.retryCount, updateState, haptics]);

  const retry = useCallback((options: AccountCreationOptions) => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    updateState({
      error: null,
      progress: '',
      showRetryOptions: false
    });
    
    return createAccount(options);
  }, [createAccount, updateState, haptics]);

  const cancel = useCallback(() => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    
    // Reset the handler state
    accountCreationHandler.reset();
    
    updateState({
      isCreating: false,
      progress: '',
      error: null,
      retryCount: 0,
      showRetryOptions: false
    });
  }, [updateState, haptics]);

  const reset = useCallback(() => {
    accountCreationHandler.reset();
    updateState({
      isCreating: false,
      progress: '',
      error: null,
      retryCount: 0,
      showRetryOptions: false
    });
  }, [updateState]);

  return {
    // State
    isCreating: state.isCreating,
    progress: state.progress,
    error: state.error,
    retryCount: state.retryCount,
    showRetryOptions: state.showRetryOptions,
    
    // Actions
    createAccount,
    retry,
    cancel,
    reset,
    
    // Utilities
    canRetry: state.retryCount < 3,
    isError: !!state.error,
    isSuccess: state.progress === 'Account created successfully!' && !state.error,
  };
}
