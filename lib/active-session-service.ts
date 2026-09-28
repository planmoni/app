import { supabase } from './supabase';

export interface ActiveSessionInfo {
  sessionId: string;
  deviceFingerprint: string;
  deviceInfo: {
    device_type: string;
    device_model: string;
    device_manufacturer: string;
    os_name: string;
    os_version: string;
    screen_resolution: string;
    city: string;
    country: string;
  };
  loginTimestamp: string;
}

export class ActiveSessionService {
  private static isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  /**
   * Drop this device's single-device lock before the auth session is revoked.
   */
  static async releaseCurrentLock(deviceFingerprint: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('release_current_login_lock', {
        p_fingerprint: deviceFingerprint,
      });
      if (error) {
        console.error('Error releasing login lock:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in releaseCurrentLock:', error);
      return false;
    }
  }

  /**
   * Check if user has an active session on a different device.
   * Stale locks (logged-out auth sessions) are cleared on the server first.
   */
  static async checkActiveSession(
    userId: string,
    deviceFingerprint: string
  ): Promise<{
    hasActiveSession: boolean;
    isSameDevice: boolean;
    activeSessionInfo: ActiveSessionInfo | null;
  }> {
    try {
      const { data: evaluation, error: evalError } = await supabase.rpc(
        'evaluate_device_login',
        { p_fingerprint: deviceFingerprint }
      );

      let parsedEvaluation: unknown = evaluation;
      if (typeof evaluation === 'string') {
        try {
          parsedEvaluation = JSON.parse(evaluation);
        } catch {
          parsedEvaluation = null;
        }
      }

      if (!evalError && parsedEvaluation && typeof parsedEvaluation === 'object') {
        const result = parsedEvaluation as {
          allowed?: boolean;
          same_device?: boolean;
          device_manufacturer?: string;
          device_model?: string;
          os_name?: string;
        };

        if (result.allowed) {
          return {
            hasActiveSession: false,
            isSameDevice: !!result.same_device,
            activeSessionInfo: null,
          };
        }

        return {
          hasActiveSession: true,
          isSameDevice: false,
          activeSessionInfo: {
            sessionId: '',
            deviceFingerprint: '',
            deviceInfo: {
              device_type: 'Mobile',
              device_model: result.device_model || 'Unknown',
              device_manufacturer: result.device_manufacturer || 'Unknown',
              os_name: result.os_name || 'Unknown',
              os_version: '',
              screen_resolution: '',
              city: '',
              country: '',
            },
            loginTimestamp: new Date().toISOString(),
          },
        };
      }

      if (evalError) {
        console.warn('evaluate_device_login unavailable, using login_sessions:', evalError.message);
      }

      // Get the active session for this user
      const { data: activeSession, error } = await supabase
        .from('login_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('login_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no active session found, that's fine - user can log in
        if (error.code === 'PGRST116') {
          return {
            hasActiveSession: false,
            isSameDevice: false,
            activeSessionInfo: null,
          };
        }
        console.error('Error checking active session:', error);
        // On error, allow login to proceed (fail open)
        return {
          hasActiveSession: false,
          isSameDevice: false,
          activeSessionInfo: null,
        };
      }

      if (!activeSession) {
        return {
          hasActiveSession: false,
          isSameDevice: false,
          activeSessionInfo: null,
        };
      }

      // Check if the active session is on the same device
      const isSameDevice =
        activeSession.device_fingerprint === deviceFingerprint;

      return {
        hasActiveSession: true,
        isSameDevice,
        activeSessionInfo: {
          sessionId: activeSession.id,
          deviceFingerprint: activeSession.device_fingerprint || '',
          deviceInfo: {
            device_type: activeSession.device_type || 'Unknown',
            device_model: activeSession.device_model || 'Unknown',
            device_manufacturer: activeSession.device_manufacturer || 'Unknown',
            os_name: activeSession.os_name || 'Unknown',
            os_version: activeSession.os_version || 'Unknown',
            screen_resolution: activeSession.screen_resolution || 'Unknown',
            city: activeSession.city || 'Unknown',
            country: activeSession.country || 'Unknown',
          },
          loginTimestamp: activeSession.login_timestamp,
        },
      };
    } catch (error) {
      console.error('Error in checkActiveSession:', error);
      // On error, allow login to proceed (fail open)
      return {
        hasActiveSession: false,
        isSameDevice: false,
        activeSessionInfo: null,
      };
    }
  }

  /**
   * Activate a session and deactivate all other sessions for the user
   * @param sessionId - The login_sessions table ID (not the Supabase session ID)
   * @param userId - The user ID
   */
  static async activateSession(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // First, deactivate other sessions using the database function
      const { error: deactivateError } = await supabase.rpc(
        'deactivate_other_sessions',
        {
          p_user_id: userId,
          p_session_id: sessionId,
        }
      );

      if (deactivateError) {
        console.error('Error deactivating other sessions:', deactivateError);
        // Continue anyway - try to activate the new session
      }

      // Now activate the current session
      const { error: activateError } = await supabase
        .from('login_sessions')
        .update({ is_active: true })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (activateError) {
        console.error('Error activating session:', activateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in activateSession:', error);
      return false;
    }
  }

  /**
   * Deactivate all active login sessions for a user.
   * Used on logout to ensure the single-device lock is released.
   */
  static async deactivateAllActiveSessions(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('login_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error deactivating active sessions for user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deactivateAllActiveSessions:', error);
      return false;
    }
  }

  /**
   * Deactivate a session
   * @param sessionId - The Supabase session ID (access_token) or login_sessions table ID
   * @param userId - Optional user ID for additional validation
   */
  static async deactivateSession(
    sessionId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      if (!userId) {
        if (!sessionId) {
          return false;
        }

        const { error } = await supabase
          .from('login_sessions')
          .update({ is_active: false })
          .eq('session_id', sessionId)
          .eq('is_active', true);

        if (error) {
          console.error('Error deactivating session:', error);
          return false;
        }

        return true;
      }

      // Try matching by stored access token (may differ after token refresh)
      if (sessionId) {
        const { data: byToken, error: tokenError } = await supabase
          .from('login_sessions')
          .update({ is_active: false })
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .select('id');

        if (tokenError) {
          console.error('Error deactivating session by token:', tokenError);
        } else if (byToken && byToken.length > 0) {
          return true;
        }

        // Try matching by login_sessions row id only when the input is a UUID.
        // Supabase access tokens/JWTs are not UUIDs and will trigger a DB type error.
        if (this.isUuid(sessionId)) {
          const { data: byId, error: idError } = await supabase
            .from('login_sessions')
            .update({ is_active: false })
            .eq('id', sessionId)
            .eq('user_id', userId)
            .eq('is_active', true)
            .select('id');

          if (idError) {
            console.error('Error deactivating session by id:', idError);
          } else if (byId && byId.length > 0) {
            return true;
          }
        }
      }

      // Token refresh can change access_token without updating login_sessions.
      // Fall back to the current device fingerprint, then all active sessions.
      try {
        const { DeviceInfoService } = await import('@/lib/device-info');
        const deviceFingerprint = await DeviceInfoService.generateDeviceFingerprint();

        const { data: byDevice, error: deviceError } = await supabase
          .from('login_sessions')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('device_fingerprint', deviceFingerprint)
          .eq('is_active', true)
          .select('id');

        if (deviceError) {
          console.error('Error deactivating session by device:', deviceError);
        } else if (byDevice && byDevice.length > 0) {
          return true;
        }
      } catch (deviceLookupError) {
        console.error('Error resolving device fingerprint for logout:', deviceLookupError);
      }

      return this.deactivateAllActiveSessions(userId);
    } catch (error) {
      console.error('Error in deactivateSession:', error);
      return false;
    }
  }

  /**
   * Keep the active login session in sync when Supabase refreshes the access token.
   */
  static async syncActiveSessionToken(
    userId: string,
    accessToken: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('login_sessions')
        .update({ session_id: accessToken })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error syncing active session token:', error);
      }
    } catch (error) {
      console.error('Error in syncActiveSessionToken:', error);
    }
  }

  /**
   * Get device info for the active session (for error messages)
   * @param userId - The user ID
   * @returns Device info string for display
   */
  static async getActiveSessionDeviceInfo(
    userId: string
  ): Promise<string | null> {
    try {
      const { data: activeSession, error } = await supabase
        .from('login_sessions')
        .select('device_model, device_manufacturer, os_name, city, country')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('login_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !activeSession) {
        return null;
      }

      const deviceParts = [
        activeSession.device_manufacturer,
        activeSession.device_model,
      ]
        .filter(Boolean)
        .join(' ');

      const locationParts = [activeSession.city, activeSession.country]
        .filter((part) => part && part !== 'Unknown')
        .join(', ');

      const parts = [deviceParts, activeSession.os_name, locationParts]
        .filter(Boolean)
        .join(' • ');

      return parts || 'another device';
    } catch (error) {
      console.error('Error getting active session device info:', error);
      return null;
    }
  }
}
