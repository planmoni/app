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

// GET endpoint to fetch active banners
export async function GET(request: Request) {
  try {
    console.log('Fetching banners from Supabase');
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // Fetch active banners from the database
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching banners:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch banners',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({ 
      success: true,
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

// POST endpoint to create a new banner (admin only)
export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData?.user) {
      return createJsonResponse({ error: 'Invalid authentication token' }, 401);
    }
    
    // Check if user is admin (you'll need to implement this function in your database)
    const { data: isAdminData, error: isAdminError } = await supabase.rpc('is_admin');
    
    if (isAdminError || !isAdminData) {
      return createJsonResponse({ error: 'Forbidden - Admin access required' }, 403);
    }
    
    // Get banner data from request body
    const bannerData = await request.json();
    
    // Validate required fields
    if (!bannerData.title || !bannerData.image_url) {
      return createJsonResponse({ error: 'Title and image URL are required' }, 400);
    }
    
    // Insert new banner
    const { data, error } = await supabase
      .from('banners')
      .insert({
        title: bannerData.title,
        description: bannerData.description,
        image_url: bannerData.image_url,
        cta_text: bannerData.cta_text,
        link_url: bannerData.link_url,
        order_index: bannerData.order_index || 0,
        is_active: bannerData.is_active !== undefined ? bannerData.is_active : true
      })
      .select()
      .single();
    
    if (error) {
      return createJsonResponse({ 
        error: 'Failed to create banner',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({ 
      success: true,
      banner: data
    }, 201);
  } catch (error) {
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}