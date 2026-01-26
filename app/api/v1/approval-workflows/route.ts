/**
 * Approval Workflows API
 * 
 * CRUD operations for approval workflows.
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

      const { data: workflows, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('partner_id', auth.partner_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching workflows:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch workflows',
          },
          500
        );
      }

      return createJsonResponse({ workflows: workflows || [] });
    } catch (error) {
      console.error('Workflows GET error:', error);
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
      const { name, description, workflow_type, steps, auto_approve_rules } = body;

      // Validate required fields
      if (!name || !workflow_type || !steps || !Array.isArray(steps)) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'name, workflow_type, and steps array are required',
          },
          400
        );
      }

      // Create workflow
      const { data: workflow, error } = await supabase
        .from('approval_workflows')
        .insert({
          partner_id: auth.partner_id,
          name,
          description: description || null,
          workflow_type,
          steps,
          auto_approve_rules: auto_approve_rules || {},
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating workflow:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create workflow',
            details: error.message,
          },
          500
        );
      }

      return createJsonResponse({ workflow }, 201);
    } catch (error) {
      console.error('Workflows POST error:', error);
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
