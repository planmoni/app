// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useCallback } from 'react';
// import { useErrorHandling } from './useErrorHandling';
// import { useIsOnline } from './useIsOnline';
// 
// export interface NetworkErrorHandlerOptions {
//   showAlert?: boolean;
//   showToast?: boolean;
//   retryable?: boolean;
//   onRetry?: () => void;
// }
// 
// export function useNetworkErrorHandler() {
//   const { handleNetworkError, isNetworkError, isRetryableError } = useErrorHandling();
//   const { isOnline } = useIsOnline();
// 
//   const handleApiError = useCallback((
//     error: any,
//     options: NetworkErrorHandlerOptions = {}
//   ) => {
//     const {
//       showAlert = false,
//       showToast = true,
//       retryable = undefined,
//       onRetry
//     } = options;
// 
//     // Check if it's a network error
//     if (isNetworkError(error)) {
//       return handleNetworkError(error, {
//         showAlert,
//         showToast,
//         // handleNetworkError expects specific option shape; pass retryable as part of a second param if supported
//         ...(typeof retryable !== 'undefined' ? { retryable } : { retryable: true })
//       } as any);
//     }
// 
//     // Handle other API errors
//     return handleNetworkError(error, {
//       showAlert,
//       showToast,
//       ...(typeof retryable !== 'undefined' ? { retryable } : { retryable: isRetryableError(error) })
//     } as any);
//   }, [handleNetworkError, isNetworkError, isRetryableError]);
// 
//   const createApiWrapper = useCallback((
//     apiCall: () => Promise<any>,
//     options: NetworkErrorHandlerOptions = {}
//   ) => {
//     return async () => {
//       try {
//         // Check network connectivity first
//         if (!isOnline) {
//           throw new Error('No internet connection available');
//         }
// 
//         return await apiCall();
//       } catch (error) {
//         handleApiError(error, options);
//         throw error;
//       }
//     };
//   }, [isOnline, handleApiError]);
// 
//   return {
//     handleApiError,
//     createApiWrapper,
//     isNetworkError,
//     isRetryableError,
//     isOnline
//   };
// } 
