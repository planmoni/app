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
      .order('order_index', { ascending: true }) // optional
      .limit(limit);

    if (error) {
      console.error('[Images API] Error fetching images:', error.message);
      return createJsonResponse({
        success: false,
        error: 'Failed to fetch banners',
        details: error.message,
      }, 500);
    }

    // No need to generate public URLs — already in `image_url`
    return createJsonResponse({
      success: true,
      banners: data || [],
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
