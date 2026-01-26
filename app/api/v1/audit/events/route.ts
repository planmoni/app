/**
 * Audit Events API
 * 
 * Query audit events (policy changes, approvals, etc.).
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      const url = new URL(request.url);
      const partnerId = url.searchParams.get('partner_id');
      const walletId = url.searchParams.get('wallet_id');
      const eventType = url.searchParams.get('event_type');
      const fromDate = url.searchParams.get('from_date');
      const toDate = url.searchParams.get('to_date');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by partner
      if (partnerId) {
        if (auth.partner_id && auth.partner_id !== partnerId) {
          return createErrorResponse(
            {
              error: ERROR_CODES.FORBIDDEN,
              message: 'Access denied',
            },
            403
          );
        }
        query = query.eq('partner_id', partnerId);
      } else if (auth.partner_id) {
        query = query.eq('partner_id', auth.partner_id);
      }

      // Filter by wallet
      if (walletId) {
        query = query.eq('wallet_id', walletId);
      }

      // Filter by event type
      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      // Filter by date range
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate);
      }

      const { data: events, error, count } = await query;

      if (error) {
        console.error('Error fetching audit events:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch audit events',
          },
          500
        );
      }

      return createJsonResponse({
        events: events || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Audit Events GET error:', error);
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
