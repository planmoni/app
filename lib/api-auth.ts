/**
 * API Authentication Utilities
 * 
 * Shared authentication utilities for Planmoni Platform API.
 * Supports both API key authentication (for partners) and
 * Bearer token authentication (for dashboard access).
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
// Note: bcryptjs should be installed: npm install bcryptjs @types/bcryptjs
// For now, using a placeholder - implement proper hashing in production
const bcrypt = {
  compare: async (plain: string, hash: string): Promise<boolean> => {
    // TODO: Implement proper bcrypt comparison
    // This is a placeholder - replace with actual bcryptjs.compare
    return false;
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export interface ApiAuthResult {
  success: boolean;
  partner_id?: string;
  user_id?: string;
  partner?: any;
  user?: any;
  error?: string;
}

/**
 * Verify API key from X-API-Key header
 */
export async function verifyApiKey(request: Request): Promise<ApiAuthResult> {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return { success: false, error: 'Missing X-API-Key header' };
  }

  try {
    // Get all active API keys with their prefixes
    const { data: apiKeys, error } = await supabase
      .from('partner_api_keys')
      .select('*, partners(*)')
      .eq('is_active', true)
      .is('expires_at', null)
      .or('expires_at.gt.' + new Date().toISOString());

    if (error) {
      console.error('Error fetching API keys:', error);
      return { success: false, error: 'Authentication error' };
    }

    // Find matching API key by comparing hash
    for (const keyRecord of apiKeys || []) {
      const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
      
      if (isValid) {
        // Update last_used_at
        await supabase
          .from('partner_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyRecord.id);

        return {
          success: true,
          partner_id: keyRecord.partner_id,
          partner: keyRecord.partners,
        };
      }
    }

    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    console.error('API key verification error:', error);
    return { success: false, error: 'Authentication error' };
  }
}

/**
 * Verify Bearer token from Authorization header
 */
export async function verifyBearerToken(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { success: false, error: 'Invalid token' };
  }

  return {
    success: true,
    user_id: user.id,
    user,
  };
}

/**
 * Get organization/partner from request (supports both auth methods)
 */
export async function getOrganizationFromRequest(request: Request): Promise<ApiAuthResult> {
  // Try API key first (for partner API access)
  const apiKeyResult = await verifyApiKey(request);
  if (apiKeyResult.success) {
    return apiKeyResult;
  }

  // Fall back to Bearer token (for dashboard access)
  const bearerResult = await verifyBearerToken(request);
  if (bearerResult.success && bearerResult.user_id) {
    // Get partner for this user
    const { data: partnerUser } = await supabase
      .from('partner_users')
      .select('*, partners(*)')
      .eq('user_id', bearerResult.user_id)
      .single();

    if (partnerUser) {
      return {
        success: true,
        partner_id: partnerUser.partner_id,
        user_id: bearerResult.user_id,
        partner: partnerUser.partners,
        user: bearerResult.user,
      };
    }
  }

  return { success: false, error: 'Authentication required' };
}

/**
 * Check if user has permission for organization
 */
export async function checkOrganizationPermission(
  partnerId: string,
  userId: string,
  permission: string
): Promise<boolean> {
  // Get partner user record
  const { data: partnerUser } = await supabase
    .from('partner_users')
    .select('role, permissions')
    .eq('partner_id', partnerId)
    .eq('user_id', userId)
    .single();

  if (!partnerUser) {
    return false;
  }

  // Check role-based permissions
  if (partnerUser.role === 'owner' || partnerUser.role === 'admin') {
    return true;
  }

  // Check specific permissions if stored
  if (partnerUser.permissions && typeof partnerUser.permissions === 'object') {
    const perms = partnerUser.permissions as Record<string, boolean>;
    return perms[permission] === true;
  }

  return false;
}
