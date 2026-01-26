/**
 * Disbursement Detail API
 * 
 * Get disbursement status and details.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('*, wallets(*)')
        .eq('id', params.id)
        .eq('type', 'disbursement')
        .single();

      if (error || !transaction) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Disbursement not found',
          },
          404
        );
      }

      const wallet = transaction.wallets as any;

      // Check access
      if (auth.partner_id && wallet?.partner_id !== auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      if (auth.user_id && wallet?.user_id !== auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      // Get approval request if exists
      let approvalRequest = null;
      const { data: approvals } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('transaction_id', transaction.id)
        .limit(1);
      
      if (approvals && approvals.length > 0) {
        approvalRequest = approvals[0];
      }

      return createJsonResponse({
        disbursement: {
          id: transaction.id,
          wallet_id: transaction.wallet_id,
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.reference,
          description: transaction.description,
          created_at: transaction.created_at,
          metadata: transaction.metadata,
          approval_request: approvalRequest,
        },
      });
    } catch (error) {
      console.error('Disbursement GET error:', error);
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
