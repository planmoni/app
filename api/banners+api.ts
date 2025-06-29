import { createClient } from '@supabase/supabase-js';

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// GET endpoint to fetch banner images from storage
export async function GET(request: Request) {
  try {
    console.log('[Banners API] Fetching banner images from storage');
    
    // Initialize Supabase client with environment variables
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Banners API] Missing Supabase environment variables');
      return createJsonResponse({ 
        error: 'Server configuration error',
        details: 'Missing required environment variables'
      }, 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // List files from the banners storage bucket
    const { data: files, error: listError } = await supabase.storage
      .from('banners')
      .list('', {
        limit: limit,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (listError) {
      console.error('[Banners API] Error listing banner files:', listError);
      return createJsonResponse({ 
        error: 'Failed to fetch banner images',
        details: listError.message
      }, 500);
    }
    
    if (!files || files.length === 0) {
      console.log('[Banners API] No banner files found');
      return createJsonResponse({
        success: true,
        banners: []
      });
    }
    
    // Generate public URLs for each banner image
    const banners = files
      .filter(file => {
        // Filter for image files only
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
        return isImage && file.name !== '.emptyFolderPlaceholder';
      })
      .map((file, index) => {
        const { data: urlData } = supabase.storage
          .from('banners')
          .getPublicUrl(file.name);
        
        return {
          id: file.id || `banner-${index}`,
          title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '), // Remove extension and format name
          description: null,
          image_url: urlData.publicUrl,
          cta_text: null,
          link_url: null,
          order_index: index,
          is_active: true,
          created_at: file.created_at,
          updated_at: file.updated_at
        };
      });
    
    console.log(`[Banners API] Successfully fetched ${banners.length} banner images`);
    
    return createJsonResponse({
      success: true,
      banners: banners
    });
  } catch (error) {
    console.error('[Banners API] Unexpected error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}