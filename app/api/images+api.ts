import { supabase } from '@/lib/supabase';

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET endpoint to fetch images
export async function GET(request: Request) {
  try {
    console.log('[Images API] Fetching images');
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');
    
    // Fetch active banners from the database
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('[Images API] Error fetching images:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch images',
        details: error.message
      }, 500);
    }
    
    console.log(`[Images API] Successfully fetched ${data?.length || 0} images`);
    
    return createJsonResponse({ 
      success: true,
      images: data || []
    });
  } catch (error) {
    console.error('[Images API] Unexpected error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}