/**
 * Webhooks API
 * 
 * Configure webhooks for partners.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
const crypto = require('crypto');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Valid webhook event types
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

      const { data: webhooks, error } = await supabase
        .from('webhook_configurations')
        .select('*')
        .eq('partner_id', auth.partner_id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching webhooks:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch webhooks',
          },
          500
        );
      }

      return createJsonResponse({ webhooks: webhooks || [] });
    } catch (error) {
      console.error('Webhooks GET error:', error);
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
      const { url, events, secret } = body;

      // Validate required fields
      if (!url || !events || !Array.isArray(events)) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'url and events array are required',
          },
          400
        );
      }

      // Validate event types
      const invalidEvents = events.filter((e: string) => !VALID_EVENT_TYPES.includes(e));
      if (invalidEvents.length > 0) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: `Invalid event types: ${invalidEvents.join(', ')}`,
            details: { valid_events: VALID_EVENT_TYPES },
          },
          400
        );
      }

      // Generate secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

      // Create or update webhook configuration
      const { data: webhook, error } = await supabase
        .from('webhook_configurations')
        .upsert({
          partner_id: auth.partner_id,
          url,
          secret: webhookSecret,
          events,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating webhook:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create webhook',
            details: error.message,
          },
          500
        );
      }

      return createJsonResponse(
        {
          webhook: {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            secret: webhookSecret, // Return secret only on creation
            is_active: webhook.is_active,
            created_at: webhook.created_at,
          },
          warning: 'Store the webhook secret securely. It will not be shown again.',
        },
        201
      );
    } catch (error: any) {
      console.error('Webhooks POST error:', error);
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
