import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useAutoLogout } from '@/contexts/AutoLogoutContext';

export const usePageTracking = () => {
  const pathname = usePathname();
  const { setLastActivePage, isAppLocked } = useAutoLogout();

  useEffect(() => {
    // Only track pages when the app is not locked
    if (!isAppLocked && pathname) {
      console.log('usePageTracking - Current page:', pathname);
      setLastActivePage(pathname);
    }
  }, [pathname, isAppLocked, setLastActivePage]);

  return pathname;
}; 