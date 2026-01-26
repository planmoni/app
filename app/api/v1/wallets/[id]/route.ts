/**
 * Wallet Detail API
 * 
 * Get, update, and delete individual wallets.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
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

      // Get restrictions
      const { data: restrictions } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('is_active', true);

      // Get policy if exists
      let policy = null;
      if (wallet.policy_id) {
        const { data: policyData } = await supabase
          .from('wallet_policies')
          .select('*')
          .eq('id', wallet.policy_id)
          .single();
        policy = policyData;
      }

      return createJsonResponse({
        wallet: {
          ...wallet,
          restrictions: restrictions || [],
          policy,
        },
      });
    } catch (error) {
      console.error('Wallet GET error:', error);
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

export async function PATCH(
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
      const { policy_id, is_restricted, requires_approval } = body;

      // Update wallet (only allow updating policy and flags, not balance)
      const updateData: any = {};
      if (policy_id !== undefined) updateData.policy_id = policy_id;
      if (is_restricted !== undefined) updateData.is_restricted = is_restricted;
      if (requires_approval !== undefined) updateData.requires_approval = requires_approval;

      const { data: updatedWallet, error } = await supabase
        .from('wallets')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating wallet:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to update wallet',
          },
          500
        );
      }

      return createJsonResponse({ wallet: updatedWallet });
    } catch (error) {
      console.error('Wallet PATCH error:', error);
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

export async function DELETE(
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

      // Deactivate wallet by removing partner association
      // Don't actually delete to preserve audit trail
      const { error } = await supabase
        .from('wallets')
        .update({ partner_id: null })
        .eq('id', params.id);

      if (error) {
        console.error('Error deactivating wallet:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to deactivate wallet',
          },
          500
        );
      }

      return createJsonResponse({ message: 'Wallet deactivated successfully' });
    } catch (error) {
      console.error('Wallet DELETE error:', error);
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
