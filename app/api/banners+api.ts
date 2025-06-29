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

// GET endpoint to fetch banners
export async function GET(request: Request) {
  try {
    console.log('[Banners API] Fetching banners');
    
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
      console.error('[Banners API] Error fetching banners:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch banners',
        details: error.message
      }, 500);
    }
    
    console.log(`[Banners API] Successfully fetched ${data?.length || 0} banners`);
    
    return createJsonResponse({
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

// POST endpoint to create a new banner
export async function POST(request: Request) {
  try {
    // Verify authentication (admin only)
    // This would typically check for admin role
    
    // Get banner data from request body
    const bannerData = await request.json();
    
    // Insert banner into database
    const { data, error } = await supabase
      .from('banners')
      .insert(bannerData)
      .select()
      .single();
    
    if (error) {
      console.error('[Banners API] Error creating banner:', error);
      return createJsonResponse({ 
        error: 'Failed to create banner',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      banner: data
    });
  } catch (error) {
    console.error('[Banners API] Error creating banner:', error);
    return createJsonResponse({ 
      error: 'Failed to create banner',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// PUT endpoint to update a banner
export async function PUT(request: Request) {
  try {
    // Get banner ID and data from request
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return createJsonResponse({ error: 'Banner ID is required' }, 400);
    }
    
    const bannerData = await request.json();
    
    // Update banner in database
    const { data, error } = await supabase
      .from('banners')
      .update(bannerData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[Banners API] Error updating banner:', error);
      return createJsonResponse({ 
        error: 'Failed to update banner',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      banner: data
    });
  } catch (error) {
    console.error('[Banners API] Error updating banner:', error);
    return createJsonResponse({ 
      error: 'Failed to update banner',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// DELETE endpoint to delete a banner
export async function DELETE(request: Request) {
  try {
    // Get banner ID from request
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return createJsonResponse({ error: 'Banner ID is required' }, 400);
    }
    
    // Delete banner from database
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[Banners API] Error deleting banner:', error);
      return createJsonResponse({ 
        error: 'Failed to delete banner',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('[Banners API] Error deleting banner:', error);
    return createJsonResponse({ 
      error: 'Failed to delete banner',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}