/**
 * TOTP (Time-based One-Time Password) utilities for 2FA
 * 
 * This module provides functions for:
 * - Generating TOTP secrets
 * - Creating QR codes for authenticator apps
 * - Verifying TOTP tokens
 * - Managing backup codes
 */

import { supabase } from './supabase';

export interface TOTPSecret {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface BackupCodes {
  codes: string[];
  generatedAt: Date;
}

/**
 * Generate a TOTP secret for a user
 */
export async function generateTOTPSecret(userId: string): Promise<TOTPSecret> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No valid session found');
    }
    
    console.log('Generating TOTP secret for user:', userId);
    console.log('Session exists:', !!session);
    
    const { data, error } = await supabase.functions.invoke('generate-totp-secret', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('TOTP secret generation error details:', error);
      throw error;
    }
    
    console.log('TOTP secret generation response:', data);

    const secret = data.secret;
    const qrCodeUrl = generateQRCodeUrl(secret, userId);
    const manualEntryKey = secret;

    return {
      secret,
      qrCodeUrl,
      manualEntryKey
    };
  } catch (error) {
    console.error('Error generating TOTP secret:', error);
    throw error;
  }
}

/**
 * Generate QR code URL for authenticator apps
 */
export function generateQRCodeUrl(secret: string, userId: string): string {
  // Get user email for the QR code label
  const userEmail = 'user@example.com'; // You'll need to get this from user context
  
  const issuer = 'Planmoni';
  const accountName = userEmail;
  
  // Create otpauth URL
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  
  return otpauthUrl;
}

/**
 * Verify a TOTP token
 */
export async function verifyTOTPToken(
  userId: string, 
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No valid session found');
    }
    
    console.log('Verifying TOTP token for user:', userId);
    console.log('Token:', token);
    console.log('Session exists:', !!session);
    
    // Use direct fetch instead of supabase.functions.invoke to ensure proper body handling
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/verify-totp-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    console.log('TOTP verification response:', data);
    return data.valid;
  } catch (error) {
    console.error('Error verifying TOTP token:', error);
    throw error;
  }
}

/**
 * Generate backup codes for a user
 */
export async function generateBackupCodes(userId: string): Promise<BackupCodes> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('generate-backup-codes', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
    });

    if (error) throw error;

    return {
      codes: data.codes,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating backup codes:', error);
    throw error;
  }
}

/**
 * Verify a backup code
 */
export async function verifyBackupCode(
  userId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('totp-operations', {
      body: { code },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
    });

    if (error) throw error;
    return data.valid;
  } catch (error) {
    console.error('Error verifying backup code:', error);
    throw error;
  }
}

/**
 * Enable TOTP for a user after verification
 */
export async function enableTOTPForUser(
  userId: string,
  verificationToken: string
): Promise<boolean> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    // Use direct fetch instead of supabase.functions.invoke to ensure proper body handling
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/enable-totp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token: verificationToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error enabling TOTP:', error);
    throw error;
  }
}

/**
 * Disable TOTP for a user
 */
export async function disableTOTPForUser(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('totp-operations', {
      method: 'DELETE',
      body: {},
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) throw error;
    return data.success;
  } catch (error) {
    console.error('Error disabling TOTP:', error);
    throw error;
  }
}

/**
 * Get user's 2FA status
 */
export async function get2FAStatus(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('two_factor_enabled, two_factor_method, totp_enabled, totp_setup_completed_at')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    throw error;
  }
}


/**
 * Format backup codes for display
 */
export function formatBackupCodes(codes: string[]): string[] {
  return codes.map((code, index) => {
    // Format as: XXXX-XXXX (8 characters with dash in middle)
    const formatted = code.replace(/(.{4})/, '$1-');
    return `${index + 1}. ${formatted}`;
  });
}

/**
 * Validate TOTP token format
 */
export function validateTOTPToken(token: string): boolean {
  // TOTP tokens should be 6 digits
  return /^\d{6}$/.test(token);
}

/**
 * Validate backup code format
 */
export function validateBackupCode(code: string): boolean {
  // Backup codes should be 8 alphanumeric characters
  return /^[A-Z0-9]{8}$/.test(code.toUpperCase());
}

/**
 * Reset 2FA status (for fixing inconsistent states)
 */
export async function reset2FAStatus(userId: string): Promise<boolean> {
  try {
    // Reset 2FA status in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        two_factor_enabled: false,
        totp_enabled: false,
        two_factor_method: 'email',
        totp_secret: null,
        totp_setup_completed_at: null
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    // Delete all backup codes
    const { error: backupCodesError } = await supabase
      .from('two_factor_backup_codes')
      .delete()
      .eq('user_id', userId);

    if (backupCodesError) throw backupCodesError;

    return true;
  } catch (error) {
    console.error('Error resetting 2FA status:', error);
    throw error;
  }
}

/**
 * Debug function to check TOTP status
 */
export async function debugTOTPStatus(userId: string): Promise<any> {
  try {
    // Get the current session to include auth headers
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No valid session found');
    }
    
    const { data, error } = await supabase.functions.invoke('debug-totp', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Debug TOTP error details:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error debugging TOTP status:', error);
    throw error;
  }
}

/**
 * Get remaining backup codes count
 */
export async function getRemainingBackupCodesCount(userId: string): Promise<number> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No valid session found');
    }
    
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/get-backup-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error getting backup codes count:', error);
    return 0;
  }
}

/**
 * Check if user has backup codes
 */
export async function hasBackupCodes(userId: string): Promise<boolean> {
  try {
    const count = await getRemainingBackupCodesCount(userId);
    return count > 0;
  } catch (error) {
    console.error('Error checking backup codes:', error);
    return false;
  }
}
