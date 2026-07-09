import { useEffect, useState } from 'react';

/**
 * Caps loading spinners so a hung fetch cannot block the UI indefinitely.
 * Returns effective loading state and whether the cap was hit (for retry UI).
 */
export function useLoadingGuard(
  isLoading: boolean,
  hasData: boolean,
  maxMs = 12000
): { isLoading: boolean; isTimedOut: boolean; resetTimeout: () => void } {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [tick, setTick] = useState(0);

  const resetTimeout = () => {
    setIsTimedOut(false);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!isLoading || hasData) {
      setIsTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, maxMs);

    return () => clearTimeout(timer);
  }, [isLoading, hasData, maxMs, tick]);

  const effectiveLoading = isLoading && !hasData && !isTimedOut;

  return { isLoading: effectiveLoading, isTimedOut, resetTimeout };
}
