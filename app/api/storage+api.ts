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

// POST endpoint to get a signed URL for uploading
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get file info from request
    const { fileName, fileType, folderPath } = await request.json();
    
    if (!fileName || !fileType) {
      return createJsonResponse({ error: 'File name and type are required' }, 400);
    }
    
    // Create a unique file path
    const timestamp = Date.now();
    const filePath = `${folderPath || 'banners'}/${timestamp}_${fileName}`;
    
    // Get a signed URL for uploading
    const { data, error } = await supabase.storage
      .from('banners')
      .createSignedUploadUrl(filePath);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return createJsonResponse({ 
        error: 'Failed to create upload URL',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      signedUrl: data.signedUrl,
      path: filePath,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/banners/${filePath}`
    });
  } catch (error) {
    console.error('Error in storage API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// GET endpoint to list files in a folder
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Get folder path from query parameters
    const url = new URL(request.url);
    const folderPath = url.searchParams.get('folder') || 'banners';
    
    // List files in the folder
    const { data, error } = await supabase.storage
      .from('banners')
      .list(folderPath);
    
    if (error) {
      console.error('Error listing files:', error);
      return createJsonResponse({ 
        error: 'Failed to list files',
        details: error.message
      }, 500);
    }
    
    // Add public URLs to each file
    const filesWithUrls = data.map(file => ({
      ...file,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/banners/${folderPath}/${file.name}`
    }));
    
    return createJsonResponse({
      success: true,
      files: filesWithUrls
    });
  } catch (error) {
    console.error('Error in storage API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// DELETE endpoint to delete a file
export async function DELETE(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Get file path from query parameters
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      return createJsonResponse({ error: 'File path is required' }, 400);
    }
    
    // Delete the file
    const { error } = await supabase.storage
      .from('banners')
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting file:', error);
      return createJsonResponse({ 
        error: 'Failed to delete file',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error in storage API:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}