import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  ProfileSnapshot, 
  UserMetadataSnapshot, 
  ProfileSnapshotManager 
} from '@/lib/profileSnapshot';

interface ProfileContextType {
  profile: ProfileSnapshot | null;
  metadata: UserMetadataSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<ProfileSnapshot>) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [metadata, setMetadata] = useState<UserMetadataSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile data when session changes
  useEffect(() => {
    if (session?.user?.id) {
      loadProfileData();
    } else {
      // Clear profile data when no session
      setProfile(null);
      setMetadata(null);
      setError(null);
    }
  }, [session?.user?.id]);

  const loadProfileData = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load profile with snapshot fallback
      const profileData = await ProfileSnapshotManager.getProfileWithSnapshot(
        session.user.id,
        (freshProfile) => {
          // Update with fresh data when available
          setProfile(freshProfile);
        }
      );

      if (profileData) {
        setProfile(profileData);
      }

      // Load metadata snapshot
      const metadataData = await ProfileSnapshotManager.loadMetadataSnapshot(session.user.id);
      if (metadataData) {
        setMetadata(metadataData);
      } else if (session.user.user_metadata) {
        // Save current metadata as snapshot
        await ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
        setMetadata(session.user.user_metadata);
      }

    } catch (err) {
      console.error('Error loading profile data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Refresh profile snapshot
      const freshProfile = await ProfileSnapshotManager.refreshProfileSnapshot(session.user.id);
      if (freshProfile) {
        setProfile(freshProfile);
      }

      // Refresh metadata if available
      if (session.user.user_metadata) {
        await ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
        setMetadata(session.user.user_metadata);
      }

    } catch (err) {
      console.error('Error refreshing profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh profile');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<ProfileSnapshot>): Promise<boolean> => {
    if (!session?.user?.id) return false;

    try {
      setError(null);

      // Update in Supabase
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      if (data) {
        // Update local state
        setProfile(data);
        
        // Save as new snapshot
        await ProfileSnapshotManager.saveProfileSnapshot(session.user.id, data);
        
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    }
  };

  const value: ProfileContextType = {
    profile,
    metadata,
    isLoading,
    error,
    refreshProfile,
    updateProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}; 