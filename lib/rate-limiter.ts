/**
 * Rate Limiter
 * 
 * Tier-based rate limiting for Planmoni Platform API.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  reset_at: string;
  error?: string;
}

// Tier-based default limits
const TIER_LIMITS = {
  standard: {
    per_hour: 1000,
    per_minute: 100,
    per_second: 10,
    burst: 20,
  },
  premium: {
    per_hour: 5000,
    per_minute: 500,
    per_second: 50,
    burst: 100,
  },
  enterprise: {
    per_hour: 50000,
    per_minute: 5000,
    per_second: 500,
    burst: 1000,
  },
};

export class RateLimiter {
  /**
   * Check rate limit for partner
   */
  async checkLimit(partnerId: string, window: 'hour' | 'minute' | 'second' = 'hour'): Promise<RateLimitResult> {
    try {
      // Get partner subscription tier
      const { data: partner } = await supabase
        .from('partners')
        .select('subscription_tier')
        .eq('id', partnerId)
        .single();

      if (!partner) {
        return {
          allowed: false,
          current: 0,
          limit: 0,
          remaining: 0,
          reset_at: new Date().toISOString(),
          error: 'Partner not found',
        };
      }

      // Get custom rate limits if configured
      const { data: customLimits } = await supabase
        .from('partner_rate_limits')
        .select('*')
        .eq('partner_id', partnerId)
        .single();

      const tier = partner.subscription_tier as keyof typeof TIER_LIMITS;
      const defaultLimits = TIER_LIMITS[tier] || TIER_LIMITS.standard;

      const limit = customLimits
        ? customLimits[`requests_per_${window}` as keyof typeof customLimits] || defaultLimits[`per_${window}` as keyof typeof defaultLimits]
        : defaultLimits[`per_${window}` as keyof typeof defaultLimits];

      // Calculate window in seconds
      const windowSeconds = window === 'hour' ? 3600 : window === 'minute' ? 60 : 1;

      // Check rate limit using database function
      const { data: rateLimitCheck, error } = await supabase.rpc('check_rate_limit', {
        p_partner_id: partnerId,
        p_window_seconds: windowSeconds,
      });

      if (error) {
        console.error('Rate limit check error:', error);
        // Allow request if check fails (fail open)
        return {
          allowed: true,
          current: 0,
          limit: limit as number,
          remaining: limit as number,
          reset_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
        };
      }

      return {
        allowed: rateLimitCheck.allowed,
        current: rateLimitCheck.current,
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining,
        reset_at: rateLimitCheck.reset_at,
      };
    } catch (error: any) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      return {
        allowed: true,
        current: 0,
        limit: 1000,
        remaining: 1000,
        reset_at: new Date(Date.now() + 3600000).toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Log API usage
   */
  async logUsage(
    partnerId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    requestSizeBytes?: number,
    responseSizeBytes?: number,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await supabase.from('api_usage_logs').insert({
        partner_id: partnerId,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        request_size_bytes: requestSizeBytes,
        response_size_bytes: responseSizeBytes,
        user_agent: userAgent,
        ip_address: ipAddress,
      });
    } catch (error) {
      console.error('Error logging API usage:', error);
      // Don't throw - logging failures shouldn't break requests
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(
    partnerId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<{
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    average_response_time: number;
    endpoints: Array<{ endpoint: string; count: number }>;
  }> {
    let query = supabase
      .from('api_usage_logs')
      .select('*')
      .eq('partner_id', partnerId);

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data: logs, error } = await query;

    if (error || !logs) {
      return {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        average_response_time: 0,
        endpoints: [],
      };
    }

    const total = logs.length;
    const successful = logs.filter((l) => l.status_code && l.status_code < 400).length;
    const failed = total - successful;
    const avgResponseTime =
      logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / total || 0;

    // Count by endpoint
    const endpointCounts: Record<string, number> = {};
    logs.forEach((log) => {
      endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
    });

    const endpoints = Object.entries(endpointCounts).map(([endpoint, count]) => ({
      endpoint,
      count,
    }));

    return {
      total_requests: total,
      successful_requests: successful,
      failed_requests: failed,
      average_response_time: avgResponseTime,
      endpoints,
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
