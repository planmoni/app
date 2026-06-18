import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { withRetryOnTimeout } from './with-timeout';

const PROFILE_FETCH_TIMEOUT_MS = 15000;

export interface ProfileSnapshot {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  // Add other profile fields as needed
  referral_code?: string | null;
  email_verified?: boolean;
  app_lock_enabled?: boolean;
  two_factor_enabled?: boolean;
  account_verified?: boolean;
  kyc_tier?: number;
}

export interface UserMetadataSnapshot {
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Profile snapshot management for instant UI loading
 * Stores profile data in AsyncStorage with user-specific keys
 */
export class ProfileSnapshotManager {
  private static readonly PROFILE_SNAPSHOT_PREFIX = 'profile_snapshot_';
  private static readonly METADATA_SNAPSHOT_PREFIX = 'metadata_snapshot_';

  /**
   * Save profile snapshot for a user
   */
  static async saveProfileSnapshot(userId: string, profile: ProfileSnapshot): Promise<void> {
    try {
      const key = `${this.PROFILE_SNAPSHOT_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(profile));
      console.log('📸 Profile snapshot saved for user:', userId);
    } catch (error) {
      console.error('Error saving profile snapshot:', error);
    }
  }

  /**
   * Load profile snapshot for a user
   */
  static async loadProfileSnapshot(userId: string): Promise<ProfileSnapshot | null> {
    try {
      const key = `${this.PROFILE_SNAPSHOT_PREFIX}${userId}`;
      const snapshot = await AsyncStorage.getItem(key);
      
      if (snapshot) {
        const profile = JSON.parse(snapshot) as ProfileSnapshot;
        console.log('📸 Profile snapshot loaded for user:', userId);
        return profile;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading profile snapshot:', error);
      return null;
    }
  }

  /**
   * Save user metadata snapshot
   */
  static async saveMetadataSnapshot(userId: string, metadata: UserMetadataSnapshot): Promise<void> {
    try {
      const key = `${this.METADATA_SNAPSHOT_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(metadata));
      console.log('📸 Metadata snapshot saved for user:', userId);
    } catch (error) {
      console.error('Error saving metadata snapshot:', error);
    }
  }

  /**
   * Load user metadata snapshot
   */
  static async loadMetadataSnapshot(userId: string): Promise<UserMetadataSnapshot | null> {
    try {
      const key = `${this.METADATA_SNAPSHOT_PREFIX}${userId}`;
      const snapshot = await AsyncStorage.getItem(key);
      
      if (snapshot) {
        const metadata = JSON.parse(snapshot) as UserMetadataSnapshot;
        console.log('📸 Metadata snapshot loaded for user:', userId);
        return metadata;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading metadata snapshot:', error);
      return null;
    }
  }

  /**
   * Clear profile snapshot for a user (on logout)
   */
  static async clearProfileSnapshot(userId: string): Promise<void> {
    try {
      const profileKey = `${this.PROFILE_SNAPSHOT_PREFIX}${userId}`;
      const metadataKey = `${this.METADATA_SNAPSHOT_PREFIX}${userId}`;
      
      await AsyncStorage.multiRemove([profileKey, metadataKey]);
      console.log('��️ Profile snapshots cleared for user:', userId);
    } catch (error) {
      console.error('Error clearing profile snapshots:', error);
    }
  }

  /**
   * Clear all profile snapshots (for cleanup)
   */
  static async clearAllProfileSnapshots(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const profileKeys = keys.filter(key => 
        key.startsWith(this.PROFILE_SNAPSHOT_PREFIX) || 
        key.startsWith(this.METADATA_SNAPSHOT_PREFIX)
      );
      
      if (profileKeys.length > 0) {
        await AsyncStorage.multiRemove(profileKeys);
        console.log('🗑️ All profile snapshots cleared');
      }
    } catch (error) {
      console.error('Error clearing all profile snapshots:', error);
    }
  }

  /**
   * Fetch fresh profile data from Supabase and save as snapshot
   */
  static async refreshProfileSnapshot(userId: string): Promise<ProfileSnapshot | null> {
    try {
      console.log('�� Refreshing profile snapshot for user:', userId);
      
      // Fetch fresh profile data
      const { data: profile, error } = await withRetryOnTimeout(
        () =>
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single(),
        PROFILE_FETCH_TIMEOUT_MS,
        'Profile snapshot refresh'
      ) as { data: ProfileSnapshot | null; error: { message?: string } | null };

      if (error) {
        console.error('Error fetching profile data:', error);
        return null;
      }

      if (profile) {
        // Save as snapshot
        await this.saveProfileSnapshot(userId, profile);
        return profile;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing profile snapshot:', error);
      return null;
    }
  }

  /**
   * Get profile data with fallback to snapshot
   * Returns snapshot immediately, then fetches fresh data in background
   */
  static async getProfileWithSnapshot(
    userId: string, 
    onFreshData?: (profile: ProfileSnapshot) => void
  ): Promise<ProfileSnapshot | null> {
    try {
      // Load snapshot immediately
      const snapshot = await this.loadProfileSnapshot(userId);
      
      // Fetch fresh data in background
      this.refreshProfileSnapshot(userId).then(freshProfile => {
        if (freshProfile && onFreshData) {
          onFreshData(freshProfile);
        }
      }).catch(error => {
        console.error('Background profile refresh failed:', error);
      });

      return snapshot;
    } catch (error) {
      console.error('Error getting profile with snapshot:', error);
      return null;
    }
  }

  /**
   * Get user metadata with fallback to snapshot
   */
  static async getMetadataWithSnapshot(
    userId: string,
    onFreshData?: (metadata: UserMetadataSnapshot) => void
  ): Promise<UserMetadataSnapshot | null> {
    try {
      // Load snapshot immediately
      const snapshot = await this.loadMetadataSnapshot(userId);
      
      // Fetch fresh data in background (from session)
      // This would typically come from the auth session
      // For now, we'll just return the snapshot
      
      return snapshot;
    } catch (error) {
      console.error('Error getting metadata with snapshot:', error);
      return null;
    }
  }
}

// Export convenience functions
export const {
  saveProfileSnapshot,
  loadProfileSnapshot,
  saveMetadataSnapshot,
  loadMetadataSnapshot,
  clearProfileSnapshot,
  clearAllProfileSnapshots,
  refreshProfileSnapshot,
  getProfileWithSnapshot,
  getMetadataWithSnapshot
} = ProfileSnapshotManager; 