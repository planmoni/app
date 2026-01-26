/**
 * Wallet Restrictions API
 * 
 * Manage restrictions for a wallet.
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
      // Verify wallet access
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', params.id)
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
            message: 'Access denied',
          },
          403
        );
      }

      const { data: restrictions, error } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('wallet_id', params.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching restrictions:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch restrictions',
          },
          500
        );
      }

      return createJsonResponse({ restrictions: restrictions || [] });
    } catch (error) {
      console.error('Restrictions GET error:', error);
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
      // Verify wallet access
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', params.id)
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
            message: 'Access denied',
          },
          403
        );
      }

      const body = await request.json();
      const { restriction_type, restriction_value } = body;

      // Validate required fields
      if (!restriction_type || !restriction_value) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'restriction_type and restriction_value are required',
          },
          400
        );
      }

      // Validate restriction type
      const validTypes = [
        'max_balance',
        'min_balance',
        'daily_limit',
        'transaction_limit',
        'withdrawal_limit',
        'approval_required',
        'time_restriction',
        'purpose_restriction',
      ];

      if (!validTypes.includes(restriction_type)) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: `Invalid restriction_type. Must be one of: ${validTypes.join(', ')}`,
          },
          400
        );
      }

      // Create restriction
      const { data: restriction, error } = await supabase
        .from('wallet_restrictions')
        .insert({
          wallet_id: params.id,
          restriction_type,
          restriction_value,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating restriction:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create restriction',
            details: error.message,
          },
          500
        );
      }

      // Update wallet is_restricted flag if needed
      if (!wallet.is_restricted) {
        await supabase
          .from('wallets')
          .update({ is_restricted: true })
          .eq('id', params.id);
      }

      return createJsonResponse({ restriction }, 201);
    } catch (error: any) {
      console.error('Restrictions POST error:', error);
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
