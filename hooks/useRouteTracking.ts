import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { createRoutePersistence } from '@/lib/route-persistence';

export function useRouteTracking() {
  const pathname = usePathname();
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user && pathname) {
      const routePersistence = createRoutePersistence(session.user.id);
      routePersistence.saveLastRoute(pathname);
    }
  }, [pathname, session?.user]);
} 