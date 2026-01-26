/**
 * Wallet Balance API
 * 
 * Get wallet balance including available, locked, and restricted amounts.
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
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !wallet) {
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

      if (auth.user_id && wallet.user_id !== auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      // Calculate restricted amount from restrictions
      let restrictedAmount = 0;
      const { data: restrictions } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('is_active', true);

      if (restrictions) {
        // Calculate max available based on restrictions
        for (const restriction of restrictions) {
          if (restriction.restriction_type === 'max_balance') {
            const maxBalance = (restriction.restriction_value as any)?.amount || 0;
            if (wallet.balance > maxBalance) {
              restrictedAmount = Math.max(restrictedAmount, wallet.balance - maxBalance);
            }
          }
        }
      }

      return createJsonResponse({
        balance: {
          total: wallet.balance,
          available: wallet.available_balance || (wallet.balance - wallet.locked_balance),
          locked: wallet.locked_balance,
          restricted: restrictedAmount,
          currency: 'NGN',
        },
      });
    } catch (error) {
      console.error('Balance GET error:', error);
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
