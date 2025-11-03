import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return Response.json({ success: false, error: 'Invalid token format' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('Auth error:', authError.message);
      return Response.json({ 
        success: false, 
        error: authError.message || 'Authentication failed' 
      }, { status: 401 });
    }

    if (!user) {
      return Response.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const { data: sessions, error } = await supabase
      .from('login_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('login_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching login sessions:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, sessions: sessions || [] });
  } catch (error) {
    console.error('Error in GET /api/login-sessions:', error);
    return Response.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ success: false, error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, isSuspicious } = body;

    if (!sessionId) {
      return Response.json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('login_sessions')
      .update({ is_suspicious: isSuspicious })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, session: data });
  } catch (error) {
    console.error('Error in POST /api/login-sessions:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ success: false, error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const deleteAll = url.searchParams.get('deleteAll');

    if (deleteAll === 'true') {
      const { error } = await supabase
        .from('login_sessions')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting all sessions:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }

      return Response.json({ success: true, message: 'All sessions deleted' });
    }

    if (!sessionId) {
      return Response.json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('login_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting session:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error in DELETE /api/login-sessions:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
