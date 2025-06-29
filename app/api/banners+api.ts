import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET endpoint to fetch banners
export async function GET(request: Request) {
  try {
    console.log('Fetching banners from Supabase');
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const onlyActive = url.searchParams.get('active') === 'true';
    
    // Build query
    let query = supabase
      .from('banners')
      .select('*')
      .order('order_index', { ascending: true })
      .limit(limit);
    
    // Add filter for active banners if requested
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching banners:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch banners',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      banners: data || []
    });
  } catch (error) {
    console.error('Error in banners API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}