/**
 * Partner User Detail API
 * 
 * Get partner user by external_user_id.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: { id: string; externalUserId: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      // Partners can only view their own users
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      const { data: partnerUser, error } = await supabase
        .from('partner_users')
        .select('*, wallets(*), profiles(id, email)')
        .eq('partner_id', params.id)
        .eq('external_user_id', params.externalUserId)
        .single();

      if (error || !partnerUser) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Partner user not found',
          },
          404
        );
      }

      return createJsonResponse({ user: partnerUser });
    } catch (error) {
      console.error('Partner User GET error:', error);
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
