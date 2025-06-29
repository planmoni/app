import { supabase } from '@/lib/supabase';

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET endpoint to fetch active banners
export async function GET(request: Request) {
  try {
    console.log('[Banners API] Fetching active banners');
    
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
      console.error('[Banners API] Error fetching banners:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch banners',
        details: error.message
      }, 500);
    }
    
    console.log(`[Banners API] Successfully fetched ${data?.length || 0} banners`);
    
    return createJsonResponse({ 
      success: true,
      banners: data || []
    });
  } catch (error) {
    console.error('[Banners API] Unexpected error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}