// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useCallback } from 'react';
// import { useErrorHandling } from './useErrorHandling';
// 
// export function useGlobalErrorHandler() {
//   const { handleSilentError, handleNetworkError } = useErrorHandling();
// 
//   const handleApiError = useCallback((error: any, context?: string) => {
//     // Handle common API errors silently
//     const errorMessage = error?.message || error?.toString() || 'Unknown error';
//     
//     // Check if it's a network/server error that should be handled silently
//     if (
//       errorMessage.includes('504') || // Gateway timeout
//       errorMessage.includes('502') || // Bad gateway
//       errorMessage.includes('503') || // Service unavailable
//       errorMessage.includes('network') ||
//       errorMessage.includes('timeout') ||
//       errorMessage.includes('fetch failed') ||
//       errorMessage.includes('refreshWallet is not a function') ||
//       errorMessage.includes('Paystack API error')
//     ) {
//       // Handle these errors silently
//       handleSilentError(error, {
//         preventNavigation: false,
//         logError: __DEV__ // Only log in development
//       });
//       return;
//     }
// 
//     // For other errors, handle them normally but silently
//     handleSilentError(error, {
//       preventNavigation: false,
//       logError: __DEV__
//     });
//   }, [handleSilentError, handleNetworkError]);
// 
//   const createSafeApiCall = useCallback((
//     apiCall: () => Promise<any>,
//     context?: string
//   ) => {
//     return async () => {
//       try {
//         return await apiCall();
//       } catch (error) {
//         handleApiError(error, context);
//         // Return a safe default value instead of throwing
//         return null;
//       }
//     };
//   }, [handleApiError]);
// 
//   return {
//     handleApiError,
//     createSafeApiCall
//   };
// } 
