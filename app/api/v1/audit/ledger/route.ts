/**
 * Audit Ledger API
 * 
 * Query the immutable audit ledger for money movements.
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
      const walletId = url.searchParams.get('wallet_id');
      const fromDate = url.searchParams.get('from_date');
      const toDate = url.searchParams.get('to_date');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const format = url.searchParams.get('format') || 'json'; // json or csv

      if (!walletId) {
        return createErrorResponse(
          {
            error: ERROR_CODES.VALIDATION_ERROR,
            message: 'wallet_id is required',
          },
          400
        );
      }

      // Verify wallet access
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .single();

      if (!wallet) {
        return createErrorResponse(
          {
            error: ERROR_CODES.NOT_FOUND,
            message: 'Wallet not found',
          },
          404
        );
      }

      // Check access
      if (auth.partner_id && wallet.partner_id !== auth.partner_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      if (auth.user_id && wallet.user_id !== auth.user_id) {
        return createErrorResponse(
          {
            error: ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
          },
          403
        );
      }

      // Get ledger history using function
      const { data: ledgerData, error } = await supabase.rpc('get_ledger_history', {
        p_wallet_id: walletId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('Error fetching ledger:', error);
        return createErrorResponse(
          {
            error: ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to fetch ledger',
          },
          500
        );
      }

      // If CSV format requested
      if (format === 'csv') {
        const entries = ledgerData?.entries || [];
        const csvHeader = 'Entry Number,Type,Amount,Balance Before,Balance After,Currency,Created At\n';
        const csvRows = entries.map((entry: any) =>
          `${entry.entry_number},${entry.entry_type},${entry.amount || ''},${entry.balance_before},${entry.balance_after},${entry.currency},${entry.created_at}`
        ).join('\n');
        
        return new Response(csvHeader + csvRows, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="ledger-${walletId}-${Date.now()}.csv"`,
          },
        });
      }

      return createJsonResponse(ledgerData);
    } catch (error) {
      console.error('Ledger GET error:', error);
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
