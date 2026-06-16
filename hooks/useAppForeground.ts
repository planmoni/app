import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Increments each time the app returns to the foreground from background/inactive.
 * Use as a dependency to refetch stale dashboard data.
 */
export function useAppForeground(): number {
  const [tick, setTick] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        setTick((t) => t + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  return tick;
}
