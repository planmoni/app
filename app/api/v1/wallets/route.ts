/**
 * Wallets API
 * 
 * Create and list restricted wallets.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const url = new URL(request.url);
      const partnerUserId = url.searchParams.get('partner_user_id');
      const externalUserId = url.searchParams.get('external_user_id');

      let query = supabase.from('wallets').select('*');

      // Filter by partner if partner context exists
      if (auth.partner_id) {
        query = query.eq('partner_id', auth.partner_id);

        // If external_user_id provided, get wallet via partner_users
        if (externalUserId) {
          const { data: partnerUser } = await supabase
            .from('partner_users')
            .select('wallet_id')
            .eq('partner_id', auth.partner_id)
            .eq('external_user_id', externalUserId)
            .single();

          if (partnerUser?.wallet_id) {
            query = query.eq('id', partnerUser.wallet_id);
          } else {
            return createJsonResponse({ wallets: [] });
          }
        }
      } else if (auth.user_id) {
        // B2C: filter by user_id
        query = query.eq('user_id', auth.user_id);
      }

      const { data: wallets, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching wallets:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch wallets',
          },
          500
        );
      }

      // Get restrictions for each wallet
      const walletsWithRestrictions = await Promise.all(
        (wallets || []).map(async (wallet) => {
          const { data: restrictions } = await supabase
            .from('wallet_restrictions')
            .select('*')
            .eq('wallet_id', wallet.id)
            .eq('is_active', true);

          return {
            ...wallet,
            restrictions: restrictions || [],
          };
        })
      );

      return createJsonResponse({ wallets: walletsWithRestrictions });
    } catch (error) {
      console.error('Wallets GET error:', error);
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
        external_user_id, // Partner's user ID
        user_id, // Planmoni user ID (optional, will create if not provided)
        policy_id,
        restrictions,
        is_restricted,
        requires_approval,
        metadata,
      } = body;

      // For partner API, external_user_id is required
      if (auth.partner_id && !external_user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'external_user_id is required for partner wallets',
          },
          400
        );
      }

      // For B2C, user_id is required
      if (!auth.partner_id && !user_id && !auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'user_id is required',
          },
          400
        );
      }

      let targetUserId = user_id || auth.user_id;

      // If partner API with external_user_id, find or create user mapping
      if (auth.partner_id && external_user_id) {
        // Check if partner_user already exists
        const { data: existingPartnerUser } = await supabase
          .from('partner_users')
          .select('user_id, wallet_id')
          .eq('partner_id', auth.partner_id)
          .eq('external_user_id', external_user_id)
          .single();

        if (existingPartnerUser) {
          // Wallet already exists for this partner user
          if (existingPartnerUser.wallet_id) {
            const { data: wallet } = await supabase
              .from('wallets')
              .select('*')
              .eq('id', existingPartnerUser.wallet_id)
              .single();

            return createJsonResponse({ wallet }, 200);
          }
          targetUserId = existingPartnerUser.user_id;
        } else {
          // Create new Planmoni user for this partner user
          // In production, this would create a proper user account
          // For now, we'll use a placeholder approach
          return createErrorResponse(
            {
              error: ERROR_CODES.VALIDATION_ERROR,
              message: 'User creation for partner users not yet implemented. Please provide user_id.',
            },
            400
          );
        }
      }

      if (!targetUserId) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'Unable to determine user_id',
          },
          400
        );
      }

      // Create wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .insert({
          user_id: targetUserId,
          partner_id: auth.partner_id || null,
          balance: 0,
          locked_balance: 0,
          available_balance: 0,
          is_restricted: is_restricted || false,
          requires_approval: requires_approval || false,
          policy_id: policy_id || null,
        })
        .select()
        .single();

      if (walletError) {
        console.error('Error creating wallet:', walletError);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create wallet',
            details: walletError.message,
          },
          500
        );
      }

      // Create partner_user mapping if needed
      if (auth.partner_id && external_user_id) {
        await supabase.from('partner_users').upsert({
          partner_id: auth.partner_id,
          user_id: targetUserId,
          external_user_id,
          wallet_id: wallet.id,
          status: 'active',
          metadata: metadata || {},
        });
      }

      // Add restrictions if provided
      if (restrictions && Array.isArray(restrictions)) {
        const restrictionInserts = restrictions.map((restriction: any) => ({
          wallet_id: wallet.id,
          restriction_type: restriction.type,
          restriction_value: restriction.value,
          is_active: true,
        }));

        await supabase.from('wallet_restrictions').insert(restrictionInserts);
      }

      // Fetch wallet with restrictions
      const { data: restrictions } = await supabase
        .from('wallet_restrictions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('is_active', true);

      return createJsonResponse(
        {
          wallet: {
            ...wallet,
            restrictions: restrictions || [],
          },
        },
        201
      );
    } catch (error: any) {
      console.error('Wallets POST error:', error);
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
