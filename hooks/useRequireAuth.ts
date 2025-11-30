import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useCallback } from 'react';

/**
 * Hook to require authentication before performing actions
 * Redirects to login if user is not authenticated
 */
export function useRequireAuth() {
  const { session } = useAuth();

  const requireAuth = useCallback((action?: () => void, returnPath?: string) => {
    if (!session?.user?.id) {
      // Build login URL with return path
      const loginPath = returnPath 
        ? `/(auth)/login?returnTo=${encodeURIComponent(returnPath)}`
        : '/(auth)/login';
      
      router.push(loginPath);
      return false;
    }
    
    // User is authenticated, execute action if provided
    if (action) {
      action();
    }
    
    return true;
  }, [session]);

  return {
    requireAuth,
    isAuthenticated: !!session?.user?.id
  };
}

