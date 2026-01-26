/**
 * Approvals API
 * 
 * List and create approval requests.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
import { approvalEngine } from '@/lib/approval-engine';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || 'pending';
      const walletId = url.searchParams.get('wallet_id');

      let query = supabase
        .from('approval_requests')
        .select('*, approval_workflows(*), wallets(*), transactions(*)')
        .eq('status', status)
        .order('created_at', { ascending: false });

      // Filter by partner if partner context exists
      if (auth.partner_id) {
        query = query.eq('partner_id', auth.partner_id);
      }

      // Filter by wallet if provided
      if (walletId) {
        query = query.eq('wallet_id', walletId);
      }

      // If user context, filter by user's wallets
      if (auth.user_id && !auth.partner_id) {
        query = query.in(
          'wallet_id',
          supabase.from('wallets').select('id').eq('user_id', auth.user_id)
        );
      }

      const { data: requests, error } = await query;

      if (error) {
        console.error('Error fetching approval requests:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch approval requests',
          },
          500
        );
      }

      return createJsonResponse({ requests: requests || [] });
    } catch (error) {
      console.error('Approvals GET error:', error);
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

export async function POST(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const body = await request.json();
      const {
        workflow_id,
        wallet_id,
        transaction_id,
        request_type,
        amount,
        purpose,
        metadata,
      } = body;

      // Validate required fields
      if (!wallet_id || !request_type) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'wallet_id and request_type are required',
          },
          400
        );
      }

      // Verify wallet belongs to partner or user
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, partner_id, user_id')
        .eq('id', wallet_id)
        .single();

      if (!wallet) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Wallet not found',
          },
          404
        );
      }

      // Check access
      if (auth.partner_id && wallet.partner_id !== auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied to this wallet',
          },
          403
        );
      }

      if (auth.user_id && wallet.user_id !== auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied to this wallet',
          },
          403
        );
      }

      // Create approval request
      const approvalRequest = await approvalEngine.createRequest(
        workflow_id || null,
        wallet_id,
        request_type,
        amount,
        transaction_id,
        auth.partner_id || wallet.partner_id,
        purpose,
        metadata
      );

      return createJsonResponse({ request: approvalRequest }, 201);
    } catch (error: any) {
      console.error('Approvals POST error:', error);
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
