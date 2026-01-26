/**
 * Partner API Keys API
 * 
 * Generate, list, and revoke API keys for partners.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
// Note: In Node.js/Next.js, crypto is available globally
// For React Native, you may need to use expo-crypto or react-native-crypto
const crypto = require('crypto');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate random API key
  const key = `pk_live_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12); // First 12 characters for identification
  
  // Hash the key (in production, use bcrypt)
  // For now, using a simple hash - replace with bcrypt in production
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  
  return { key, prefix, hash };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      // Partners can only view their own API keys
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      const { data: apiKeys, error } = await supabase
        .from('partner_api_keys')
        .select('id, key_prefix, name, is_active, last_used_at, expires_at, created_at')
        .eq('partner_id', params.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching API keys:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch API keys',
          },
          500
        );
      }

      return createJsonResponse({ api_keys: apiKeys || [] });
    } catch (error) {
      console.error('API Keys GET error:', error);
      return createErrorResponse(
        {
          error: ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        500
      );
    }
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      // Partners can only create API keys for themselves
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      const body = await request.json();
      const { name, expires_in_days } = body;

      // Generate API key
      const { key, prefix, hash } = generateApiKey();

      // Calculate expiration date if provided
      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Store API key (hash only, never store plain key)
      const { data: apiKeyRecord, error } = await supabase
        .from('partner_api_keys')
        .insert({
          partner_id: params.id,
          key_hash: hash,
          key_prefix: prefix,
          name: name || 'API Key',
          is_active: true,
          expires_at: expiresAt,
          created_by: auth.user_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating API key:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create API key',
            details: error.message,
          },
          500
        );
      }

      // Return the key only once (never store it)
      return createJsonResponse(
        {
          api_key: {
            id: apiKeyRecord.id,
            key, // Only returned once on creation
            prefix,
            name: apiKeyRecord.name,
            expires_at: apiKeyRecord.expires_at,
            created_at: apiKeyRecord.created_at,
          },
          warning: 'Store this API key securely. It will not be shown again.',
        },
        201
      );
    } catch (error: any) {
      console.error('API Keys POST error:', error);
      return createErrorResponse(
        {
          error: ERROR_CODES.INTERNAL_ERROR,
          message: error.message || 'Internal server error',
        },
        500
      );
    }
  });
}
