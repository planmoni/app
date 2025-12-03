import { supabase } from '@/lib/supabase';
import { safeHavenService } from '@/lib/safehaven-service';

/**
 * Convert image URL to base64 for API calls
 */
export const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
  try {
    // If already a data URI, extract base64
    if (imageUrl.startsWith('data:image/')) {
      const parts = imageUrl.split(',');
      return parts.length > 1 ? parts[1] : null;
    }

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

/**
 * Verify BVN with Dojah API
 */
export const verifyBVN = async (
  bvn: string,
  selfieImageUrl: string,
  userId: string,
  onProgressUpdate?: (updates: any) => Promise<boolean>
): Promise<{ success: boolean; displayName?: string; error?: string }> => {
  try {
    // Create audit log for BVN verification start
    const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
      p_user_id: userId,
      p_operation_type: 'bvn_verified',
      p_verification_type: 'bvn',
      p_verification_provider: 'dojah',
      p_request_data: {
        action: 'start_bvn_verification',
        bvn: bvn,
        source: 'tier1_kyc_flow',
        timestamp: new Date().toISOString()
      },
      p_response_data: {
        user_action: 'initiated_bvn_verification',
        verification_status: 'pending'
      },
      p_status: 'pending',
      p_result_message: 'User initiated BVN verification process',
      p_metadata: {
        component: 'Tier1KYC',
        action: 'bvn_verification_start',
        step: 'bvn_verification'
      }
    });

    // Create audit event for BVN verification start
    if (auditLogId) {
      await supabase
        .from('kyc_audit_events')
        .insert({
          audit_log_id: auditLogId,
          user_id: userId,
          event_type: 'verification_started',
          event_data: {
            action: 'bvn_verification_initiated',
            bvn: bvn,
            provider: 'dojah'
          },
          severity: 'medium'
        });
    }

    // Check if environment variables are available
    const appId = process.env.EXPO_PUBLIC_DOJAH_APP_ID!;
    const privateKey = process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY!;
    
    if (!appId || !privateKey) {
      console.error('Missing Dojah credentials:', { appId: !!appId, privateKey: !!privateKey });
      return { success: false, error: 'KYC service configuration error' };
    }
    
    // Get selfie image for verification
    let selfieImage = null;
    
    if (selfieImageUrl) {
      const base64Image = await convertImageToBase64(selfieImageUrl);
      if (base64Image) {
        selfieImage = `data:image/jpeg;base64,${base64Image}`;
      }
    }
    
    if (!selfieImage) {
      return { success: false, error: 'Selfie image is required for BVN verification. Please complete the liveness test first.' };
    }
    
    // Make actual Dojah API call with selfie
    const response = await fetch('https://api.dojah.io/api/v1/kyc/bvn/verify', {
      method: 'POST',
      headers: {
        'AppId': appId,
        'Authorization': privateKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selfie_image: selfieImage,
        bvn: parseInt(bvn)
      })
    });
    
    if (!response.ok) {
      return { success: false, error: `BVN verification failed: ${response.status} ${response.statusText}` };
    }
    
    const data = await response.json();
    console.log('BVN verification response:', data);
    
    if (!data.entity) {
      return { success: false, error: 'Invalid BVN or no data returned' };
    }
    
    const bvnData = data.entity;
    
    // Check selfie verification result
    if (!bvnData.selfie_verification || !bvnData.selfie_verification.match) {
      return { success: false, error: 'Selfie verification failed. Please ensure your face is clearly visible and matches your BVN photo.' };
    }
    
    console.log('Selfie verification confidence:', bvnData.selfie_verification.confidence_value);
    
    // Get names from BVN data
    const bvnFirstName = bvnData.first_name || '';
    const bvnLastName = bvnData.last_name || '';
    const bvnMiddleName = bvnData.middle_name || '';
    
    // Create a display name from BVN data
    const displayName = [bvnFirstName, bvnMiddleName, bvnLastName]
      .filter(Boolean)
      .join(' ');
    
    // Create audit log for BVN verification
    await supabase.rpc('create_kyc_audit_log', {
      p_user_id: userId,
      p_operation_type: 'bvn_verified',
      p_verification_type: 'bvn',
      p_verification_provider: 'dojah',
      p_request_data: {
        bvn: bvn,
        selfie_verification: true,
        name_matching: false
      },
      p_response_data: {
        bvn_data: bvnData,
        selfie_confidence: bvnData.selfie_verification?.confidence_value,
        matched_name: displayName
      },
      p_status: 'success',
      p_result_message: `BVN verified successfully. Name: ${displayName}`,
      p_confidence_score: bvnData.selfie_verification?.confidence_value || 95.0,
      p_metadata: {
        component: 'Tier1KYC',
        verification_step: 'bvn_verification',
        provider: 'dojah'
      }
    });
    
    // Update progress
    if (onProgressUpdate) {
      await onProgressUpdate({
        bvn_verified: true,
        current_step: 'id_face_match'
      });
    }
    
    return { success: true, displayName };
    
  } catch (error) {
    console.error('BVN verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'BVN verification failed';
    return { success: false, error: errorMessage };
  }
};

/**
 * Initialize NIN verification - sends OTP to phone number linked to NIN
 */
export const initializeNINVerification = async (
  nin: string,
  userId: string,
  userEmail: string
): Promise<{ success: boolean; identityId?: string; otpMessage?: string; error?: string }> => {
  try {
    if (!nin.trim()) {
      return { success: false, error: 'NIN is required' };
    }

    // Use SafeHaven service to initialize NIN verification
    const result = await safeHavenService.verifyNINAndCreateAccount(
      userId,
      nin.trim(),
      '', // Phone number not needed for initialization
      userEmail,
      undefined  // otp - not provided for initialization
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to initialize NIN verification' };
    }

    const identityId = result.data?.identityId;
    const message = result.data?.otpMessage;
    
    if (!identityId) {
      return { success: false, error: 'Identity ID not found in response' };
    }

    return {
      success: true,
      identityId,
      otpMessage: message || 'OTP sent to phone number linked to your NIN'
    };
    
  } catch (error) {
    console.error('NIN verification initialization error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize NIN verification';
    return { success: false, error: errorMessage };
  }
};

/**
 * Verify NIN with OTP and create SafeHaven account
 */
export const verifyNIN = async (
  nin: string,
  phoneNumber: string,
  otp: string,
  identityId: string,
  userId: string,
  userEmail: string,
  onProgressUpdate?: (updates: any) => Promise<boolean>
): Promise<{ success: boolean; accountNumber?: string; displayName?: string; error?: string }> => {
  try {
    if (!nin.trim()) {
      return { success: false, error: 'NIN is required' };
    }

    if (!otp || otp.length !== 6) {
      return { success: false, error: 'Valid 6-digit OTP is required' };
    }

    if (!phoneNumber) {
      return { success: false, error: 'Phone number is required for NIN verification.' };
    }

    // Create audit log for NIN verification
    const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
      p_user_id: userId,
      p_operation_type: 'nin_verification',
      p_verification_type: 'nin',
      p_verification_provider: 'safehaven',
      p_request_data: {
        action: 'verify_nin_with_otp',
        nin: nin.substring(0, 4) + '****',
        has_otp: true,
        timestamp: new Date().toISOString()
      },
      p_response_data: null,
      p_status: 'pending',
      p_result_message: 'NIN verification with OTP initiated',
      p_metadata: {
        component: 'Tier1KYC',
        action: 'nin_verification_verify',
        step: 'nin_verification',
        provider: 'safehaven'
      }
    });

    // Use SafeHaven service to create account with OTP
    const result = await safeHavenService.verifyNINAndCreateAccount(
      userId,
      nin.trim(),
      phoneNumber,
      userEmail,
      otp,
      identityId
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Account creation failed' };
    }

    const verificationData = result.data;
    
    if (!verificationData || !verificationData.verified) {
      return { success: false, error: 'NIN verification failed. Please check your NIN and try again.' };
    }

    // Extract account information
    const accountNumber = verificationData.account_number;
    const accountName = verificationData.account_name || `${verificationData.first_name} ${verificationData.last_name}`.trim();
    
    // Extract names from account name
    const names = accountName ? accountName.split(' ') : [];
    const ninFirstName = names[0] || '';
    const ninLastName = names[names.length - 1] || '';
    const ninMiddleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';
    
    // Create a display name from NIN data
    const displayName = [ninFirstName, ninMiddleName, ninLastName]
      .filter(Boolean)
      .join(' ');

    // Update audit log with success
    if (auditLogId) {
      await supabase
        .from('kyc_audit_logs')
        .update({
          status: 'success',
          response_data: {
            verified: true,
            nin: nin.substring(0, 4) + '****',
            matched_name: displayName,
            hasAccount: !!accountNumber,
            account_number: accountNumber ? accountNumber.substring(0, 5) + '****' : null
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', auditLogId);

      await supabase
        .from('kyc_audit_events')
        .insert({
          audit_log_id: auditLogId,
          user_id: userId,
          event_type: 'verification_completed',
          event_data: {
            action: 'nin_verification_completed',
            nin: nin.substring(0, 4) + '****',
            matched_name: displayName,
            hasAccount: !!accountNumber,
            account_number: accountNumber ? accountNumber.substring(0, 5) + '****' : null,
            provider: 'safehaven'
          },
          severity: 'high'
        });
    }
    
    // Update progress
    if (onProgressUpdate) {
      await onProgressUpdate({
        id_face_verified: true,
        tier_1_completed: true
      });
    }
    
    return { 
      success: true, 
      accountNumber,
      displayName
    };
    
  } catch (error) {
    console.error('NIN verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'NIN verification failed';
    return { success: false, error: errorMessage };
  }
};

/**
 * Validate BVN format
 */
export const validateBVN = (bvn: string): { isValid: boolean; error?: string } => {
  if (!bvn.trim()) {
    return { isValid: false, error: 'BVN is required' };
  }
  if (bvn.length !== 11 || !/^\d+$/.test(bvn)) {
    return { isValid: false, error: 'BVN must be 11 digits' };
  }
  return { isValid: true };
};

/**
 * Validate NIN format
 */
export const validateNIN = (nin: string): { isValid: boolean; error?: string } => {
  if (!nin.trim()) {
    return { isValid: false, error: 'NIN is required' };
  }
  if (nin.length !== 11 || !/^\d+$/.test(nin)) {
    return { isValid: false, error: 'NIN must be 11 digits' };
  }
  return { isValid: true };
};

