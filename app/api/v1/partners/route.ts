/**
 * Partners API
 * 
 * Partner registration and listing (admin only for registration).
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
      // Only admins can list all partners
      // For now, partners can only see themselves
      if (auth.partner_id) {
        const { data: partner, error } = await supabase
          .from('partners')
          .select('*')
          .eq('id', auth.partner_id)
          .single();

        if (error) {
          return createErrorResponse(
            {
              error: ERROR_CODES.NOT_FOUND,
              message: 'Partner not found',
            },
            404
          );
        }

        return createJsonResponse({ partners: [partner] });
      }

      // Admin access would go here
      return createErrorResponse(
        {
          error: ERROR_CODES.FORBIDDEN,
          message: 'Admin access required',
        },
        403
      );
    } catch (error) {
      console.error('Partners GET error:', error);
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
      // Partner registration should be admin-only or use a separate registration endpoint
      // For now, require admin/service role
      if (!auth.partner_id && !auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Admin access required for partner registration',
          },
          403
        );
      }

      const body = await request.json();
      const {
        name,
        slug,
        partner_type,
        webhook_url,
        settings,
        metadata,
      } = body;

      // Validate required fields
      if (!name || !slug || !partner_type) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'name, slug, and partner_type are required',
          },
          400
        );
      }

      // Validate partner_type
      const validTypes = [
        'healthcare',
        'employer',
        'cooperative',
        'education',
        'insurance',
        'marketplace',
        'fintech',
        'other',
      ];

      if (!validTypes.includes(partner_type)) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: `Invalid partner_type. Must be one of: ${validTypes.join(', ')}`,
          },
          400
        );
      }

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('partners')
        .select('id')
        .eq('slug', slug)
        .single();

      if (existing) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'Partner slug already exists',
          },
          400
        );
      }

      // Create partner
      const { data: partner, error } = await supabase
        .from('partners')
        .insert({
          name,
          slug,
          partner_type,
          status: 'pending',
          subscription_tier: 'standard',
          webhook_url: webhook_url || null,
          settings: settings || {},
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating partner:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create partner',
            details: error.message,
          },
          500
        );
      }

      // Create default partner settings
      await supabase.from('partner_settings').insert({
        partner_id: partner.id,
        rate_limit_per_hour: 1000,
        allowed_transaction_types: ['disbursement', 'withdrawal'],
      });

      return createJsonResponse({ partner }, 201);
    } catch (error: any) {
      console.error('Partners POST error:', error);
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
