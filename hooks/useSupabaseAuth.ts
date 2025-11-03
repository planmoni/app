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
import { useAppError } from '@/contexts/AppErrorContext';

type AuthResult = {
  success: boolean;
  error?: string;
};

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setError: setAppError } = useAppError();

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
            expiresAt: storedSession.expires_at ? new Date(storedSession.expires_at * 1000).toISOString() : 'unknown',
            isExpired: isSessionExpired(storedSession)
          });
          
          // Validate stored session has valid user
          if (!storedSession.user?.id) {
            console.log('⚠️ Stored session has no valid user, clearing it');
            await clearSession();
          } else {
            // Restore session in Supabase auth state
            const restored = await restoreSessionInSupabase(storedSession);
            
            if (restored && mounted) {
              setSession(storedSession);
              console.log('✅ Session fully restored and set in state');
              console.log('🎉 User should now be logged in after device restart');
              
              // Load profile snapshot immediately for instant UI
              const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(storedSession.user.id);
              if (profileSnapshot) {
                console.log('📸 Profile snapshot loaded for instant UI');
              }
            } else {
              console.log('❌ Failed to restore session in Supabase, falling back to Supabase check');
              console.log('🔄 This might happen if the session is invalid or corrupted');
              // Fall through to Supabase check
            }
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
            
            // Validate session has valid user before setting it
            if (session?.user?.id && !isSessionExpired(session)) {
              if (mounted) {
                setSession(session);
              }
              
              // Save session to secure storage
              await saveSession(session);
              
              // Load profile snapshot for new session
              const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(session.user.id);
              if (profileSnapshot) {
                console.log('📸 Profile snapshot loaded for new session');
              }
            } else if (session && (!session.user?.id || isSessionExpired(session))) {
              // Session exists but is invalid or expired - clear it
              console.log('⚠️ Initial session is invalid or expired, clearing');
              if (mounted) {
                setSession(null);
                setError('Session expired or invalid');
              }
              await clearSession();
            } else {
              // No session at all
              if (mounted) {
                setSession(null);
              }
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication initialization failed';
        console.error('❌ Error during auth initialization:', err);
        setError(message);
        // Treat initialization exceptions as fatal startup errors so the layout
        // can render a blocking fallback. This avoids leaving the app in a
        // partially-initialized state.
        try {
          setAppError(message, true);
        } catch (e) {
          // If AppError context is not available for any reason, just log.
          console.warn('useSupabaseAuth: failed to report fatal app error', e);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session');
      
      if (!mounted) return;

      // Handle different auth events
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('✅ User signed in or token refreshed');
        
        // Validate session has valid user before setting it
        if (session?.user?.id) {
          setSession(session);
          setError(null);
          await saveSession(session);
          
          // Load profile snapshot for new/refreshed session
          const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(session.user.id);
          if (profileSnapshot) {
            console.log('📸 Profile snapshot loaded for auth state change');
          }
        } else {
          // Session exists but no valid user - treat as logged out
          console.log('⚠️ Session exists but user is invalid, clearing session');
          setSession(null);
          setError('Session expired or invalid');
          await clearSession();
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
        if (session?.user?.id) {
          setSession(session);
          await saveSession(session);
          
          // Update metadata snapshot
          if (session.user.user_metadata) {
            await ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
          }
        } else {
          // Updated session has no valid user - treat as logged out
          console.log('⚠️ Updated session has no valid user, clearing session');
          setSession(null);
          setError('Session expired or invalid');
          await clearSession();
        }
      }
    });

    // Set up proactive session refresh to keep sessions alive
    const maintainSessionAlive = () => {
      const interval = setInterval(async () => {
        if (!mounted) {
          clearInterval(interval);
          return;
        }

        // Check current session validity
        const currentSession = await supabase.auth.getSession();
        const { data: { session: currentAuthSession }, error: sessionError } = currentSession;

        if (sessionError) {
          console.log('⚠️ Session validation error:', sessionError.message);
          // Session is invalid, trigger session expired modal
          if (mounted) {
            setSession(null);
            setError('JWT expired');
            await clearSession();
          }
          return;
        }

        // If session exists and is valid
        if (currentAuthSession && currentAuthSession.user?.id) {
          // Check if session is about to expire (within 5 minutes)
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = currentAuthSession.expires_at || 0;
          const timeUntilExpiry = expiresAt - now;

          // If session expires in less than 5 minutes, proactively refresh it
          if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
            console.log('🔄 Session expiring soon, proactively refreshing...', {
              timeUntilExpiry: `${timeUntilExpiry}s`,
              expiresAt: new Date(expiresAt * 1000).toISOString()
            });

            try {
              const { data, error: refreshError } = await supabase.auth.refreshSession();

              if (refreshError) {
                console.error('❌ Failed to refresh session:', refreshError);
                // Trigger session expired modal
                if (mounted) {
                  setSession(null);
                  setError('JWT expired');
                  await clearSession();
                }
              } else if (data.session) {
                console.log('✅ Session refreshed proactively');
                if (mounted) {
                  setSession(data.session);
                  await saveSession(data.session);
                }
              }
            } catch (error) {
              console.error('❌ Error refreshing session:', error);
            }
          } else if (timeUntilExpiry <= 0) {
            // Session has expired
            console.log('⏰ Session has expired');
            if (mounted) {
              setSession(null);
              setError('JWT expired');
              await clearSession();
            }
          }
        } else if (currentAuthSession && (!currentAuthSession.user?.id || isSessionExpired(currentAuthSession))) {
          console.log('⚠️ Periodic check: Session expired or invalid, clearing');
          if (mounted) {
            setSession(null);
            setError('JWT expired');
            await clearSession();
          }
        } else if (!currentAuthSession && mounted && session) {
          // No session exists but we had one before - session expired
          console.log('⚠️ Session lost unexpectedly');
          if (mounted) {
            setSession(null);
            setError('JWT expired');
            await clearSession();
          }
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    };
    
    const validationCleanup = maintainSessionAlive();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      validationCleanup();
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