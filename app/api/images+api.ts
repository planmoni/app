import { supabase } from '@/lib/supabase';

// Utility to create JSON responses
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET endpoint to fetch banners with proper public image URLs
export async function GET(request: Request) {
  try {
    console.log('[Images API] Fetching banners...');

    // Parse limit from query string, default to 5
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);

    // Fetch banners from Supabase
    const { data: banners, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Images API] Supabase error:', error.message);
      return createJsonResponse({
        success: false,
        error: 'Failed to fetch banners',
        details: error.message,
      }, 500);
    }

    // Attach public image URLs from Supabase Storage
    const bannersWithUrls = banners.map((banner) => {
      const { data: publicUrlData } = supabase
        .storage
        .from('banners') // Replace with your actual bucket name
        .getPublicUrl(banner.image_url); // banner.image_url is the file path

      return {
        ...banner,
        image_url: publicUrlData?.publicUrl || '',
      };
    });

    console.log(`[Images API] Returned ${bannersWithUrls.length} banner(s)`);

    return createJsonResponse({
      success: true,
      banners: bannersWithUrls,
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
