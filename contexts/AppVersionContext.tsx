import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { getItem, saveItem } from '@/lib/secure-storage';

type AppVersionData = {
  android_version: string;
  ios_version: string;
  android_build: number;
  ios_build: number;
  android_update_url: string;
  ios_update_url: string;
  update_message: string;
  force_update: boolean;
};

type AppVersionContextType = {
  needsUpdate: boolean;
  updateData: AppVersionData | null;
  currentVersion: string;
  currentBuild: number;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  isChecking: boolean;
};

const AppVersionContext = createContext<AppVersionContextType | undefined>(undefined);

const DISMISSED_VERSION_KEY = 'dismissed_update_version';

export function AppVersionProvider({ children }: { children: React.ReactNode }) {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateData, setUpdateData] = useState<AppVersionData | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Get current app version and build number
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const currentBuild = Platform.OS === 'android'
    ? (Constants.expoConfig?.android?.versionCode || 1)
    : (Constants.expoConfig?.ios?.buildNumber ? parseInt(Constants.expoConfig.ios.buildNumber) : 1);

  const compareVersions = (current: string, required: string): number => {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;

      if (currentPart < requiredPart) return -1;
      if (currentPart > requiredPart) return 1;
    }

    return 0;
  };

  const checkForUpdates = useCallback(async () => {
    try {
      setIsChecking(true);
      console.log('🔄 Checking for app updates...', {
        platform: Platform.OS,
        currentVersion,
        currentBuild
      });

      // Fetch active version from Supabase
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error fetching app version:', error);
        return;
      }

      if (!data) {
        console.log('ℹ️ No active version found in database');
        return;
      }

      console.log('📦 Server version data:', data);

      // Determine which version to check based on platform
      const serverVersion = Platform.OS === 'android' ? data.android_version : data.ios_version;
      const serverBuild = Platform.OS === 'android' ? data.android_build : data.ios_build;

      console.log('🔍 Version comparison:', {
        current: { version: currentVersion, build: currentBuild },
        server: { version: serverVersion, build: serverBuild }
      });

      // Check if update is needed (compare build numbers for accuracy)
      const buildNeedsUpdate = currentBuild < serverBuild;
      const versionNeedsUpdate = compareVersions(currentVersion, serverVersion) < 0;

      console.log('📊 Update check results:', {
        buildNeedsUpdate,
        versionNeedsUpdate,
        needsUpdate: buildNeedsUpdate || versionNeedsUpdate
      });

      if (buildNeedsUpdate || versionNeedsUpdate) {
        // Check if user has dismissed this version
        const dismissedVersion = await getItem(DISMISSED_VERSION_KEY);
        const dismissedBuild = dismissedVersion ? parseInt(dismissedVersion) : 0;

        console.log('🚫 Dismissed version check:', {
          dismissedBuild,
          serverBuild,
          forceUpdate: data.force_update
        });

        // Show update if:
        // 1. It's a force update, OR
        // 2. User hasn't dismissed this specific version
        if (data.force_update || dismissedBuild < serverBuild) {
          console.log('✅ Update available! Showing update prompt');
          setUpdateData(data);
          setNeedsUpdate(true);
        } else {
          console.log('ℹ️ Update available but user dismissed it');
          setNeedsUpdate(false);
        }
      } else {
        console.log('✅ App is up to date');
        setNeedsUpdate(false);
        setUpdateData(null);
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion, currentBuild]);

  const dismissUpdate = useCallback(async () => {
    if (!updateData) return;

    try {
      // Save the dismissed version build number
      const dismissedBuild = Platform.OS === 'android'
        ? updateData.android_build
        : updateData.ios_build;

      console.log('🚫 Dismissing update for build:', dismissedBuild);
      await saveItem(DISMISSED_VERSION_KEY, dismissedBuild.toString());

      setNeedsUpdate(false);
    } catch (error) {
      console.error('❌ Error dismissing update:', error);
    }
  }, [updateData]);

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  // Check for updates when app comes to foreground
  useEffect(() => {
    const interval = setInterval(() => {
      checkForUpdates();
    }, 60000 * 60); // Check every hour

    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return (
    <AppVersionContext.Provider
      value={{
        needsUpdate,
        updateData,
        currentVersion,
        currentBuild,
        checkForUpdates,
        dismissUpdate,
        isChecking,
      }}
    >
      {children}
    </AppVersionContext.Provider>
  );
}

export function useAppVersion() {
  const context = useContext(AppVersionContext);
  if (context === undefined) {
    throw new Error('useAppVersion must be used within an AppVersionProvider');
  }
  return context;
}
