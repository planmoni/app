/**
 * SafeHaven Monitor
 * 
 * Comprehensive monitoring and compliance system for SafeHaven API operations
 * to ensure security, detect anomalies, and maintain regulatory compliance.
 * 
 * Key Features:
 * - Token expiration monitoring
 * - API usage tracking and rate limiting
 * - Anomaly detection for suspicious activities
 * - Compliance monitoring and reporting
 * - Automated alerting and notifications
 */

import { supabase } from './supabase';

export interface SafeHavenMonitoringStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  tokenExpirations: number;
  rateLimitHits: number;
  lastActivity: Date;
  complianceScore: number;
}

export interface SafeHavenAnomaly {
  id: string;
  type: 'token_expiration' | 'rate_limit' | 'unusual_activity' | 'api_error' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUsers: string[];
  detectedAt: Date;
  resolved: boolean;
  resolutionNotes?: string;
}

export interface SafeHavenComplianceReport {
  userId: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  complianceStatus: 'compliant' | 'non_compliant' | 'requires_review';
  violations: SafeHavenComplianceViolation[];
  recommendations: string[];
  generatedAt: Date;
}

export interface SafeHavenComplianceViolation {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  auditLogIds: string[];
}

class SafeHavenMonitor {
  private static instance: SafeHavenMonitor;
  private tokenExpirationCheckInterval: ReturnType<typeof setInterval> | null = null;
  private anomalyDetectionInterval: ReturnType<typeof setInterval> | null = null;

  public static getInstance(): SafeHavenMonitor {
    if (!SafeHavenMonitor.instance) {
      SafeHavenMonitor.instance = new SafeHavenMonitor();
    }
    return SafeHavenMonitor.instance;
  }

  /**
   * Starts continuous monitoring of SafeHaven operations
   */
  startMonitoring(intervalMinutes: number = 30): void {
    if (this.tokenExpirationCheckInterval) {
      clearInterval(this.tokenExpirationCheckInterval);
    }

    if (this.anomalyDetectionInterval) {
      clearInterval(this.anomalyDetectionInterval);
    }

    // Check token expirations every 15 minutes
    this.tokenExpirationCheckInterval = setInterval(async () => {
      try {
        await this.checkTokenExpirations();
      } catch (error) {
        console.error('Error during token expiration check:', error);
      }
    }, 15 * 60 * 1000);

    // Detect anomalies every specified interval
    this.anomalyDetectionInterval = setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        console.error('Error during anomaly detection:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`SafeHaven Monitor: Started monitoring (${intervalMinutes} minute intervals)`);
  }

  /**
   * Stops all monitoring
   */
  stopMonitoring(): void {
    if (this.tokenExpirationCheckInterval) {
      clearInterval(this.tokenExpirationCheckInterval);
      this.tokenExpirationCheckInterval = null;
    }

    if (this.anomalyDetectionInterval) {
      clearInterval(this.anomalyDetectionInterval);
      this.anomalyDetectionInterval = null;
    }

    console.log('SafeHaven Monitor: Stopped all monitoring');
  }

  /**
   * Checks for tokens that are expiring soon
   */
  async checkTokenExpirations(): Promise<void> {
    console.log('SafeHaven Monitor: Checking token expirations...');

    try {
      const { data: expiringTokens, error } = await supabase
        .from('safehaven_tokens')
        .select('user_id, expires_at, ibs_user_id')
        .lte('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString()) // Expiring within 1 hour
        .gte('expires_at', new Date().toISOString()); // Not already expired

      if (error) {
        console.error('Error checking token expirations:', error);
        return;
      }

      for (const token of expiringTokens || []) {
        // Log token expiration warning
        await this.logAnomaly({
          type: 'token_expiration',
          severity: 'medium',
          description: `SafeHaven token for user ${token.user_id} expires at ${token.expires_at}`,
          affectedUsers: [token.user_id],
          detectedAt: new Date()
        });

        // Create audit event
        await supabase
          .from('safehaven_audit_logs')
          .insert({
            user_id: token.user_id,
            operation_type: 'token_validation',
            status: 'pending',
            request_data: { expires_at: token.expires_at },
            response_data: { warning: 'Token expiring soon' },
            safehaven_user_id: token.ibs_user_id,
            metadata: {
              type: 'expiration_warning',
              expires_at: token.expires_at
            }
          });
      }

      console.log(`SafeHaven Monitor: Found ${expiringTokens?.length || 0} expiring tokens`);
    } catch (error) {
      console.error('Error in token expiration check:', error);
    }
  }

  /**
   * Detects anomalies in SafeHaven operations
   */
  async detectAnomalies(): Promise<SafeHavenAnomaly[]> {
    console.log('SafeHaven Monitor: Detecting anomalies...');

    const anomalies: SafeHavenAnomaly[] = [];

    // Check for unusual API usage patterns
    const unusualPatterns = await this.detectUnusualPatterns();
    anomalies.push(...unusualPatterns);

    // Check for rate limiting issues
    const rateLimitIssues = await this.detectRateLimitIssues();
    anomalies.push(...rateLimitIssues);

    // Check for API errors
    const apiErrors = await this.detectApiErrors();
    anomalies.push(...apiErrors);

    console.log(`SafeHaven Monitor: Found ${anomalies.length} anomalies`);
    return anomalies;
  }

  /**
   * Detects unusual patterns in API usage
   */
  private async detectUnusualPatterns(): Promise<SafeHavenAnomaly[]> {
    const anomalies: SafeHavenAnomaly[] = [];

    // Check for users with excessive failed operations
    const { data: failedOperations, error } = await supabase
      .from('safehaven_audit_logs')
      .select('user_id, created_at')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    if (error) {
      console.error('Error detecting unusual patterns:', error);
      return anomalies;
    }

    // Group by user and count failed operations
    const userFailedCounts = new Map<string, number>();
    for (const operation of failedOperations || []) {
      const count = userFailedCounts.get(operation.user_id) || 0;
      userFailedCounts.set(operation.user_id, count + 1);
    }

    // Flag users with more than 5 failed operations in an hour
    for (const [userId, count] of userFailedCounts) {
      if (count > 5) {
        anomalies.push({
          id: `unusual_pattern_${userId}_${Date.now()}`,
          type: 'unusual_activity',
          severity: 'high',
          description: `User ${userId} has ${count} failed SafeHaven operations in the last hour`,
          affectedUsers: [userId],
          detectedAt: new Date(),
          resolved: false
        });
      }
    }

    return anomalies;
  }

  /**
   * Detects rate limiting issues
   */
  private async detectRateLimitIssues(): Promise<SafeHavenAnomaly[]> {
    const anomalies: SafeHavenAnomaly[] = [];

    // Check for rate limit errors in the last hour
    const { data: rateLimitErrors, error } = await supabase
      .from('safehaven_audit_logs')
      .select('user_id, created_at, error_data')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .like('error_data->>error', '%rate%limit%');

    if (error) {
      console.error('Error detecting rate limit issues:', error);
      return anomalies;
    }

    if (rateLimitErrors && rateLimitErrors.length > 0) {
      const affectedUsers = [...new Set(rateLimitErrors.map((error: any) => error.user_id))];
      
      anomalies.push({
        id: `rate_limit_${Date.now()}`,
        type: 'rate_limit',
        severity: 'medium',
        description: `${rateLimitErrors.length} rate limit errors detected in the last hour`,
        affectedUsers,
        detectedAt: new Date(),
        resolved: false
      });
    }

    return anomalies;
  }

  /**
   * Detects API errors
   */
  private async detectApiErrors(): Promise<SafeHavenAnomaly[]> {
    const anomalies: SafeHavenAnomaly[] = [];

    // Check for high error rates in the last hour
    const { data: recentOperations, error } = await supabase
      .from('safehaven_audit_logs')
      .select('status, created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error detecting API errors:', error);
      return anomalies;
    }

    if (recentOperations && recentOperations.length > 0) {
      const totalOperations = recentOperations.length;
      const failedOperations = recentOperations.filter((op: any) => op.status === 'failed').length;
      const errorRate = (failedOperations / totalOperations) * 100;

      if (errorRate > 20) { // More than 20% error rate
        anomalies.push({
          id: `api_error_rate_${Date.now()}`,
          type: 'api_error',
          severity: 'high',
          description: `High error rate detected: ${errorRate.toFixed(1)}% (${failedOperations}/${totalOperations})`,
          affectedUsers: [], // System-wide issue
          detectedAt: new Date(),
          resolved: false
        });
      }
    }

    return anomalies;
  }

  /**
   * Logs an anomaly
   */
  private async logAnomaly(anomaly: Omit<SafeHavenAnomaly, 'id'>): Promise<void> {
    try {
      // Store anomaly in a dedicated table or use audit logs
      await supabase
        .from('safehaven_audit_logs')
        .insert({
          user_id: anomaly.affectedUsers[0] || '00000000-0000-0000-0000-000000000000',
          operation_type: 'anomaly_detected',
          status: 'success',
          request_data: { anomaly_type: anomaly.type },
          response_data: {
            type: anomaly.type,
            severity: anomaly.severity,
            description: anomaly.description,
            affected_users: anomaly.affectedUsers
          },
          metadata: {
            anomaly_id: `anomaly_${Date.now()}`,
            detected_at: anomaly.detectedAt.toISOString(),
            resolved: anomaly.resolved
          }
        });
    } catch (error) {
      console.error('Error logging anomaly:', error);
    }
  }

  /**
   * Gets monitoring statistics
   */
  async getMonitoringStats(): Promise<SafeHavenMonitoringStats> {
    try {
      // Get total operations count
      const { data: totalOps, error: totalError } = await supabase
        .from('safehaven_audit_logs')
        .select('id', { count: 'exact' });

      // Get successful operations count
      const { data: successOps, error: successError } = await supabase
        .from('safehaven_audit_logs')
        .select('id', { count: 'exact' })
        .eq('status', 'success');

      // Get failed operations count
      const { data: failedOps, error: failedError } = await supabase
        .from('safehaven_audit_logs')
        .select('id', { count: 'exact' })
        .eq('status', 'failed');

      // Get average response time
      const { data: responseTimes, error: responseError } = await supabase
        .from('safehaven_audit_logs')
        .select('response_time_ms')
        .not('response_time_ms', 'is', null);

      // Get token expirations count
      const { data: expiringTokens, error: tokenError } = await supabase
        .from('safehaven_tokens')
        .select('id', { count: 'exact' })
        .lte('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      // Get rate limit hits count
      const { data: rateLimitHits, error: rateLimitError } = await supabase
        .from('safehaven_audit_logs')
        .select('id', { count: 'exact' })
        .like('error_data->>error', '%rate%limit%');

      // Get last activity
      const { data: lastActivity, error: lastActivityError } = await supabase
        .from('safehaven_audit_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      const totalOperations = totalOps?.length || 0;
      const successfulOperations = successOps?.length || 0;
      const failedOperations = failedOps?.length || 0;
      const averageResponseTime = responseTimes?.length > 0 
        ? responseTimes.reduce((sum: number, op: any) => sum + (op.response_time_ms || 0), 0) / responseTimes.length
        : 0;
      const tokenExpirations = expiringTokens?.length || 0;
      const rateLimitHitsCount = rateLimitHits?.length || 0;
      const lastActivityDate = lastActivity?.[0]?.created_at ? new Date(lastActivity[0].created_at) : new Date();
      const complianceScore = totalOperations > 0 ? ((successfulOperations / totalOperations) * 100) : 100;

      return {
        totalOperations,
        successfulOperations,
        failedOperations,
        averageResponseTime: Math.round(averageResponseTime),
        tokenExpirations,
        rateLimitHits: rateLimitHitsCount,
        lastActivity: lastActivityDate,
        complianceScore: Math.round(complianceScore * 100) / 100
      };
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        tokenExpirations: 0,
        rateLimitHits: 0,
        lastActivity: new Date(),
        complianceScore: 0
      };
    }
  }

  /**
   * Generates compliance report for a user
   */
  async generateComplianceReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SafeHavenComplianceReport> {
    console.log(`Generating SafeHaven compliance report for user ${userId}`);

    // Get audit logs for the period
    const { data: auditLogs, error } = await supabase
      .from('safehaven_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }

    const violations: SafeHavenComplianceViolation[] = [];
    let complianceStatus: 'compliant' | 'non_compliant' | 'requires_review' = 'compliant';

    // Check for failed operations
    const failedOperations = auditLogs?.filter(log => log.status === 'failed') || [];
    if (failedOperations.length > 0) {
      violations.push({
        type: 'failed_operations',
        description: `${failedOperations.length} failed SafeHaven operations`,
        severity: failedOperations.length > 5 ? 'high' : 'medium',
        detectedAt: new Date(),
        auditLogIds: failedOperations.map(log => log.id)
      });
      complianceStatus = 'requires_review';
    }

    // Check for rate limiting
    const rateLimitViolations = auditLogs?.filter(log => 
      log.error_data && JSON.stringify(log.error_data).includes('rate')
    ) || [];
    if (rateLimitViolations.length > 0) {
      violations.push({
        type: 'rate_limiting',
        description: `${rateLimitViolations.length} rate limiting violations`,
        severity: 'medium',
        detectedAt: new Date(),
        auditLogIds: rateLimitViolations.map(log => log.id)
      });
      if (complianceStatus === 'compliant') {
        complianceStatus = 'requires_review';
      }
    }

    // Check for token expiration issues
    const tokenIssues = auditLogs?.filter(log => 
      log.operation_type === 'token_validation' && log.status === 'failed'
    ) || [];
    if (tokenIssues.length > 0) {
      violations.push({
        type: 'token_issues',
        description: `${tokenIssues.length} token validation issues`,
        severity: 'high',
        detectedAt: new Date(),
        auditLogIds: tokenIssues.map(log => log.id)
      });
      complianceStatus = 'non_compliant';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (failedOperations.length > 0) {
      recommendations.push('Review and resolve failed SafeHaven operations');
    }
    if (rateLimitViolations.length > 0) {
      recommendations.push('Implement rate limiting controls to prevent API abuse');
    }
    if (tokenIssues.length > 0) {
      recommendations.push('Implement automatic token refresh to prevent expiration issues');
    }
    if (violations.length === 0) {
      recommendations.push('Maintain current SafeHaven integration practices');
    }

    return {
      userId,
      reportPeriod: { startDate, endDate },
      complianceStatus,
      violations,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * Validates SafeHaven integration compliance
   */
  async validateCompliance(userId: string): Promise<{
    isCompliant: boolean;
    missingRequirements: string[];
    recommendations: string[];
  }> {
    const missingRequirements: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if user has a valid token
      const { data: token, error: tokenError } = await supabase
        .from('safehaven_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (tokenError || !token) {
        missingRequirements.push('No SafeHaven token found');
        recommendations.push('Complete SafeHaven token setup');
      } else if (new Date(token.expires_at) <= new Date()) {
        missingRequirements.push('SafeHaven token has expired');
        recommendations.push('Refresh SafeHaven token');
      }

      // Check if user has accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('safehaven_accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (accountsError || !accounts || accounts.length === 0) {
        missingRequirements.push('No SafeHaven accounts found');
        recommendations.push('Sync SafeHaven accounts');
      }

      // Check recent activity
      const { data: recentActivity, error: activityError } = await supabase
        .from('safehaven_audit_logs')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (activityError || !recentActivity || recentActivity.length === 0) {
        missingRequirements.push('No recent SafeHaven activity');
        recommendations.push('Ensure regular SafeHaven API usage');
      }

      return {
        isCompliant: missingRequirements.length === 0,
        missingRequirements,
        recommendations
      };
    } catch (error) {
      console.error('Error validating SafeHaven compliance:', error);
      return {
        isCompliant: false,
        missingRequirements: ['Unable to validate compliance due to system error'],
        recommendations: ['Contact system administrator']
      };
    }
  }
}

// Export singleton instance
export const safeHavenMonitor = SafeHavenMonitor.getInstance();

// Export types
export type {
  SafeHavenMonitoringStats,
  SafeHavenAnomaly,
  SafeHavenComplianceReport,
  SafeHavenComplianceViolation
};