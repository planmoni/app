/**
 * API Authentication Middleware
 * 
 * Middleware for API routes to handle authentication and
 * inject organization context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationFromRequest, ApiAuthResult } from '@/lib/api-auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { createErrorResponse, ERROR_CODES } from '@/lib/api-errors';

export interface AuthenticatedRequest extends Request {
  partner_id?: string;
  user_id?: string;
  partner?: any;
  user?: any;
}

/**
 * Middleware to verify API authentication and rate limiting
 */
export async function withAuth(
  request: Request,
  handler: (req: AuthenticatedRequest, auth: ApiAuthResult) => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;

  // Authenticate request
  const authResult = await getOrganizationFromRequest(request);

  if (!authResult.success) {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED',
        message: authResult.error || 'Authentication required',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check rate limit if partner context exists
  if (authResult.partner_id) {
    const rateLimit = await rateLimiter.checkLimit(authResult.partner_id, 'hour');

    if (!rateLimit.allowed) {
      return createErrorResponse(
        {
          error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded',
          details: {
            current: rateLimit.current,
            limit: rateLimit.limit,
            reset_at: rateLimit.reset_at,
          },
        },
        429
      );
    }

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(rateLimit.reset_at).getTime().toString());
  }

  // Create authenticated request with context
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.partner_id = authResult.partner_id;
  authenticatedRequest.user_id = authResult.user_id;
  authenticatedRequest.partner = authResult.partner;
  authenticatedRequest.user = authResult.user;

  // Execute handler
  const response = await handler(authenticatedRequest, authResult);

  // Log API usage
  if (authResult.partner_id) {
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || undefined;

    // Log asynchronously (don't await)
    rateLimiter.logUsage(
      authResult.partner_id,
      endpoint,
      method,
      statusCode,
      responseTime,
      undefined, // request size
      undefined, // response size
      userAgent,
      ipAddress
    ).catch(err => console.error('Failed to log usage:', err));
  }

  return response;
}
