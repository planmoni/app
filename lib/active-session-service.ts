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
  /**
   * Check if user has an active session on a different device
   * @param userId - The user ID to check
   * @param deviceFingerprint - The fingerprint of the current device attempting to log in
   * @returns Object with hasActiveSession flag and device info if active session exists
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
   * Deactivate a session
   * @param sessionId - The Supabase session ID (access_token) or login_sessions table ID
   * @param userId - Optional user ID for additional validation
   */
  static async deactivateSession(
    sessionId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      // Try to find the session by session_id (Supabase session ID) first
      let query = supabase
        .from('login_sessions')
        .update({ is_active: false })
        .eq('session_id', sessionId);

      // If userId is provided, add it to the query for additional safety
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;

      if (error) {
        // If not found by session_id, try by id (login_sessions table ID)
        let queryById = supabase
          .from('login_sessions')
          .update({ is_active: false })
          .eq('id', sessionId);

        if (userId) {
          queryById = queryById.eq('user_id', userId);
        }

        const { error: errorById } = await queryById;

        if (errorById) {
          console.error('Error deactivating session:', errorById);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in deactivateSession:', error);
      return false;
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
