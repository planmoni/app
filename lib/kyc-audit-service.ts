/**
 * KYC Audit Service
 * 
 * Comprehensive audit logging service for KYC operations to ensure
 * full traceability, regulatory compliance, and tamper-proof audit trails.
 * 
 * Key Features:
 * - Immutable audit logs with cryptographic integrity verification
 * - Comprehensive metadata capture including device fingerprinting
 * - Real-time audit events for monitoring
 * - Regulatory compliance support
 * - Tamper-proof audit trail with digital signatures
 */

import { supabase } from './supabase';
import { createHash, randomBytes } from 'crypto';

export interface KYCAuditLogData {
  userId: string;
  operationType: KYCOperationType;
  verificationType?: KYCVerificationType;
  verificationProvider?: string;
  requestData?: any;
  responseData?: any;
  processedData?: any;
  status?: KYCStatus;
  resultCode?: string;
  resultMessage?: string;
  confidenceScore?: number;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  locationData?: any;
  providerRequestId?: string;
  providerResponseTimeMs?: number;
  providerCost?: number;
  regulatoryRequirements?: any;
  complianceFlags?: any;
  riskScore?: number;
  metadata?: any;
  tags?: string[];
}

export interface KYCAuditEventData {
  auditLogId: string;
  userId: string;
  eventType: KYCAuditEventType;
  eventData?: any;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface KYCAuditAttachmentData {
  auditLogId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  filePath: string;
  encryptionKeyId?: string;
  accessLevel?: 'public' | 'internal' | 'restricted' | 'confidential';
  description?: string;
  tags?: string[];
}

export type KYCOperationType = 
  | 'kyc_initiated' | 'kyc_submitted' | 'kyc_verified' | 'kyc_failed' 
  | 'kyc_rejected' | 'kyc_manual_review' | 'kyc_escalated'
  | 'document_uploaded' | 'document_verified' | 'document_rejected'
  | 'bvn_verified' | 'nin_verified' | 'passport_verified'
  | 'liveness_check' | 'face_match' | 'address_verified'
  | 'kyc_tier_upgraded' | 'kyc_tier_downgraded';

export type KYCVerificationType = 'bvn' | 'nin' | 'passport' | 'drivers_license' | 'document' | 'liveness';

export type KYCStatus = 'pending' | 'success' | 'failed' | 'rejected' | 'manual_review';

export type KYCAuditEventType = 
  | 'verification_started' | 'verification_completed' | 'verification_failed'
  | 'document_uploaded' | 'document_processed' | 'document_verified'
  | 'manual_review_required' | 'manual_review_completed'
  | 'compliance_check' | 'risk_assessment' | 'fraud_detected';

export interface AuditTrailQuery {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  operationType?: KYCOperationType;
  limit?: number;
}

export interface AuditReport {
  userId: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    successRate: number;
    integrityViolations: number;
    integrityStatus: 'verified' | 'compromised';
  };
  generatedAt: Date;
  reportId: string;
}

class KYCAuditService {
  private static instance: KYCAuditService;

  public static getInstance(): KYCAuditService {
    if (!KYCAuditService.instance) {
      KYCAuditService.instance = new KYCAuditService();
    }
    return KYCAuditService.instance;
  }

  /**
   * Creates a new KYC audit log entry
   */
  async createAuditLog(data: KYCAuditLogData): Promise<string> {
    try {
      const { data: result, error } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: data.userId,
        p_operation_type: data.operationType,
        p_verification_type: data.verificationType || null,
        p_verification_provider: data.verificationProvider || null,
        p_request_data: data.requestData || null,
        p_response_data: data.responseData || null,
        p_processed_data: data.processedData || null,
        p_status: data.status || 'pending',
        p_result_code: data.resultCode || null,
        p_result_message: data.resultMessage || null,
        p_confidence_score: data.confidenceScore || null,
        p_ip_address: data.ipAddress || null,
        p_user_agent: data.userAgent || null,
        p_device_fingerprint: data.deviceFingerprint || null,
        p_location_data: data.locationData || null,
        p_provider_request_id: data.providerRequestId || null,
        p_provider_response_time_ms: data.providerResponseTimeMs || null,
        p_provider_cost: data.providerCost || null,
        p_regulatory_requirements: data.regulatoryRequirements || null,
        p_compliance_flags: data.complianceFlags || null,
        p_risk_score: data.riskScore || null,
        p_metadata: data.metadata || null,
        p_tags: data.tags || null
      });

      if (error) {
        console.error('Error creating KYC audit log:', error);
        throw new Error(`Failed to create audit log: ${error.message}`);
      }

      return result as string;
    } catch (error) {
      console.error('KYC Audit Service - Create Audit Log Error:', error);
      throw error;
    }
  }

  /**
   * Updates an existing audit log status
   */
  async updateAuditLogStatus(
    auditLogId: string,
    status: KYCStatus,
    resultCode?: string,
    resultMessage?: string,
    responseData?: any,
    confidenceScore?: number,
    providerResponseTimeMs?: number
  ): Promise<boolean> {
    try {
      const { data: result, error } = await supabase.rpc('update_kyc_audit_log_status', {
        p_audit_log_id: auditLogId,
        p_status: status,
        p_result_code: resultCode || null,
        p_result_message: resultMessage || null,
        p_response_data: responseData || null,
        p_confidence_score: confidenceScore || null,
        p_provider_response_time_ms: providerResponseTimeMs || null
      });

      if (error) {
        console.error('Error updating KYC audit log status:', error);
        return false;
      }

      return result as boolean;
    } catch (error) {
      console.error('KYC Audit Service - Update Audit Log Status Error:', error);
      return false;
    }
  }

  /**
   * Creates an audit event
   */
  async createAuditEvent(data: KYCAuditEventData): Promise<string> {
    try {
      const { data: result, error } = await supabase
        .from('kyc_audit_events')
        .insert({
          audit_log_id: data.auditLogId,
          user_id: data.userId,
          event_type: data.eventType,
          event_data: data.eventData || null,
          severity: data.severity || 'medium'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating KYC audit event:', error);
        throw new Error(`Failed to create audit event: ${error.message}`);
      }

      return result.id;
    } catch (error) {
      console.error('KYC Audit Service - Create Audit Event Error:', error);
      throw error;
    }
  }

  /**
   * Creates an audit attachment
   */
  async createAuditAttachment(data: KYCAuditAttachmentData): Promise<string> {
    try {
      const { data: result, error } = await supabase
        .from('kyc_audit_attachments')
        .insert({
          audit_log_id: data.auditLogId,
          file_name: data.fileName,
          file_type: data.fileType,
          file_size: data.fileSize,
          file_hash: data.fileHash,
          file_path: data.filePath,
          encryption_key_id: data.encryptionKeyId || null,
          access_level: data.accessLevel || 'internal',
          description: data.description || null,
          tags: data.tags || []
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating KYC audit attachment:', error);
        throw new Error(`Failed to create audit attachment: ${error.message}`);
      }

      return result.id;
    } catch (error) {
      console.error('KYC Audit Service - Create Audit Attachment Error:', error);
      throw error;
    }
  }

  /**
   * Verifies the integrity of an audit log entry
   */
  async verifyAuditTrailIntegrity(auditLogId: string): Promise<boolean> {
    try {
      const { data: result, error } = await supabase.rpc('verify_audit_trail_integrity', {
        p_audit_log_id: auditLogId
      });

      if (error) {
        console.error('Error verifying audit trail integrity:', error);
        return false;
      }

      return result as boolean;
    } catch (error) {
      console.error('KYC Audit Service - Verify Integrity Error:', error);
      return false;
    }
  }

  /**
   * Gets audit trail for a user
   */
  async getUserAuditTrail(query: AuditTrailQuery): Promise<any[]> {
    try {
      const { data: result, error } = await supabase.rpc('get_user_kyc_audit_trail', {
        p_user_id: query.userId,
        p_start_date: query.startDate?.toISOString() || null,
        p_end_date: query.endDate?.toISOString() || null,
        p_operation_type: query.operationType || null,
        p_limit: query.limit || 100
      });

      if (error) {
        console.error('Error getting user audit trail:', error);
        throw new Error(`Failed to get audit trail: ${error.message}`);
      }

      return result || [];
    } catch (error) {
      console.error('KYC Audit Service - Get User Audit Trail Error:', error);
      throw error;
    }
  }

  /**
   * Generates an audit report for a user
   */
  async generateAuditReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditReport> {
    try {
      const { data: result, error } = await supabase.rpc('generate_kyc_audit_report', {
        p_user_id: userId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) {
        console.error('Error generating audit report:', error);
        throw new Error(`Failed to generate audit report: ${error.message}`);
      }

      return result as AuditReport;
    } catch (error) {
      console.error('KYC Audit Service - Generate Audit Report Error:', error);
      throw error;
    }
  }

  /**
   * Gets audit trail summary for a user
   */
  async getAuditTrailSummary(userId: string): Promise<any[]> {
    try {
      const { data: result, error } = await supabase
        .from('kyc_audit_trail_summary')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting audit trail summary:', error);
        throw new Error(`Failed to get audit trail summary: ${error.message}`);
      }

      return result || [];
    } catch (error) {
      console.error('KYC Audit Service - Get Audit Trail Summary Error:', error);
      throw error;
    }
  }

  /**
   * Generates a device fingerprint for audit purposes
   */
  generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.platform
    ];

    return createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Extracts client information for audit logging
   */
  extractClientInfo(): {
    userAgent: string;
    deviceFingerprint: string;
    timestamp: string;
  } {
    return {
      userAgent: navigator.userAgent,
      deviceFingerprint: this.generateDeviceFingerprint(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Logs a KYC operation with comprehensive audit trail
   */
  async logKYCOperation(
    userId: string,
    operationType: KYCOperationType,
    data: Partial<KYCAuditLogData> = {}
  ): Promise<string> {
    const clientInfo = this.extractClientInfo();
    
    const auditData: KYCAuditLogData = {
      userId,
      operationType,
      userAgent: clientInfo.userAgent,
      deviceFingerprint: clientInfo.deviceFingerprint,
      metadata: {
        ...data.metadata,
        clientTimestamp: clientInfo.timestamp
      },
      ...data
    };

    const auditLogId = await this.createAuditLog(auditData);

    // Create corresponding audit event
    await this.createAuditEvent({
      auditLogId,
      userId,
      eventType: this.mapOperationToEventType(operationType),
      severity: this.getSeverityForOperation(operationType)
    });

    return auditLogId;
  }

  /**
   * Maps operation type to event type
   */
  private mapOperationToEventType(operationType: KYCOperationType): KYCAuditEventType {
    const mapping: Record<KYCOperationType, KYCAuditEventType> = {
      'kyc_initiated': 'verification_started',
      'kyc_submitted': 'verification_started',
      'kyc_verified': 'verification_completed',
      'kyc_failed': 'verification_failed',
      'kyc_rejected': 'verification_failed',
      'kyc_manual_review': 'manual_review_required',
      'kyc_escalated': 'manual_review_required',
      'document_uploaded': 'document_uploaded',
      'document_verified': 'document_verified',
      'document_rejected': 'document_processed',
      'bvn_verified': 'verification_completed',
      'nin_verified': 'verification_completed',
      'passport_verified': 'verification_completed',
      'liveness_check': 'verification_started',
      'face_match': 'verification_completed',
      'address_verified': 'verification_completed',
      'kyc_tier_upgraded': 'verification_completed',
      'kyc_tier_downgraded': 'verification_failed'
    };

    return mapping[operationType] || 'verification_started';
  }

  /**
   * Gets severity level for operation type
   */
  private getSeverityForOperation(operationType: KYCOperationType): 'low' | 'medium' | 'high' | 'critical' {
    const severityMapping: Record<KYCOperationType, 'low' | 'medium' | 'high' | 'critical'> = {
      'kyc_initiated': 'low',
      'kyc_submitted': 'medium',
      'kyc_verified': 'medium',
      'kyc_failed': 'high',
      'kyc_rejected': 'high',
      'kyc_manual_review': 'high',
      'kyc_escalated': 'critical',
      'document_uploaded': 'medium',
      'document_verified': 'medium',
      'document_rejected': 'high',
      'bvn_verified': 'medium',
      'nin_verified': 'medium',
      'passport_verified': 'medium',
      'liveness_check': 'medium',
      'face_match': 'medium',
      'address_verified': 'medium',
      'kyc_tier_upgraded': 'medium',
      'kyc_tier_downgraded': 'high'
    };

    return severityMapping[operationType] || 'medium';
  }

  /**
   * Validates audit log data before creation
   */
  private validateAuditLogData(data: KYCAuditLogData): void {
    if (!data.userId) {
      throw new Error('User ID is required for audit logging');
    }

    if (!data.operationType) {
      throw new Error('Operation type is required for audit logging');
    }

    // Validate operation type
    const validOperationTypes: KYCOperationType[] = [
      'kyc_initiated', 'kyc_submitted', 'kyc_verified', 'kyc_failed',
      'kyc_rejected', 'kyc_manual_review', 'kyc_escalated',
      'document_uploaded', 'document_verified', 'document_rejected',
      'bvn_verified', 'nin_verified', 'passport_verified',
      'liveness_check', 'face_match', 'address_verified',
      'kyc_tier_upgraded', 'kyc_tier_downgraded'
    ];

    if (!validOperationTypes.includes(data.operationType)) {
      throw new Error(`Invalid operation type: ${data.operationType}`);
    }
  }
}

// Export singleton instance
export const kycAuditService = KYCAuditService.getInstance();

// Types are already exported above, no need to re-export
