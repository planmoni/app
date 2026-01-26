/**
 * Approve Request API
 * 
 * Approve an approval request.
 */

import { withAuth, AuthenticatedRequest } from '../../middleware/auth';
import { createJsonResponse, createErrorResponse, ERROR_CODES } from '@/lib/api-errors';
import { approvalEngine } from '@/lib/approval-engine';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest, auth) => {
    try {
      if (!auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.UNAUTHORIZED,
            message: 'User authentication required for approvals',
          },
          401
        );
      }

      const body = await request.json();
      const { comments } = body;

      const approvalRequest = await approvalEngine.processApproval(
        params.id,
        auth.user_id,
        'approve',
        comments
      );

      return createJsonResponse({ request: approvalRequest });
    } catch (error: any) {
      console.error('Approve POST error:', error);
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
