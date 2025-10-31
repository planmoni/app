/**
 * KYC Audit Monitor
 * 
 * Comprehensive monitoring and verification system for KYC audit trails
 * to ensure data integrity, detect anomalies, and maintain compliance.
 * 
 * Key Features:
 * - Real-time integrity verification
 * - Anomaly detection and alerting
 * - Compliance monitoring
 * - Automated audit trail validation
 * - Security breach detection
 */

import { supabase } from './supabase';
import { kycAuditService } from './kyc-audit-service';

export interface AuditIntegrityCheck {
  auditLogId: string;
  userId: string;
  isIntegrityValid: boolean;
  checkTimestamp: Date;
  issues: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditAnomaly {
  id: string;
  type: 'integrity_violation' | 'unusual_pattern' | 'security_breach' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUsers: string[];
  detectedAt: Date;
  resolved: boolean;
  resolutionNotes?: string;
}

export interface ComplianceReport {
  userId: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  complianceStatus: 'compliant' | 'non_compliant' | 'requires_review';
  violations: ComplianceViolation[];
  recommendations: string[];
  generatedAt: Date;
}

export interface ComplianceViolation {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  auditLogIds: string[];
}

class KYCAuditMonitor {
  private static instance: KYCAuditMonitor;
  private integrityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private anomalyDetectionInterval: ReturnType<typeof setInterval> | null = null;

  public static getInstance(): KYCAuditMonitor {
    if (!KYCAuditMonitor.instance) {
      KYCAuditMonitor.instance = new KYCAuditMonitor();
    }
    return KYCAuditMonitor.instance;
  }

  /**
   * Starts continuous monitoring of audit trail integrity
   */
  startIntegrityMonitoring(intervalMinutes: number = 60): void {
    if (this.integrityCheckInterval) {
      clearInterval(this.integrityCheckInterval);
    }

    this.integrityCheckInterval = setInterval(async () => {
      try {
        await this.performIntegrityCheck();
      } catch (error) {
        console.error('Error during integrity check:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`KYC Audit Monitor: Started integrity monitoring (${intervalMinutes} minute intervals)`);
  }

  /**
   * Starts continuous anomaly detection
   */
  startAnomalyDetection(intervalMinutes: number = 30): void {
    if (this.anomalyDetectionInterval) {
      clearInterval(this.anomalyDetectionInterval);
    }

    this.anomalyDetectionInterval = setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        console.error('Error during anomaly detection:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`KYC Audit Monitor: Started anomaly detection (${intervalMinutes} minute intervals)`);
  }

  /**
   * Stops all monitoring
   */
  stopMonitoring(): void {
    if (this.integrityCheckInterval) {
      clearInterval(this.integrityCheckInterval);
      this.integrityCheckInterval = null;
    }

    if (this.anomalyDetectionInterval) {
      clearInterval(this.anomalyDetectionInterval);
      this.anomalyDetectionInterval = null;
    }

    console.log('KYC Audit Monitor: Stopped all monitoring');
  }

  /**
   * Performs comprehensive integrity check on recent audit logs
   */
  async performIntegrityCheck(): Promise<AuditIntegrityCheck[]> {
    console.log('KYC Audit Monitor: Starting integrity check...');

    // Get recent audit logs (last 24 hours)
    const { data: recentLogs, error } = await supabase
      .from('kyc_audit_logs')
      .select('id, user_id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent audit logs:', error);
      return [];
    }

    const integrityChecks: AuditIntegrityCheck[] = [];

    for (const log of recentLogs || []) {
      try {
        const isIntegrityValid = await kycAuditService.verifyAuditTrailIntegrity(log.id);
        
        const check: AuditIntegrityCheck = {
          auditLogId: log.id,
          userId: log.user_id,
          isIntegrityValid,
          checkTimestamp: new Date(),
          issues: [],
          severity: 'low'
        };

        if (!isIntegrityValid) {
          check.issues.push('Integrity hash mismatch detected');
          check.severity = 'critical';
          
          // Log critical integrity violation
          console.error(`CRITICAL: Integrity violation detected for audit log ${log.id}`);
          
          // Create audit event for integrity violation
          await kycAuditService.createAuditEvent({
            auditLogId: log.id,
            userId: log.user_id,
            eventType: 'fraud_detected',
            eventData: {
              violationType: 'integrity_violation',
              detectedAt: new Date().toISOString()
            },
            severity: 'critical'
          });
        }

        integrityChecks.push(check);
      } catch (error) {
        console.error(`Error checking integrity for audit log ${log.id}:`, error);
      }
    }

    console.log(`KYC Audit Monitor: Integrity check completed. Checked ${integrityChecks.length} logs.`);
    return integrityChecks;
  }

  /**
   * Detects anomalies in audit trail patterns
   */
  async detectAnomalies(): Promise<AuditAnomaly[]> {
    console.log('KYC Audit Monitor: Starting anomaly detection...');

    const anomalies: AuditAnomaly[] = [];

    // Check for unusual verification patterns
    const unusualPatterns = await this.detectUnusualPatterns();
    anomalies.push(...unusualPatterns);

    // Check for security breaches
    const securityBreaches = await this.detectSecurityBreaches();
    anomalies.push(...securityBreaches);

    // Check for compliance violations
    const complianceViolations = await this.detectComplianceViolations();
    anomalies.push(...complianceViolations);

    console.log(`KYC Audit Monitor: Anomaly detection completed. Found ${anomalies.length} anomalies.`);
    return anomalies;
  }

  /**
   * Detects unusual patterns in verification attempts
   */
  private async detectUnusualPatterns(): Promise<AuditAnomaly[]> {
    const anomalies: AuditAnomaly[] = [];

    // Check for multiple failed attempts from same user
    const { data: failedAttempts, error } = await supabase
      .from('kyc_audit_logs')
      .select('user_id, created_at')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    if (error) {
      console.error('Error detecting unusual patterns:', error);
      return anomalies;
    }

    // Group by user and count failed attempts
    const userFailedCounts = new Map<string, number>();
    for (const attempt of failedAttempts || []) {
      const count = userFailedCounts.get(attempt.user_id) || 0;
      userFailedCounts.set(attempt.user_id, count + 1);
    }

    // Flag users with more than 5 failed attempts in an hour
    for (const [userId, count] of userFailedCounts) {
      if (count > 5) {
        anomalies.push({
          id: `unusual_pattern_${userId}_${Date.now()}`,
          type: 'unusual_pattern',
          severity: 'high',
          description: `User ${userId} has ${count} failed KYC attempts in the last hour`,
          affectedUsers: [userId],
          detectedAt: new Date(),
          resolved: false
        });
      }
    }

    return anomalies;
  }

  /**
   * Detects potential security breaches
   */
  private async detectSecurityBreaches(): Promise<AuditAnomaly[]> {
    const anomalies: AuditAnomaly[] = [];

    // Check for multiple IP addresses for same user
    const { data: multiIpUsers, error } = await supabase
      .from('kyc_audit_logs')
      .select('user_id, ip_address, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .not('ip_address', 'is', null);

    if (error) {
      console.error('Error detecting security breaches:', error);
      return anomalies;
    }

    // Group by user and count unique IPs
    const userIpCounts = new Map<string, Set<string>>();
    for (const log of multiIpUsers || []) {
      if (!userIpCounts.has(log.user_id)) {
        userIpCounts.set(log.user_id, new Set());
      }
      userIpCounts.get(log.user_id)!.add(log.ip_address);
    }

    // Flag users with more than 3 unique IPs in 24 hours
    for (const [userId, ipSet] of userIpCounts) {
      if (ipSet.size > 3) {
        anomalies.push({
          id: `security_breach_${userId}_${Date.now()}`,
          type: 'security_breach',
          severity: 'high',
          description: `User ${userId} accessed from ${ipSet.size} different IP addresses in 24 hours`,
          affectedUsers: [userId],
          detectedAt: new Date(),
          resolved: false
        });
      }
    }

    return anomalies;
  }

  /**
   * Detects compliance violations
   */
  private async detectComplianceViolations(): Promise<AuditAnomaly[]> {
    const anomalies: AuditAnomaly[] = [];

    // Check for missing required audit data
    const { data: incompleteLogs, error } = await supabase
      .from('kyc_audit_logs')
      .select('id, user_id, operation_type, request_data, response_data')
      .or('request_data.is.null,response_data.is.null,integrity_hash.is.null')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last week

    if (error) {
      console.error('Error detecting compliance violations:', error);
      return anomalies;
    }

    if (incompleteLogs && incompleteLogs.length > 0) {
      anomalies.push({
        id: `compliance_violation_${Date.now()}`,
        type: 'compliance_violation',
        severity: 'medium',
        description: `${incompleteLogs.length} audit logs missing required compliance data`,
        affectedUsers: Array.from(new Set(incompleteLogs.map((log: any) => log.user_id as string))),
        detectedAt: new Date(),
        resolved: false
      });
    }

    return anomalies;
  }

  /**
   * Generates compliance report for a user
   */
  async generateComplianceReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    console.log(`Generating compliance report for user ${userId}`);

    // Get audit trail for the period
    const auditTrail = await kycAuditService.getUserAuditTrail({
      userId,
      startDate,
      endDate,
      limit: 1000
    });

    const violations: ComplianceViolation[] = [];
    let complianceStatus: 'compliant' | 'non_compliant' | 'requires_review' = 'compliant';

    // Check for integrity violations
    const integrityViolations = auditTrail.filter(log => !log.integrity_verified);
    if (integrityViolations.length > 0) {
      violations.push({
        type: 'integrity_violation',
        description: `${integrityViolations.length} audit logs with integrity violations`,
        severity: 'critical',
        detectedAt: new Date(),
        auditLogIds: integrityViolations.map(log => log.id)
      });
      complianceStatus = 'non_compliant';
    }

    // Check for missing required data
    const missingDataLogs = auditTrail.filter(log => 
      !log.request_data || !log.response_data
    );
    if (missingDataLogs.length > 0) {
      violations.push({
        type: 'missing_audit_data',
        description: `${missingDataLogs.length} audit logs missing required data`,
        severity: 'high',
        detectedAt: new Date(),
        auditLogIds: missingDataLogs.map(log => log.id)
      });
      if (complianceStatus === 'compliant') {
        complianceStatus = 'requires_review';
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (integrityViolations.length > 0) {
      recommendations.push('Investigate and resolve integrity violations immediately');
    }
    if (missingDataLogs.length > 0) {
      recommendations.push('Review and complete missing audit data');
    }
    if (violations.length === 0) {
      recommendations.push('Maintain current compliance practices');
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
   * Validates audit trail completeness for regulatory requirements
   */
  async validateRegulatoryCompliance(userId: string): Promise<{
    isCompliant: boolean;
    missingRequirements: string[];
    recommendations: string[];
  }> {
    const missingRequirements: string[] = [];
    const recommendations: string[] = [];

    // Check for required verification types
    const { data: verifications, error } = await supabase
      .from('kyc_audit_logs')
      .select('verification_type, operation_type')
      .eq('user_id', userId)
      .eq('status', 'success');

    if (error) {
      console.error('Error validating regulatory compliance:', error);
      return {
        isCompliant: false,
        missingRequirements: ['Unable to validate compliance due to system error'],
        recommendations: ['Contact system administrator']
      };
    }

    const verificationTypes = new Set(verifications?.map((v: any) => v.verification_type) || []);

    // Check for required verifications (customize based on regulatory requirements)
    const requiredVerifications = ['bvn', 'document', 'liveness'];
    for (const required of requiredVerifications) {
      if (!verificationTypes.has(required)) {
        missingRequirements.push(`Missing ${required} verification`);
        recommendations.push(`Complete ${required} verification process`);
      }
    }

    return {
      isCompliant: missingRequirements.length === 0,
      missingRequirements,
      recommendations
    };
  }

  /**
   * Gets monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    totalAuditLogs: number;
    integrityViolations: number;
    activeAnomalies: number;
    complianceRate: number;
    lastCheckTime: Date;
  }> {
    const { data: totalLogs, error: totalError } = await supabase
      .from('kyc_audit_logs')
      .select('id', { count: 'exact' });

    const { data: integrityViolations, error: integrityError } = await supabase
      .from('kyc_audit_logs')
      .select('id', { count: 'exact' })
      .eq('integrity_hash', null);

    const { data: anomalies, error: anomaliesError } = await supabase
      .from('kyc_audit_events')
      .select('id', { count: 'exact' })
      .eq('event_type', 'fraud_detected')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalLogsCount = totalLogs?.length || 0;
    const integrityViolationsCount = integrityViolations?.length || 0;
    const activeAnomaliesCount = anomalies?.length || 0;
    const complianceRate = totalLogsCount > 0 ? ((totalLogsCount - integrityViolationsCount) / totalLogsCount) * 100 : 100;

    return {
      totalAuditLogs: totalLogsCount,
      integrityViolations: integrityViolationsCount,
      activeAnomalies: activeAnomaliesCount,
      complianceRate: Math.round(complianceRate * 100) / 100,
      lastCheckTime: new Date()
    };
  }
}

// Export singleton instance
export const kycAuditMonitor = KYCAuditMonitor.getInstance();

// Types are already exported above, no need to re-export
