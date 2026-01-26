/**
 * Policy Detail API
 * 
 * Get, update, and delete individual policies.
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
      if (!auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Partner context required',
          },
          403
        );
      }

      const { data: policy, error } = await supabase
        .from('wallet_policies')
        .select('*')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (error || !policy) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Policy not found',
          },
          404
        );
      }

      return createJsonResponse({ policy });
    } catch (error) {
      console.error('Policy GET error:', error);
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
      const { name, description, policy_rules, is_default, is_active } = body;

      // Verify policy belongs to partner
      const { data: existingPolicy } = await supabase
        .from('wallet_policies')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingPolicy) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Policy not found',
          },
          404
        );
      }

      // If setting as default, unset other defaults
      if (is_default === true) {
        await supabase
          .from('wallet_policies')
          .update({ is_default: false })
          .eq('partner_id', auth.partner_id)
          .eq('is_default', true)
          .neq('id', params.id);
      }

      // Update policy
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (policy_rules !== undefined) updateData.policy_rules = policy_rules;
      if (is_default !== undefined) updateData.is_default = is_default;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: policy, error } = await supabase
        .from('wallet_policies')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating policy:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to update policy',
          },
          500
        );
      }

      return createJsonResponse({ policy });
    } catch (error) {
      console.error('Policy PATCH error:', error);
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
      if (!auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Partner context required',
          },
          403
        );
      }

      // Verify policy belongs to partner
      const { data: existingPolicy } = await supabase
        .from('wallet_policies')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingPolicy) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Policy not found',
          },
          404
        );
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('wallet_policies')
        .update({ is_active: false })
        .eq('id', params.id);

      if (error) {
        console.error('Error deleting policy:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to delete policy',
          },
          500
        );
      }

      return createJsonResponse({ message: 'Policy deleted successfully' });
    } catch (error) {
      console.error('Policy DELETE error:', error);
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
