/**
 * Policies API
 * 
 * CRUD operations for wallet policies.
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
      if (!auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Partner context required',
          },
          403
        );
      }

      const { data: policies, error } = await supabase
        .from('wallet_policies')
        .select('*')
        .eq('partner_id', auth.partner_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching policies:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch policies',
          },
          500
        );
      }

      return createJsonResponse({ policies: policies || [] });
    } catch (error) {
      console.error('Policies GET error:', error);
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
      if (!auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Partner context required',
          },
          403
        );
      }

      const body = await request.json();
      const { name, description, policy_rules, is_default } = body;

      // Validate required fields
      if (!name || !policy_rules) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'Name and policy_rules are required',
          },
          400
        );
      }

      // If setting as default, unset other defaults for this partner
      if (is_default) {
        await supabase
          .from('wallet_policies')
          .update({ is_default: false })
          .eq('partner_id', auth.partner_id)
          .eq('is_default', true);
      }

      // Create policy
      const { data: policy, error } = await supabase
        .from('wallet_policies')
        .insert({
          partner_id: auth.partner_id,
          name,
          description: description || null,
          policy_rules,
          is_default: is_default || false,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating policy:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create policy',
            details: error.message,
          },
          500
        );
      }

      return createJsonResponse({ policy }, 201);
    } catch (error) {
      console.error('Policies POST error:', error);
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
