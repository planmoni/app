import * as Device from 'expo-device';
import { Dimensions, Platform } from 'react-native';
import Constants from 'expo-constants';

export interface DeviceInfo {
  device_type: string;
  device_model: string;
  device_manufacturer: string;
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  engine_name: string;
  screen_resolution: string;
  user_agent_raw: string;
}

export interface LocationInfo {
  ip_address: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  isp: string;
}

export class DeviceInfoService {
  static async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const { width, height } = Dimensions.get('window');
      const screenResolution = `${Math.round(width)}x${Math.round(height)}`;

      let deviceType = 'Desktop';
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        if (Device.deviceType === Device.DeviceType.PHONE) {
          deviceType = 'Mobile';
        } else if (Device.deviceType === Device.DeviceType.TABLET) {
          deviceType = 'Tablet';
        }
      } else if (Platform.OS === 'web') {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('mobile')) {
          deviceType = 'Mobile';
        } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
          deviceType = 'Tablet';
        }
      }

      const deviceInfo: DeviceInfo = {
        device_type: deviceType,
        device_model: Device.modelName || Device.deviceName || 'Unknown',
        device_manufacturer: Device.manufacturer || 'Unknown',
        os_name: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web',
        os_version: Device.osVersion || Platform.Version?.toString() || 'Unknown',
        browser_name: Platform.OS === 'web' ? this.getBrowserName() : 'Native App',
        browser_version: Platform.OS === 'web' ? this.getBrowserVersion() : 'N/A',
        engine_name: Platform.OS === 'web' ? this.getEngineName() : 'Native',
        screen_resolution: screenResolution,
        user_agent_raw: Platform.OS === 'web' ? navigator.userAgent : `${Platform.OS}/${Device.osVersion}`
      };

      return deviceInfo;
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        device_type: 'Unknown',
        device_model: 'Unknown',
        device_manufacturer: 'Unknown',
        os_name: Platform.OS,
        os_version: 'Unknown',
        browser_name: 'Unknown',
        browser_version: 'Unknown',
        engine_name: 'Unknown',
        screen_resolution: 'Unknown',
        user_agent_raw: 'Unknown'
      };
    }
  }

  static getBrowserName(): string {
    if (Platform.OS !== 'web') return 'Native App';

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';

    return 'Unknown';
  }

  static getBrowserVersion(): string {
    if (Platform.OS !== 'web') return 'N/A';

    const userAgent = navigator.userAgent;
    let match;

    if (userAgent.includes('Firefox')) {
      match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    } else if (userAgent.includes('Edg')) {
      match = userAgent.match(/Edg\/(\d+\.\d+)/);
    } else if (userAgent.includes('Chrome')) {
      match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    } else if (userAgent.includes('Safari')) {
      match = userAgent.match(/Version\/(\d+\.\d+)/);
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      match = userAgent.match(/(?:Opera|OPR)\/(\d+\.\d+)/);
    }

    return match ? match[1] : 'Unknown';
  }

  static getEngineName(): string {
    if (Platform.OS !== 'web') return 'Native';

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Gecko') && userAgent.includes('Firefox')) return 'Gecko';
    if (userAgent.includes('AppleWebKit')) {
      if (userAgent.includes('Chrome')) return 'Blink';
      return 'WebKit';
    }

    return 'Unknown';
  }

  /**
   * Generate a unique device fingerprint based on device characteristics
   * This is used to identify if a login attempt is from the same device
   */
  static async generateDeviceFingerprint(): Promise<string> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      // Create fingerprint from device model, OS, OS version, and screen resolution
      // This combination should uniquely identify a device
      const fingerprintParts = [
        deviceInfo.device_model,
        deviceInfo.os_name,
        deviceInfo.os_version,
        deviceInfo.screen_resolution
      ];
      
      // Join parts with a separator and create a hash-like string
      // For better uniqueness, we can also include manufacturer
      const fullFingerprint = [
        deviceInfo.device_manufacturer,
        ...fingerprintParts
      ].join('|');
      
      // Return the fingerprint (could be hashed if needed, but plain text is fine for now)
      return fullFingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      // Return a fallback fingerprint
      return `Unknown|${Platform.OS}|Unknown|Unknown`;
    }
  }

  static async getLocationInfo(): Promise<LocationInfo> {
    const defaultLocationInfo: LocationInfo = {
      ip_address: 'Unknown',
      country: 'Unknown',
      country_code: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null,
      timezone: 'Unknown',
      isp: 'Unknown'
    };

    try {
      // Create AbortController for timeout handling (Android compatible)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't log error for non-critical failures, just return defaults
        return defaultLocationInfo;
      }

      const data = await response.json();

      return {
        ip_address: data.ip || 'Unknown',
        country: data.country_name || 'Unknown',
        country_code: data.country_code || 'Unknown',
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timezone: data.timezone || 'Unknown',
        isp: data.org || 'Unknown'
      };
    } catch (error) {
      // Suppress timeout and network errors on Android to reduce log noise
      // Only log unexpected errors in development
      if (__DEV__) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAbortError = errorMessage.includes('aborted') || errorMessage.includes('AbortError');
        const isNetworkError = errorMessage.includes('network') || errorMessage.includes('Network');
        
        if (!isAbortError && !isNetworkError) {
          console.warn('Location info fetch failed:', errorMessage);
        }
      }
      return defaultLocationInfo;
    }
  }

  static async createLoginSession(userId: string, sessionId: string) {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const locationInfo = await this.getLocationInfo();
      const deviceFingerprint = await this.generateDeviceFingerprint();

      const { supabase } = await import('@/lib/supabase');

      const { data, error } = await supabase
        .from('login_sessions')
        .insert({
          user_id: userId,
          session_id: sessionId,
          device_fingerprint: deviceFingerprint,
          is_active: false, // Will be set to true after activation
          ...deviceInfo,
          ...locationInfo,
          login_timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating login session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createLoginSession:', error);
      return null;
    }
  }
}
