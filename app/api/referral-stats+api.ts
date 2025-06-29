import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify user authentication
async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Get referral statistics for the current user
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Get user's referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      return createJsonResponse({ 
        error: 'Failed to retrieve user profile',
        details: profileError.message
      }, 500);
    }
    
    const referralCode = profile.referral_code;
    
    // If no referral code, return zeros
    if (!referralCode) {
      return createJsonResponse({
        referralCode: null,
        invitedCount: 0,
        totalEarned: 0
      });
    }
    
    // Count users referred by this user
    const { count: invitedCount, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', user.id);
    
    if (countError) {
      return createJsonResponse({ 
        error: 'Failed to count referred users',
        details: countError.message
      }, 500);
    }
    
    // Sum referral bonuses earned
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'referral_bonus')
      .eq('status', 'completed');
    
    if (transactionsError) {
      return createJsonResponse({ 
        error: 'Failed to retrieve referral transactions',
        details: transactionsError.message
      }, 500);
    }
    
    const totalEarned = transactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return createJsonResponse({
      referralCode,
      invitedCount: invitedCount || 0,
      totalEarned
    });
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    return createJsonResponse({ 
      error: 'Failed to fetch referral statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}