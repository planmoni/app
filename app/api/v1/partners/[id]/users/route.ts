/**
 * Partner Users API
 * 
 * Manage partner users (mapping between partner's external user IDs and Planmoni users).
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

      const url = new URL(request.url);
      const externalUserId = url.searchParams.get('external_user_id');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('partner_users')
        .select('*, wallets(*), profiles(id, email)')
        .eq('partner_id', params.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (externalUserId) {
        query = query.eq('external_user_id', externalUserId);
      }

      const { data: partnerUsers, error } = await query;

      if (error) {
        console.error('Error fetching partner users:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch partner users',
          },
          500
        );
      }

      return createJsonResponse({ users: partnerUsers || [] });
    } catch (error) {
      console.error('Partner Users GET error:', error);
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
      // Partners can only create users for themselves
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      const body = await request.json();
      const { external_user_id, user_id, metadata } = body;

      // Validate required fields
      if (!external_user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'external_user_id is required',
          },
          400
        );
      }

      // Check if partner user already exists
      const { data: existing } = await supabase
        .from('partner_users')
        .select('*')
        .eq('partner_id', params.id)
        .eq('external_user_id', external_user_id)
        .single();

      if (existing) {
        return createJsonResponse({ user: existing }, 200);
      }

      // If user_id provided, use it; otherwise create new user
      // For now, user_id is required
      if (!user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'user_id is required. User creation for partner users not yet implemented.',
          },
          400
        );
      }

      // Verify user exists
      const { data: user } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user_id)
        .single();

      if (!user) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'User not found',
          },
          404
        );
      }

      // Get or create wallet for this user
      let walletId = null;
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user_id)
        .eq('partner_id', params.id)
        .single();

      if (wallet) {
        walletId = wallet.id;
      } else {
        // Create wallet for partner user
        const { data: newWallet } = await supabase
          .from('wallets')
          .insert({
            user_id,
            partner_id: params.id,
            balance: 0,
            locked_balance: 0,
            available_balance: 0,
          })
          .select('id')
          .single();

        if (newWallet) {
          walletId = newWallet.id;
        }
      }

      // Create partner user mapping
      const { data: partnerUser, error } = await supabase
        .from('partner_users')
        .insert({
          partner_id: params.id,
          user_id,
          external_user_id,
          wallet_id: walletId,
          status: 'active',
          metadata: metadata || {},
        })
        .select('*, wallets(*), profiles(id, email)')
        .single();

      if (error) {
        console.error('Error creating partner user:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create partner user',
            details: error.message,
          },
          500
        );
      }

      return createJsonResponse({ user: partnerUser }, 201);
    } catch (error: any) {
      console.error('Partner Users POST error:', error);
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
