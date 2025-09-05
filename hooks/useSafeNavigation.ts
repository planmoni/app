import { useRouter } from 'expo-router';
import { useErrorHandling } from './useErrorHandling';

export function useSafeNavigation() {
  const router = useRouter();
  const { handleError } = useErrorHandling();

  const safePush = (path: string) => {
    try {
      // Validate path exists
      if (!path || path === '' || path.includes('undefined') || path.includes('null')) {
        handleError('Invalid navigation path', { preventNavigation: true });
        return false;
      }

      // Check for common error paths
      if (path.includes('error') || path.includes('not-found') || path.includes('404')) {
        handleError('Navigation to error page prevented', { preventNavigation: true });
        return false;
      }

      router.push(path);
      return true;
    } catch (error) {
      handleError(`Navigation failed: ${error}`, { preventNavigation: true });
      return false;
    }
  };

  const safeReplace = (path: string) => {
    try {
      // Validate path exists
      if (!path || path === '' || path.includes('undefined') || path.includes('null')) {
        handleError('Invalid navigation path', { preventNavigation: true });
        return false;
      }

      // Check for common error paths
      if (path.includes('error') || path.includes('not-found') || path.includes('404')) {
        handleError('Navigation to error page prevented', { preventNavigation: true });
        return false;
      }

      router.replace(path);
      return true;
    } catch (error) {
      handleError(`Navigation failed: ${error}`, { preventNavigation: true });
      return false;
    }
  };

  const safeBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
        return true;
      } else {
        // If can't go back, go to home
        safeReplace('/(tabs)');
        return true;
      }
    } catch (error) {
      handleError(`Back navigation failed: ${error}`, { preventNavigation: true });
      return false;
    }
  };

  return {
    safePush,
    safeReplace,
    safeBack,
    router
  };
}