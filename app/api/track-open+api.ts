import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get('campaign');
    const userToken = url.searchParams.get('user');

    if (campaignId && userToken) {
      const { data: tokenData } = await supabase
        .from('email_unsubscribe_tokens')
        .select('user_id')
        .eq('token', userToken)
        .single();

      if (tokenData) {
        await supabase
          .from('email_campaign_recipients')
          .update({
            opened_at: new Date().toISOString()
          })
          .eq('campaign_id', campaignId)
          .eq('user_id', tokenData.user_id)
          .is('opened_at', null);
      }
    }

    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error tracking email open:', error);
    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif'
      }
    });
  }
}
