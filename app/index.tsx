import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { router } from 'expo-router';

/**
 * Entry route: redirect to tabs immediately without importing native animation modules.
 * Keeps cold start free of react-native-reanimated initialization.
 */
export default function IndexRedirect() {
  useEffect(() => {
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        try {
          router.replace('/(tabs)');
        } catch (error) {
          console.warn('Index redirect failed, retrying:', error);
          setTimeout(() => router.replace('/(tabs)'), 300);
        }
      });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
