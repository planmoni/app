/**
 * Approval Request Detail API
 * 
 * Get, approve, and reject individual approval requests.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
import { approvalEngine } from '@/lib/approval-engine';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const { data: approvalRequest, error } = await supabase
        .from('approval_requests')
        .select('*, approval_workflows(*), wallets(*), transactions(*), approval_actions(*)')
        .eq('id', params.id)
        .single();

      if (error || !approvalRequest) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Approval request not found',
          },
          404
        );
      }

      // Check access
      if (auth.partner_id && approvalRequest.partner_id !== auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      if (auth.user_id) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('user_id')
          .eq('id', approvalRequest.wallet_id)
          .single();

        if (wallet?.user_id !== auth.user_id) {
          return createErrorResponse(
            {
              error: ERROR_CODES.FORBIDDEN,
              message: 'Access denied',
            },
            403
          );
        }
      }

      return createJsonResponse({ request: approvalRequest });
    } catch (error) {
      console.error('Approval GET error:', error);
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
