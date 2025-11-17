import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus, View, PanResponder } from 'react-native';
import { useAppLock } from '@/contexts/AppLockContext';

/**
 * Component wrapper that tracks user interactions
 * Wrap your app content with this to automatically track touches and scrolls
 * This ensures auto-lock only triggers on actual inactivity, not just time passing
 */
interface UserActivityTrackerProps {
  children: React.ReactNode;
}

export const UserActivityTracker: React.FC<UserActivityTrackerProps> = ({ children }) => {
  const { updateLastActiveOnInteraction, isAppLocked } = useAppLock();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Throttle updates to avoid excessive AsyncStorage writes
  // Update at most once every 10 seconds
  const THROTTLE_INTERVAL = 10000;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  const handleInteraction = useCallback(() => {
    // Only track if app is active and not locked
    if (appState.current !== 'active' || isAppLocked) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Throttle: only update if enough time has passed
    if (timeSinceLastUpdate < THROTTLE_INTERVAL) {
      // Clear existing timeout and set a new one
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      // Schedule update after throttle interval
      throttleTimeoutRef.current = setTimeout(() => {
        updateLastActiveOnInteraction();
        lastUpdateRef.current = Date.now();
      }, THROTTLE_INTERVAL - timeSinceLastUpdate);

      return;
    }

    // Update immediately if enough time has passed
    updateLastActiveOnInteraction();
    lastUpdateRef.current = now;
  }, [isAppLocked, updateLastActiveOnInteraction]);

  // Create PanResponder to track touch events without blocking them
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          handleInteraction();
          return false; // Don't block touch events
        },
        onMoveShouldSetPanResponder: () => {
          handleInteraction();
          return false; // Don't block touch events
        },
        onPanResponderGrant: () => {
          handleInteraction();
        },
        onPanResponderMove: () => {
          handleInteraction();
        },
      }),
    [handleInteraction]
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

