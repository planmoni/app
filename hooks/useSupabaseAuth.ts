import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { 
  saveSession, 
  loadSession, 
  clearSession, 
  restoreSessionInSupabase, 
  refreshExpiredSession, 
  canRefreshSession, 
  isSessionExpired 
} from '@/lib/session-persistence';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';

type AuthResult = {
  success: boolean;
  error?: string;
};

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing auth session...');
        console.log('📱 App started - checking for persistent session...');
        
        // First, try to load session from secure storage
        const storedSession = await loadSession();
        console.log('🔍 Stored session check result:', storedSession ? 'Found' : 'Not found');
        
        if (storedSession && !isSessionExpired(storedSession)) {
          console.log('✅ Valid stored session found, attempting restoration...');
          console.log('📊 Session details:', {
            userId: storedSession.user?.id,
            expiresAt: new Date(storedSession.expires_at * 1000).toISOString(),
            isExpired: isSessionExpired(storedSession)
          });
          
          // Restore session in Supabase auth state
          const restored = await restoreSessionInSupabase(storedSession);
          
          if (restored && mounted) {
            setSession(storedSession);
            console.log('✅ Session fully restored and set in state');
            console.log('🎉 User should now be logged in after device restart');
            
            // Load profile snapshot immediately for instant UI
            if (storedSession.user?.id) {
              const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(storedSession.user.id);
              if (profileSnapshot) {
                console.log('📸 Profile snapshot loaded for instant UI');
              }
            }
          } else {
            console.log('❌ Failed to restore session in Supabase, falling back to Supabase check');
            console.log('🔄 This might happen if the session is invalid or corrupted');
            // Fall through to Supabase check
          }
        } else if (storedSession && isSessionExpired(storedSession)) {
          console.log('⏰ Stored session found but expired');
          
          // Check if we can refresh the session
          if (canRefreshSession(storedSession)) {
            console.log('🔄 Attempting to refresh expired session...');
            const refreshedSession = await refreshExpiredSession(storedSession);
            
            if (refreshedSession && mounted) {
              setSession(refreshedSession);
              console.log('✅ Session refreshed and restored successfully');
              
              // Load profile snapshot for refreshed session
              if (refreshedSession.user?.id) {
                const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(refreshedSession.user.id);
                if (profileSnapshot) {
                  console.log('📸 Profile snapshot loaded for refreshed session');
                }
              }
            } else {
              console.log('❌ Failed to refresh session, clearing it...');
              await clearSession();
            }
          } else {
            console.log('❌ Cannot refresh session, clearing it...');
            await clearSession();
          }
        }
        
        // If no stored session or restoration failed, check Supabase
        if (!storedSession || isSessionExpired(storedSession)) {
          console.log('📭 No valid stored session, checking Supabase...');
          console.log('🔍 Reason:', !storedSession ? 'No stored session' : 'Stored session expired');
          
          // Get initial session from Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          console.log('🔍 Supabase session check result:', session ? 'Found' : 'Not found');
          
          if (sessionError) {
            console.error('❌ Error getting initial session:', sessionError);
            setError(sessionError.message);
          } else {
            console.log('✅ Initial session loaded:', session ? 'User logged in' : 'No session');
            if (mounted) {
              setSession(session);
            }
            
            // Save session to secure storage
            if (session) {
              await saveSession(session);
              
              // Load profile snapshot for new session
              if (session.user?.id) {
                const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(session.user.id);
                if (profileSnapshot) {
                  console.log('📸 Profile snapshot loaded for new session');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('❌ Error during auth initialization:', err);
        setError(err instanceof Error ? err.message : 'Authentication initialization failed');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session');
      
      if (!mounted) return;

      // Handle different auth events
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('✅ User signed in or token refreshed');
        setSession(session);
        setError(null);
        
        if (session) {
          await saveSession(session);
          
          // Load profile snapshot for new/refreshed session
          if (session.user?.id) {
            const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(session.user.id);
            if (profileSnapshot) {
              console.log('📸 Profile snapshot loaded for auth state change');
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out');
        setSession(null);
        setError(null);
        await clearSession();
        
        // Clear profile snapshots on sign out
        if (session?.user?.id) {
          await ProfileSnapshotManager.clearProfileSnapshot(session.user.id);
        }
      } else if (event === 'USER_UPDATED') {
        console.log('👤 User updated');
        if (session) {
          setSession(session);
          await saveSession(session);
          
          // Update metadata snapshot
          if (session.user?.id && session.user.user_metadata) {
            await ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        await saveSession(data.session);
        
        // Load profile snapshot for signed in user
        if (data.session.user?.id) {
          const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(data.session.user.id);
          if (profileSnapshot) {
            console.log('📸 Profile snapshot loaded for sign in');
          }
        }
        
        return { success: true };
      }

      return { success: false, error: 'No session returned' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: any): Promise<AuthResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear profile snapshots before signing out
      if (session?.user?.id) {
        await ProfileSnapshotManager.clearProfileSnapshot(session.user.id);
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        setError(error.message);
        throw error;
      }

      setSession(null);
      await clearSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign out failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    session,
    isLoading,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
  };
}