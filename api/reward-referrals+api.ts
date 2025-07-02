import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request: Request) {
  // Only allow service role or admin
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createJsonResponse({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.split(' ')[1];
  if (token !== supabaseServiceRoleKey) {
    return createJsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { referrer_id } = await request.json();
  if (!referrer_id) return createJsonResponse({ error: 'Missing referrer_id' }, 400);

  // Get all referrals for this referrer
  const { data: referrals, error: refErr } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', referrer_id)
    .in('status', ['pending', 'qualified']);
  if (refErr) return createJsonResponse({ error: refErr.message }, 500);

  let rewardsGiven = 0;
  for (const referral of referrals || []) {
    // Get total deposits for referred user
    const { data: deposits, error: depErr } = await supabase
      .from('deposits')
      .select('amount')
      .eq('user_id', referral.referred_id)
      .eq('status', 'completed');
    if (depErr) return createJsonResponse({ error: depErr.message }, 500);
    const totalDeposits = (deposits || []).reduce((sum, d) => sum + Number(d.amount), 0);
    if (totalDeposits >= 100000 && referral.status !== 'rewarded') {
      const rewardAmount = 1000;
      // Credit referrer's wallet
      await supabase.rpc('increment_wallet_balance', {
        user_id: referral.referrer_id,
        amount: rewardAmount
      });
      // Log transaction
      await supabase.from('transactions').insert({
        user_id: referral.referrer_id,
        type: 'reward',
        amount: rewardAmount,
        status: 'completed'
      });
      // Update referral status
      await supabase.from('referrals').update({ status: 'rewarded' }).eq('id', referral.id);
      rewardsGiven++;
    } else if (totalDeposits > 0 && referral.status === 'pending') {
      await supabase.from('referrals').update({ status: 'qualified' }).eq('id', referral.id);
    }
  }
  return createJsonResponse({ rewardsGiven });
} 