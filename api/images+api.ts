import { supabase } from '@/lib/supabase';

function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(request: Request) {
  try {
    console.log('[Images API] Fetching banners');

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Images API] Error fetching images:', error.message);
      return createJsonResponse({
        success: false,
        error: 'Failed to fetch banners',
        details: error.message,
      }, 500);
    }

    console.log(`[Images API] Successfully fetched ${data?.length || 0} banners`);
    
    return createJsonResponse({
      success: true,
      images: data || [],
    });
  } catch (error) {
    console.error('[Images API] Unexpected error:', error);
    return createJsonResponse({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}