/**
 * API Key Detail API
 * 
 * Revoke individual API keys.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; keyId: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      // Partners can only revoke their own API keys
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      // Verify API key belongs to partner
      const { data: apiKey } = await supabase
        .from('partner_api_keys')
        .select('id')
        .eq('id', params.keyId)
        .eq('partner_id', params.id)
        .single();

      if (!apiKey) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'API key not found',
          },
          404
        );
      }

      // Revoke by setting is_active to false
      const { error } = await supabase
        .from('partner_api_keys')
        .update({ is_active: false })
        .eq('id', params.keyId);

      if (error) {
        console.error('Error revoking API key:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to revoke API key',
          },
          500
        );
      }

      return createJsonResponse({ message: 'API key revoked successfully' });
    } catch (error) {
      console.error('API Key DELETE error:', error);
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
