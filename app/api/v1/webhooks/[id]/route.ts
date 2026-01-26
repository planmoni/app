/**
 * Webhook Detail API
 * 
 * Get, update, and delete individual webhook configurations.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const VALID_EVENT_TYPES = [
  'wallet.created',
  'wallet.balance_changed',
  'disbursement.requested',
  'disbursement.approved',
  'disbursement.completed',
  'disbursement.rejected',
  'approval.required',
  'approval.completed',
  'policy.violated',
  'restriction.triggered',
];

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

      const { data: webhook, error } = await supabase
        .from('webhook_configurations')
        .select('*')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (error || !webhook) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Webhook not found',
          },
          404
        );
      }

      // Don't return secret in GET
      const { secret, ...webhookWithoutSecret } = webhook;

      return createJsonResponse({ webhook: webhookWithoutSecret });
    } catch (error) {
      console.error('Webhook GET error:', error);
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
      const { url, events, is_active } = body;

      // Verify webhook belongs to partner
      const { data: existingWebhook } = await supabase
        .from('webhook_configurations')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingWebhook) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Webhook not found',
          },
          404
        );
      }

      // Validate events if provided
      if (events && Array.isArray(events)) {
        const invalidEvents = events.filter((e: string) => !VALID_EVENT_TYPES.includes(e));
        if (invalidEvents.length > 0) {
          return createErrorResponse(
            {
              error: ERROR_CODES.VALIDATION_ERROR,
              message: `Invalid event types: ${invalidEvents.join(', ')}`,
            },
            400
          );
        }
      }

      // Update webhook
      const updateData: any = {};
      if (url !== undefined) updateData.url = url;
      if (events !== undefined) updateData.events = events;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: webhook, error } = await supabase
        .from('webhook_configurations')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating webhook:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to update webhook',
          },
          500
        );
      }

      const { secret, ...webhookWithoutSecret } = webhook;

      return createJsonResponse({ webhook: webhookWithoutSecret });
    } catch (error) {
      console.error('Webhook PATCH error:', error);
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

      // Verify webhook belongs to partner
      const { data: existingWebhook } = await supabase
        .from('webhook_configurations')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingWebhook) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Webhook not found',
          },
          404
        );
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('webhook_configurations')
        .update({ is_active: false })
        .eq('id', params.id);

      if (error) {
        console.error('Error deleting webhook:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to delete webhook',
          },
          500
        );
      }

      return createJsonResponse({ message: 'Webhook deleted successfully' });
    } catch (error) {
      console.error('Webhook DELETE error:', error);
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
