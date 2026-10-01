import { useState, useEffect, useRef, useCallback } from 'react';
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
import { setAuthExpiredHandler, setSessionRefreshedHandler } from '@/lib/supabase-reconnect';
import { buildExpiredSessionRecovery, saveExpiredSessionRecovery } from '@/lib/auth-recovery';
import { clearExpiredAuthState, clearUserCachesOnSignOut } from '@/lib/auth-cache-reset';
import {
  invalidateFinancialQueries,
  removeFinancialQueries,
} from '@/lib/queries/invalidateFinancialQueries';
import { logAuthTelemetry } from '@/lib/auth-telemetry';
import { AUTH_READY_GUARD_MS } from '@/lib/auth-ready-guard';
import { seedSessionCache, clearSessionCache } from '@/lib/supabase-session';
import { shouldInvalidateWalletOnAuthEvent } from '@/lib/wallet-refresh-policy.mjs';
import { beginSupabaseAutoRefresh } from '@/lib/supabase';

function sessionIsReadyForApi(session: Session | null): boolean {
  if (!session?.user?.id || !session.access_token) return false;
  return !isSessionExpired(session);
}

/** True when auth init is done and the session (if any) has a usable access token. */
export function resolveAuthReady(session: Session | null): boolean {
  if (!session?.user?.id) return true;
  return sessionIsReadyForApi(session);
}

type AuthResult = {
  success: boolean;
  error?: string;
  session?: Session | null;
};

const AUTH_EXPIRED_PATTERNS = [
  'refresh_token_not_found',
  'invalid refresh token',
  'jwt expired',
  'session expired',
  'session_not_found',
  'authsessionmissingerror',
  'session missing',
];

function isDefinitiveAuthExpiredError(message: string): boolean {
  const lower = message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isTransientSessionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection')
  );
}

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setError: setAppError } = useAppError();

  const sessionRef = useRef<Session | null>(null);
  const isAuthReadyRef = useRef(false);
  const signingOutRef = useRef(false);
  const authReadyGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    isAuthReadyRef.current = isAuthReady;
  }, [isAuthReady]);

  const clearAuthReadyGuard = useCallback(() => {
    if (authReadyGuardRef.current) {
      clearTimeout(authReadyGuardRef.current);
      authReadyGuardRef.current = null;
    }
  }, []);

  const markAuthReady = useCallback(
    (ready: boolean, source: string, sess: Session | null) => {
      isAuthReadyRef.current = ready;
      setIsAuthReady(ready);
      logAuthTelemetry('ready_change', {
        isAuthReady: ready,
        source,
        hasSession: !!sess?.user?.id,
        tokenExpired: sess ? isSessionExpired(sess) : false,
      });
      if (ready) {
        clearAuthReadyGuard();
      }
    },
    [clearAuthReadyGuard]
  );

  const prepareExpiredSessionState = useCallback(async (expiredSession: Session | null) => {
    try {
      const recovery = await buildExpiredSessionRecovery(expiredSession);
      if (recovery) {
        await saveExpiredSessionRecovery(recovery);
      }
      await clearExpiredAuthState(expiredSession?.user?.id);
    } catch (error) {
      console.warn('useSupabaseAuth: failed to prepare expired-session recovery', error);
      await clearExpiredAuthState(expiredSession?.user?.id);
    }
  }, []);

  const scheduleAuthReadyGuard = useCallback(() => {
    clearAuthReadyGuard();
    authReadyGuardRef.current = setTimeout(() => {
      void (async () => {
        if (!mountedRef.current) return;
        if (isAuthReadyRef.current) return;

        const stuckSession = sessionRef.current;
        if (!stuckSession?.user?.id) return;

        logAuthTelemetry('stuck_timeout', {
          userId: stuckSession.user.id,
          waitedMs: AUTH_READY_GUARD_MS,
        });
        console.warn(
          '⚠️ Auth ready guard: token refresh did not complete, clearing session'
        );

        try {
          await prepareExpiredSessionState(stuckSession);
        } catch (guardErr) {
          console.warn('useSupabaseAuth: auth ready guard cleanup failed', guardErr);
        }

        if (!mountedRef.current) return;

        setSession(null);
        setError('Session expired or invalid');
        markAuthReady(true, 'stuck_timeout', null);
        removeFinancialQueries();
      })();
    }, AUTH_READY_GUARD_MS);
  }, [clearAuthReadyGuard, markAuthReady, prepareExpiredSessionState]);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    // Safety net: if session restore hangs
    const loadingGuard = setTimeout(() => {
      if (mounted) {
        console.warn('⚠️ Auth initialization exceeded 6s, releasing loading state');
        setIsLoading(false);
      }
    }, 6000);

    const initializeAuth = async () => {
      let resolvedSession: Session | null = null;
      const initStartedAt = Date.now();
      logAuthTelemetry('init_start');

      try {
        console.log('🔐 Initializing auth session...');
        console.log('📱 App started - checking for persistent session...');
        
        // First, try to load session from secure storage
        const storedSession = await loadSession();
        console.log('🔍 Stored session check result:', storedSession ? 'Found' : 'Not found');
        
        if (storedSession && !isSessionExpired(storedSession)) {
          console.log('✅ Valid stored session found, refreshing token before first requests...');
          console.log('📊 Session details:', {
            userId: storedSession.user?.id,
            expiresAt: storedSession.expires_at ? new Date(storedSession.expires_at * 1000).toISOString() : 'unknown',
            isExpired: isSessionExpired(storedSession)
          });
          
          // Validate stored session has valid user
          if (!storedSession.user?.id) {
            console.log('⚠️ Stored session has no valid user, clearing it');
            await clearSession();
          } else if (canRefreshSession(storedSession)) {
            // One refresh, awaited to completion, before any wallet/plan call.
            // Wallet and plan fetches stay gated on isAuthReady until this returns.
            const refreshedSession = await refreshExpiredSession(storedSession);
            const sessionToUse = refreshedSession ?? storedSession;

            if (!refreshedSession) {
              await restoreSessionInSupabase(storedSession);
            }

            if (mounted) {
              resolvedSession = sessionToUse;
              seedSessionCache(sessionToUse);
              setSession(sessionToUse);
              console.log(refreshedSession
                ? '✅ Cold-start token refreshed before API calls'
                : '⚠️ Token refresh finished without a new session; using stored session');

              const profileSnapshot = await ProfileSnapshotManager.loadProfileSnapshot(sessionToUse.user.id);
              if (profileSnapshot) {
                console.log('📸 Profile snapshot loaded for instant UI');
              }
            }
          } else {
            const restored = await restoreSessionInSupabase(storedSession);
            if (restored && mounted) {
              resolvedSession = storedSession;
              seedSessionCache(storedSession);
              setSession(storedSession);
            } else {
              resolvedSession = null;
            }
          }
        } else if (storedSession && isSessionExpired(storedSession)) {
          console.log('⏰ Stored session found but expired');
          
          // Check if we can refresh the session
          if (canRefreshSession(storedSession)) {
            console.log('🔄 Attempting to refresh expired session...');
            const refreshedSession = await refreshExpiredSession(storedSession);
            
            if (refreshedSession && mounted) {
              resolvedSession = refreshedSession;
              seedSessionCache(refreshedSession);
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
              resolvedSession = null;
              await prepareExpiredSessionState(storedSession);
            }
          } else {
            console.log('❌ Cannot refresh session, clearing it...');
            resolvedSession = null;
            await prepareExpiredSessionState(storedSession);
          }
        }
        
        // Always reconcile with the Supabase client when we do not yet have a usable session.
        // Previously, a non-expired storedSession + failed setSession skipped getSession() entirely
        // — first open looked "logged in"/broken until app reopen.
        if (!resolvedSession?.user?.id) {
          console.log('📭 No usable restored session, checking Supabase getSession()...');
          
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
                resolvedSession = session;
                seedSessionCache(session);
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
              // Session exists but is invalid or expired - try refresh once before clearing
              if (session.user?.id && canRefreshSession(session)) {
                console.log('⚠️ Initial session expired, attempting one refresh…');
                const refreshed = await refreshExpiredSession(session);
                if (refreshed?.user?.id && mounted) {
                  resolvedSession = refreshed;
                  seedSessionCache(refreshed);
                  setSession(refreshed);
                } else {
                  await prepareExpiredSessionState(session);
                  if (mounted) {
                    resolvedSession = null;
                    setSession(null);
                    setError('Session expired or invalid');
                  }
                }
              } else {
                console.log('⚠️ Initial session is invalid or expired, clearing');
                await prepareExpiredSessionState(session);
                if (mounted) {
                  resolvedSession = null;
                  setSession(null);
                  setError('Session expired or invalid');
                }
              }
            } else {
              // No session at all
              if (mounted) {
                resolvedSession = null;
                setSession(null);
              }
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication initialization failed';
        console.error('❌ Error during auth initialization:', err);
        const isRecoverableAuthError =
          message.includes('Invalid Refresh Token') ||
          message.includes('Refresh Token Not Found') ||
          message.includes('JWT expired') ||
          message.includes('AuthSessionMissingError') ||
          message.includes('session missing');

        if (isRecoverableAuthError) {
          // Expected stale-session path after app reinstalls/device restores.
          // Clear persisted auth and continue to unauthenticated app state.
          try {
            await prepareExpiredSessionState(session);
          } catch (clearErr) {
            console.warn('useSupabaseAuth: failed to clear stale session', clearErr);
          }
          if (mounted) {
            setSession(null);
            setError(null);
            resolvedSession = null;
          }
        } else {
          setError(message);
          // Keep fatal fallback for unexpected initialization failures.
          try {
            setAppError(message, true);
          } catch (e) {
            console.warn('useSupabaseAuth: failed to report fatal app error', e);
          }
        }
      } finally {
        clearTimeout(loadingGuard);
        beginSupabaseAutoRefresh();
        if (mounted) {
          setIsLoading(false);
          const ready = resolveAuthReady(resolvedSession);
          markAuthReady(ready, 'init_finally', resolvedSession);
          logAuthTelemetry('init_ready', {
            hasSession: !!resolvedSession?.user?.id,
            isAuthReady: ready,
            durationMs: Date.now() - initStartedAt,
          });
          if (!ready && resolvedSession?.user?.id) {
            scheduleAuthReadyGuard();
          }
        }
      }
    };

    initializeAuth();
    // Set up auth state change listener
    // Must stay synchronous. Supabase holds the auth lock until this returns.
    // Awaiting saveSession / another Supabase call here blocks every wallet and payout request.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session');
      
      if (!mounted) return;
      if (signingOutRef.current && event !== 'SIGNED_OUT') return;

      const readyEvents = ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'];

      if (readyEvents.includes(event)) {
        if (session?.user?.id && sessionIsReadyForApi(session)) {
          console.log(`✅ Auth ready (${event})`);
          seedSessionCache(session);
          setSession(session);
          setError(null);
          markAuthReady(true, `onAuthStateChange:${event}`, session);

          const readySession = session;
          const readyEvent = event;
          setTimeout(() => {
            if (signingOutRef.current) return;
            void saveSession(readySession);
            if (readyEvent === 'TOKEN_REFRESHED' && readySession.access_token) {
              void import('@/lib/active-session-service')
                .then(({ ActiveSessionService }) =>
                  ActiveSessionService.syncActiveSessionToken(
                    readySession.user.id,
                    readySession.access_token
                  )
                )
                .catch(() => {
                  console.log('Note: Could not sync active session token after refresh');
                });
            }
            void ProfileSnapshotManager.loadProfileSnapshot(readySession.user.id).then((profileSnapshot) => {
              if (profileSnapshot) {
                console.log('📸 Profile snapshot loaded for auth state change');
              }
            });
            if (shouldInvalidateWalletOnAuthEvent(readyEvent)) {
              void invalidateFinancialQueries();
            }
          }, 0);
        } else if (session?.user?.id) {
          // Do not flip ready→false during an in-flight password login (causes splash → password flash).
          if (isAuthReadyRef.current && sessionRef.current?.user?.id === session.user.id) {
            console.log(
              `⏳ Session refresh pending (${event}), keeping auth ready to avoid login splash bounce`
            );
            setSession(session);
            scheduleAuthReadyGuard();
          } else {
            console.log(`⏳ Session present but not ready (${event}), waiting for refresh`);
            setSession(session);
            markAuthReady(false, `onAuthStateChange:${event}:pending`, session);
            scheduleAuthReadyGuard();
          }
        } else {
          console.log('⚠️ Session exists but user is invalid, clearing session');
          setSession(null);
          markAuthReady(true, `onAuthStateChange:${event}:invalid`, null);
          setError('Session expired or invalid');
          setTimeout(() => {
            void clearSession();
          }, 0);
          removeFinancialQueries();
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out');
        clearSessionCache();
        setSession(null);
        setError(null);
        markAuthReady(true, 'onAuthStateChange:SIGNED_OUT', null);
        const signedOutUserId = session?.user?.id;
        setTimeout(() => {
          void clearSession();
          if (signedOutUserId) {
            void ProfileSnapshotManager.clearProfileSnapshot(signedOutUserId);
          }
        }, 0);
        removeFinancialQueries();
      } else if (event === 'USER_UPDATED') {
        console.log('👤 User updated');
        if (session?.user?.id) {
          setSession(session);
          const updated = session;
          setTimeout(() => {
            if (signingOutRef.current) return;
            void saveSession(updated);
            if (updated.user.user_metadata) {
              void ProfileSnapshotManager.saveMetadataSnapshot(
                updated.user.id,
                updated.user.user_metadata
              );
            }
          }, 0);
        } else {
          console.log('⚠️ Updated session has no valid user, clearing session');
          setSession(null);
          setError('Session expired or invalid');
          setTimeout(() => {
            void clearSession();
          }, 0);
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
        if (signingOutRef.current) return;

        // Check current session validity
        const currentSession = await supabase.auth.getSession();
        const { data: { session: currentAuthSession }, error: sessionError } = currentSession;

        if (sessionError) {
          const message = sessionError.message ?? String(sessionError);
          if (isTransientSessionError(message)) {
            console.warn('⚠️ Transient session validation error (keeping session):', message);
            return;
          }
          if (!isDefinitiveAuthExpiredError(message)) {
            console.warn('⚠️ Unclassified session error (keeping session):', message);
            return;
          }
          console.log('⚠️ Session validation error (expired):', message);
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
                const refreshMessage = refreshError.message ?? String(refreshError);
                if (isTransientSessionError(refreshMessage)) {
                  console.warn('⚠️ Transient refresh error (keeping session):', refreshMessage);
                  return;
                }
                console.error('❌ Failed to refresh session:', refreshError);
                await prepareExpiredSessionState(currentAuthSession);
                if (mounted) {
                  setSession(null);
                  setError('JWT expired');
                }
              } else if (data.session) {
                console.log('✅ Session refreshed proactively');
                if (mounted) {
                  setSession(data.session);
                  await saveSession(data.session);

                  if (data.session.user?.id && data.session.access_token) {
                    try {
                      const { ActiveSessionService } = await import('@/lib/active-session-service');
                      await ActiveSessionService.syncActiveSessionToken(
                        data.session.user.id,
                        data.session.access_token
                      );
                    } catch (error) {
                      console.log('Note: Could not sync active session token after proactive refresh');
                    }
                  }
                }
              }
            } catch (error) {
              console.error('❌ Error refreshing session:', error);
            }
          } else if (timeUntilExpiry <= 0) {
            // Session has expired
            console.log('⏰ Session has expired');
            await prepareExpiredSessionState(currentAuthSession);
            if (mounted) {
              setSession(null);
              setError('JWT expired');
            }
          }
        } else if (currentAuthSession && (!currentAuthSession.user?.id || isSessionExpired(currentAuthSession))) {
          console.log('⚠️ Periodic check: Session expired or invalid, clearing');
          await prepareExpiredSessionState(currentAuthSession);
          if (mounted) {
            setSession(null);
            setError('JWT expired');
          }
        } else if (!currentAuthSession && mounted && session) {
          // No session exists but we had one before - session expired
          console.log('⚠️ Session lost unexpectedly');
          await prepareExpiredSessionState(session);
          if (mounted) {
            setSession(null);
            setError('JWT expired');
          }
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    };
    
    const validationCleanup = maintainSessionAlive();

    return () => {
      mounted = false;
      mountedRef.current = false;
      clearTimeout(loadingGuard);
      clearAuthReadyGuard();
      subscription.unsubscribe();
      validationCleanup();
    };
  }, [clearAuthReadyGuard, markAuthReady, prepareExpiredSessionState, scheduleAuthReadyGuard]);

  // Auth refresh on resume is handled by ensureSupabaseConnection via the foreground coordinator.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setError('Session expired or invalid');
    });
    setSessionRefreshedHandler((refreshedSession) => {
      if (signingOutRef.current) return;
      seedSessionCache(refreshedSession);
      setSession(refreshedSession);
      markAuthReady(
        sessionIsReadyForApi(refreshedSession),
        'session_refreshed_handler',
        refreshedSession
      );
      void saveSession(refreshedSession);
    });
    return () => {
      setAuthExpiredHandler(null);
      setSessionRefreshedHandler(null);
    };
  }, [markAuthReady]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      // Don't set isLoading here - it causes black screen in _layout.tsx
      // isLoading should only be for initial auth loading, not individual operations
      setError(null);

      console.log('🔑 useSupabaseAuth.signIn - Starting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('❌ useSupabaseAuth.signIn - Error:', error.message);
        setError(error.message);
        return { success: false, error: error.message };
      }

      if (data.session) {
        console.log('✅ useSupabaseAuth.signIn - Session received, setting session...');
        setSession(data.session);
        // Keep auth ready so root splash does not flicker back over the password screen.
        markAuthReady(sessionIsReadyForApi(data.session), 'signIn', data.session);
        void saveSession(data.session);

        if (data.session.user?.id) {
          void ProfileSnapshotManager.loadProfileSnapshot(data.session.user.id).then((snapshot) => {
            if (snapshot) console.log('📸 Profile snapshot loaded for sign in');
          });
        }

        console.log('✅ useSupabaseAuth.signIn - Sign in successful');
        return { success: true, session: data.session };
      }

      console.log('❌ useSupabaseAuth.signIn - No session returned');
      return { success: false, error: 'No session returned' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      console.log('❌ useSupabaseAuth.signIn - Exception:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any): Promise<AuthResult> => {
    try {
      // Don't set isLoading here - it causes black screen in _layout.tsx
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
    }
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    try {
      setError(null);

      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email: email.toLowerCase().trim(),
          purpose: 'password_recovery',
        },
      });

      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }

      if (data?.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signOut = async (): Promise<void> => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    const userId = sessionRef.current?.user?.id;
    const sessionId = sessionRef.current?.access_token;

    sessionRef.current = null;
    setSession(null);
    setError(null);
    markAuthReady(true, 'sign_out', null);
    removeFinancialQueries();
    clearSessionCache();

    try {
      await clearUserCachesOnSignOut(userId);
      if (userId) {
        try {
          const { ActiveSessionService } = await import('@/lib/active-session-service');
          await ActiveSessionService.deactivateSession(sessionId ?? '', userId);
        } catch {
          console.log('Note: Could not deactivate session (may already be invalid)');
        }
        try {
          await ProfileSnapshotManager.clearProfileSnapshot(userId);
        } catch {
          console.log('Note: Could not clear profile snapshot');
        }
      }

      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          const errorMessage = error.message || 'Unknown error';
          if (
            !errorMessage.includes('session missing') &&
            !errorMessage.includes('AuthSessionMissingError')
          ) {
            console.warn('Sign-out warning:', errorMessage);
          }
        }
      } catch (err) {
        console.warn('Sign-out warning:', err instanceof Error ? err.message : 'Sign out failed');
      }
    } finally {
      try {
        await clearSession();
      } catch (err) {
        console.warn('Failed to clear persisted session on sign-out:', err);
      }
      clearSessionCache();
      if (mountedRef.current) {
        setSession(null);
      }
      signingOutRef.current = false;
    }
  };

  return {
    session,
    isLoading,
    isAuthReady,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
  };
}