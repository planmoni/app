/**
 * Wallet Restriction Detail API
 * 
 * Delete individual restrictions.
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
  { params }: { params: { id: string; restrictionId: string } }
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

      // Verify restriction belongs to wallet
      const { data: restriction } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('id', params.restrictionId)
        .eq('wallet_id', params.id)
        .single();

      if (!restriction) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Restriction not found',
          },
          404
        );
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('wallet_restrictions')
        .update({ is_active: false })
        .eq('id', params.restrictionId);

      if (error) {
        console.error('Error deleting restriction:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to delete restriction',
          },
          500
        );
      }

      // Check if wallet has any active restrictions left
      const { count } = await supabase
        .from('wallet_restrictions')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_id', params.id)
        .eq('is_active', true);

      // Update wallet is_restricted flag if no restrictions remain
      if (count === 0) {
        await supabase
          .from('wallets')
          .update({ is_restricted: false })
          .eq('id', params.id);
      }

      return createJsonResponse({ message: 'Restriction deleted successfully' });
    } catch (error) {
      console.error('Restriction DELETE error:', error);
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
