/**
 * Ledger Integrity Verification API
 * 
 * Verify the integrity of the audit ledger for a wallet.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const body = await request.json();
      const { wallet_id } = body;

      if (!wallet_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'wallet_id is required',
          },
          400
        );
      }

      // Verify wallet access
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
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
            message: 'Access denied',
          },
          403
        );
      }

      // Verify ledger integrity
      const { data: integrityCheck, error } = await supabase.rpc('verify_ledger_integrity', {
        p_wallet_id: wallet_id,
      });

      if (error) {
        console.error('Error verifying integrity:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to verify ledger integrity',
          },
          500
        );
      }

      return createJsonResponse({ integrity: integrityCheck });
    } catch (error) {
      console.error('Integrity POST error:', error);
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
