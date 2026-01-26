/**
 * API Error Utilities
 * 
 * Standardized error responses for Planmoni Platform API.
 */

export interface ApiError {
  error: string;
  message: string;
  details?: any;
  code?: string;
}

export function createApiError(
  code: string,
  message: string,
  details?: any
): ApiError {
  return {
    error: code,
    message,
    details,
    code,
  };
}

export function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createErrorResponse(error: ApiError, status: number = 400) {
  return createJsonResponse(error, status);
}

// Standard error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
