/**
 * Test Webhook API
 * 
 * Send a test webhook to verify configuration.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(
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

      // Get webhook configuration
      const { data: webhook, error: webhookError } = await supabase
        .from('webhook_configurations')
        .select('*')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (webhookError || !webhook) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Webhook not found',
          },
          404
        );
      }

      // Create test webhook delivery
      const testEventData = {
        test: true,
        message: 'This is a test webhook from Planmoni',
        timestamp: new Date().toISOString(),
      };

      const { data: delivery, error: deliveryError } = await supabase
        .from('webhook_deliveries')
        .insert({
          partner_id: auth.partner_id,
          webhook_config_id: webhook.id,
          event_type: 'wallet.created', // Test event
          event_data: testEventData,
          status: 'pending',
          next_retry_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (deliveryError) {
        console.error('Error creating test delivery:', deliveryError);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create test webhook',
          },
          500
        );
      }

      // Trigger webhook delivery (would normally be done by cron)
      // For test, we'll trigger it immediately
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/deliver-webhook`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        return createJsonResponse({
          message: 'Test webhook sent',
          delivery_id: delivery.id,
          delivery_status: result,
        });
      } catch (error: any) {
        return createJsonResponse({
          message: 'Test webhook queued for delivery',
          delivery_id: delivery.id,
          note: 'Webhook will be delivered by the delivery service',
        });
      }
    } catch (error: any) {
      console.error('Test webhook error:', error);
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
