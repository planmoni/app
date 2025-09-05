import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

export interface ErrorState {
  hasError: boolean;
  error: string | null;
  field?: string;
}

export interface ErrorHandlingOptions {
  preventNavigation?: boolean;
  showToast?: boolean;
  logError?: boolean;
}

export function useErrorHandling() {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null
  });

  const handleError = useCallback((
    error: string | Error, 
    options: ErrorHandlingOptions = {}
  ) => {
    const {
      preventNavigation = true,
      showToast = true,
      logError = true
    } = options;

    const errorMessage = typeof error === 'string' ? error : error.message;
    
    if (logError) {
      console.error('🚨 Error handled:', errorMessage);
    }

    setErrorState({
      hasError: true,
      error: errorMessage
    });

    if (showToast) {
      // Show toast error (will be implemented)
      console.log('📱 Toast error:', errorMessage);
    }

    // Prevent any navigation by returning false
    if (preventNavigation) {
      return false;
    }

    return true;
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null
    });
  }, []);

  const handleFormError = useCallback((
    error: string | Error,
    field?: string
  ) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    console.error('📝 Form error:', errorMessage, field ? `(field: ${field})` : '');
    
    setErrorState({
      hasError: true,
      error: errorMessage,
      field
    });

    // Never navigate on form errors
    return false;
  }, []);

  return {
    errorState,
    handleError,
    clearError,
    handleFormError
  };
}