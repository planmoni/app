import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Initialize Supabase client
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify user authentication
async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// GET endpoint to fetch banners
export async function GET(request: Request) {
  try {
    console.log('Fetching banners...');
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5');
    const activeOnly = url.searchParams.get('active') !== 'false';
    
    // Fetch banners from Supabase
    let query = supabase
      .from('banners')
      .select('*')
      .order('order_index', { ascending: true });
    
    // Filter by active status if needed
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    // Apply limit
    if (limit > 0) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching banners:', error);
      return createJsonResponse({ error: 'Failed to fetch banners' }, 500);
    }
    
    return createJsonResponse({ banners: data || [] });
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
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || !profile.is_admin) {
      return createJsonResponse({ error: 'Forbidden: Admin access required' }, 403);
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
        description: bannerData.description || null,
        image_url: bannerData.image_url,
        cta_text: bannerData.cta_text || null,
        link_url: bannerData.link_url || null,
        order_index: bannerData.order_index || 0,
        is_active: bannerData.is_active !== undefined ? bannerData.is_active : true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating banner:', error);
      return createJsonResponse({ error: 'Failed to create banner' }, 500);
    }
    
    return createJsonResponse({ banner: data }, 201);
  } catch (error) {
    console.error('Error in banners API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// PUT endpoint to update a banner (admin only)
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || !profile.is_admin) {
      return createJsonResponse({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Get banner data from request body
    const { id, ...bannerData } = await request.json();
    
    if (!id) {
      return createJsonResponse({ error: 'Banner ID is required' }, 400);
    }
    
    // Update banner
    const { data, error } = await supabase
      .from('banners')
      .update(bannerData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating banner:', error);
      return createJsonResponse({ error: 'Failed to update banner' }, 500);
    }
    
    return createJsonResponse({ banner: data });
  } catch (error) {
    console.error('Error in banners API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// DELETE endpoint to delete a banner (admin only)
export async function DELETE(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || !profile.is_admin) {
      return createJsonResponse({ error: 'Forbidden: Admin access required' }, 403);
    }
    
    // Get banner ID from URL
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return createJsonResponse({ error: 'Banner ID is required' }, 400);
    }
    
    // Delete banner
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting banner:', error);
      return createJsonResponse({ error: 'Failed to delete banner' }, 500);
    }
    
    return createJsonResponse({ success: true });
  } catch (error) {
    console.error('Error in banners API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}