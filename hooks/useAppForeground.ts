import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/** When the app last left `active` (inactive/background). */
let lastBackgroundedAt: number | null = null;
/** Duration of the most recent background/inactive spell (ms). */
let lastBackgroundDurationMs = 0;

export function getLastBackgroundDurationMs(): number {
  return lastBackgroundDurationMs;
}

export function getLastBackgroundedAt(): number | null {
  return lastBackgroundedAt;
}

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

      if (prev === 'active' && nextState.match(/inactive|background/)) {
        lastBackgroundedAt = Date.now();
      }

      if (prev.match(/inactive|background/) && nextState === 'active') {
        if (lastBackgroundedAt != null) {
          lastBackgroundDurationMs = Date.now() - lastBackgroundedAt;
        } else {
          lastBackgroundDurationMs = 0;
        }
        lastBackgroundedAt = null;
        setTick((t) => t + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  return tick;
}
