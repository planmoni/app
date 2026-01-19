/**
 * Axios instance for Edge Function API calls
 * 
 * SECURITY: All API calls go through Supabase Edge Functions
 * No secret keys exposed to client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { supabase } from './supabase';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('Error getting session for axios request:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Retry the request with new token
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${session.access_token}`;
            return axiosInstance.request(error.config);
          }
        }
      } catch (refreshError) {
        console.error('Error refreshing session:', refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
export { axiosInstance };


