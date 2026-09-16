// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useState, useEffect, useCallback, useRef } from 'react';
// import { useAppForeground } from '@/hooks/useAppForeground';
// import {
//   fetchWithRetry,
//   readCache,
//   writeCache,
//   toUserFacingError,
//   warmConnection,
// } from '@/lib/supabase-fetch';
// 
// export type UseStaleSupabaseQueryOptions<T> = {
//   cacheKey: string | null;
//   enabled?: boolean;
//   queryFn: () => Promise<T>;
//   label?: string;
//   refetchOnForeground?: boolean;
//   warmConnectionBeforeFetch?: boolean;
// };
// 
// export function useStaleSupabaseQuery<T>({
//   cacheKey,
//   enabled = true,
//   queryFn,
//   label = 'Query',
//   refetchOnForeground = true,
//   warmConnectionBeforeFetch = false,
// }: UseStaleSupabaseQueryOptions<T>) {
//   const [data, setData] = useState<T | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [isStale, setIsStale] = useState(false);
//   const foregroundTick = useAppForeground();
//   const hasCachedDataRef = useRef(false);
// 
//   const fetchData = useCallback(
//     async (options?: { warm?: boolean }) => {
//       if (!enabled) {
//         setIsLoading(false);
//         return;
//       }
// 
//       try {
//         if (!hasCachedDataRef.current) {
//           setIsLoading(true);
//         }
//         setError(null);
//         setIsStale(false);
// 
//         if (options?.warm ?? warmConnectionBeforeFetch) {
//           await warmConnection();
//         }
// 
//         const result = await fetchWithRetry(queryFn, label);
//         setData(result);
//         hasCachedDataRef.current = true;
// 
//         if (cacheKey) {
//           await writeCache(cacheKey, result);
//         }
//       } catch (err) {
//         console.warn(`[${label}] fetch failed:`, err);
//         if (!hasCachedDataRef.current) {
//           setError(toUserFacingError(err, false));
//         } else {
//           setIsStale(true);
//           setError(toUserFacingError(err, true));
//         }
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [enabled, cacheKey, queryFn, label, warmConnectionBeforeFetch]
//   );
// 
//   useEffect(() => {
//     if (!enabled) {
//       hasCachedDataRef.current = false;
//       setData(null);
//       setIsLoading(false);
//       setError(null);
//       setIsStale(false);
//       return;
//     }
// 
//     let isMounted = true;
// 
//     const init = async () => {
//       if (cacheKey) {
//         const cached = await readCache<T>(cacheKey);
//         if (cached != null && isMounted) {
//           setData(cached);
//           setIsLoading(false);
//           hasCachedDataRef.current = true;
//         }
//       }
// 
//       if (!isMounted) return;
//       void fetchData();
//     };
// 
//     void init();
// 
//     return () => {
//       isMounted = false;
//     };
//   }, [enabled, cacheKey, fetchData]);
// 
//   useEffect(() => {
//     if (!enabled || !refetchOnForeground || foregroundTick === 0) {
//       return;
//     }
//     void fetchData({ warm: true });
//   }, [foregroundTick, enabled, refetchOnForeground, fetchData]);
// 
//   const refetch = useCallback(async () => {
//     await warmConnection();
//     await fetchData();
//   }, [fetchData]);
// 
//   return {
//     data,
//     isLoading,
//     error,
//     isStale,
//     refetch,
//     hasCachedData: hasCachedDataRef.current,
//   };
// }
// 
