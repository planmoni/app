/**
 * Approval Workflow Detail API
 * 
 * Get, update, and delete individual approval workflows.
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

      const { data: workflow, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (error || !workflow) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Workflow not found',
          },
          404
        );
      }

      return createJsonResponse({ workflow });
    } catch (error) {
      console.error('Workflow GET error:', error);
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
      const { name, description, steps, auto_approve_rules, is_active } = body;

      // Verify workflow belongs to partner
      const { data: existingWorkflow } = await supabase
        .from('approval_workflows')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingWorkflow) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Workflow not found',
          },
          404
        );
      }

      // Update workflow
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (steps !== undefined) updateData.steps = steps;
      if (auto_approve_rules !== undefined) updateData.auto_approve_rules = auto_approve_rules;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: workflow, error } = await supabase
        .from('approval_workflows')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating workflow:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to update workflow',
          },
          500
        );
      }

      return createJsonResponse({ workflow });
    } catch (error) {
      console.error('Workflow PATCH error:', error);
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

      // Verify workflow belongs to partner
      const { data: existingWorkflow } = await supabase
        .from('approval_workflows')
        .select('id')
        .eq('id', params.id)
        .eq('partner_id', auth.partner_id)
        .single();

      if (!existingWorkflow) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Workflow not found',
          },
          404
        );
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('approval_workflows')
        .update({ is_active: false })
        .eq('id', params.id);

      if (error) {
        console.error('Error deleting workflow:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to delete workflow',
          },
          500
        );
      }

      return createJsonResponse({ message: 'Workflow deleted successfully' });
    } catch (error) {
      console.error('Workflow DELETE error:', error);
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
