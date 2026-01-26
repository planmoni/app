/**
 * Partner Detail API
 * 
 * Get, update, and delete individual partners.
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
      // Partners can only view themselves
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      const { data: partner, error } = await supabase
        .from('partners')
        .select('*, partner_settings(*)')
        .eq('id', params.id)
        .single();

      if (error || !partner) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Partner not found',
          },
          404
        );
      }

      return createJsonResponse({ partner });
    } catch (error) {
      console.error('Partner GET error:', error);
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
      // Partners can only update themselves
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
      const { name, webhook_url, webhook_secret, settings, metadata, status, subscription_tier } = body;

      // Update partner
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (webhook_secret !== undefined) updateData.webhook_secret = webhook_secret;
      if (settings !== undefined) updateData.settings = settings;
      if (metadata !== undefined) updateData.metadata = metadata;
      // Status and tier changes should be admin-only
      // if (status !== undefined) updateData.status = status;
      // if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;

      const { data: partner, error } = await supabase
        .from('partners')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating partner:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to update partner',
          },
          500
        );
      }

      return createJsonResponse({ partner });
    } catch (error) {
      console.error('Partner PATCH error:', error);
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
      // Only admins can delete partners
      if (auth.partner_id && auth.partner_id !== params.id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      // Soft delete by setting status to inactive
      const { error } = await supabase
        .from('partners')
        .update({ status: 'inactive' })
        .eq('id', params.id);

      if (error) {
        console.error('Error deleting partner:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to delete partner',
          },
          500
        );
      }

      return createJsonResponse({ message: 'Partner deactivated successfully' });
    } catch (error) {
      console.error('Partner DELETE error:', error);
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
