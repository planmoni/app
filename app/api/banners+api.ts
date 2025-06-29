import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: Request) {
  try {
    // Fetch active banners from the database, ordered by order_index
    const { data: banners, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching banners:', error);
      return Response.json(
        { 
          success: false, 
          error: 'Failed to fetch banners',
          details: error.message 
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      banners: banners || []
    });

  } catch (error) {
    console.error('Unexpected error fetching banners:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}