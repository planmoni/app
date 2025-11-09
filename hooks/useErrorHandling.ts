import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

export interface ErrorState {
  hasError: boolean;
  error: string | null;
  field?: string;
  isNetworkError?: boolean;
  isRetryable?: boolean;
}

export interface ErrorHandlingOptions {
  preventNavigation?: boolean;
  showToast?: boolean;
  logError?: boolean;
  showAlert?: boolean;
  retryable?: boolean;
  silent?: boolean; // New option to completely hide errors
}

export function useErrorHandling() {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null
  });

  const isNetworkError = useCallback((error: string | Error): boolean => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const networkErrorPatterns = [
      'network request failed',
      'network error',
      'connection failed',
      'timeout',
      'fetch failed',
      'connection refused',
      'no internet',
      'offline',
      'unreachable',
      'dns',
      'socket',
      'econnreset',
      'enotfound',
      'etimedout',
      '504', // Gateway timeout
      '502', // Bad gateway
      '503' // Service unavailable
    ];
    
    return networkErrorPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }, []);

  const isRetryableError = useCallback((error: string | Error): boolean => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'rate limit',
      'temporary',
      'server error',
      'service unavailable',
      'bad gateway',
      'gateway timeout',
      '504',
      '502',
      '503'
    ];
    
    return retryablePatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }, []);

  const getFriendlyErrorMessage = useCallback((error: string | Error): string => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    if (isNetworkError(error)) {
      return 'Connection issue detected. Please check your internet connection and try again.';
    }
    
    if (errorMessage.toLowerCase().includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    if (errorMessage.toLowerCase().includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (errorMessage.toLowerCase().includes('unauthorized') || 
        errorMessage.toLowerCase().includes('forbidden')) {
      return 'Access denied. Please sign in again.';
    }
    
    if (errorMessage.toLowerCase().includes('not found')) {
      return 'The requested resource was not found.';
    }
    
    if (errorMessage.toLowerCase().includes('server error') ||
        errorMessage.toLowerCase().includes('internal error')) {
      return 'Server error occurred. Please try again later.';
    }
    
    // Return original error for specific business logic errors
    return errorMessage;
  }, [isNetworkError]);

  const handleError = useCallback((
    error: string | Error, 
    options: ErrorHandlingOptions = {}
  ) => {
    const {
      preventNavigation = true,
      showToast = false, // Changed default to false
      logError = false, // Changed default to false to hide console errors
      showAlert = false,
      retryable = undefined,
      silent = false // New option to completely silence errors
    } = options;

    // If silent mode is enabled, don't do anything
    if (silent) {
      return true;
    }

    const originalError = typeof error === 'string' ? error : error.message;
    const friendlyError = getFriendlyErrorMessage(error);
    const isNetwork = isNetworkError(error);
    const isRetryable = retryable !== undefined ? retryable : isRetryableError(error);
    
    // Only log errors in development mode and if logError is true
    if (logError && __DEV__) {
      console.error('🚨 Error handled:', {
        original: originalError,
        friendly: friendlyError,
        isNetwork,
        isRetryable
      });
    }

    setErrorState({
      hasError: true,
      error: friendlyError,
      isNetworkError: isNetwork,
      isRetryable
    });

    if (showAlert) {
      Alert.alert(
        isNetwork ? 'Connection Issue' : 'Error',
        friendlyError,
        [
          {
            text: 'OK',
            onPress: () => setErrorState(prev => ({ ...prev, hasError: false }))
          }
        ]
      );
    }

    if (showToast) {
      // Show toast error (will be implemented)
      if (__DEV__) {
        console.log('📱 Toast error:', friendlyError);
      }
    }

    // Prevent any navigation by returning false
    if (preventNavigation) {
      return false;
    }

    return true;
  }, [getFriendlyErrorMessage, isNetworkError, isRetryableError]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      isNetworkError: false,
      isRetryable: false
    });
  }, []);

  const handleFormError = useCallback((
    error: string | Error,
    field?: string
  ) => {
    const friendlyError = getFriendlyErrorMessage(error);
    
    if (__DEV__) {
      console.error('📝 Form error:', {
        original: typeof error === 'string' ? error : error.message,
        friendly: friendlyError,
        field
      });
    }
    
    setErrorState({
      hasError: true,
      error: friendlyError,
      field,
      isNetworkError: isNetworkError(error),
      isRetryable: isRetryableError(error)
    });

    // Never navigate on form errors
    return false;
  }, [getFriendlyErrorMessage, isNetworkError, isRetryableError]);

  const handleNetworkError = useCallback((
    error: string | Error,
    options: Omit<ErrorHandlingOptions, 'retryable'> = {}
  ) => {
    return handleError(error, {
      ...options,
      retryable: true,
      showAlert: options.showAlert ?? false,
      silent: options.silent ?? true // Default to silent for network errors
    });
  }, [handleError]);

  const handleSilentError = useCallback((
    error: string | Error,
    options: Omit<ErrorHandlingOptions, 'silent'> = {}
  ) => {
    return handleError(error, {
      ...options,
      silent: true,
      logError: false,
      showToast: false,
      showAlert: false
    });
  }, [handleError]);

  return {
    errorState,
    handleError,
    clearError,
    handleFormError,
    handleNetworkError,
    handleSilentError,
    isNetworkError,
    isRetryableError,
    getFriendlyErrorMessage
  };
}