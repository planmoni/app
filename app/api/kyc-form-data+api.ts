import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);



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

// Get KYC form data
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get KYC data for the user
    const { data: formData, error } = await supabase
      .from('kyc_data')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching KYC data:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch KYC data',
        details: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If no data exists, return empty object
    const kycData = formData || {};

    return Response.json({
      status: 'success',
      formData: kycData
    });
  } catch (error) {
    console.error('Error in GET KYC form data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error while fetching KYC form data',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Update KYC form data
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get update data from request body
    const updateData = await request.json();
    
    // Map the fields to match your kyc_data table structure
    const fieldMapping: Record<string, string> = {
      'first_name': 'first_name',
      'last_name': 'last_name',
      'middle_name': 'middle_name',
      'date_of_birth': 'date_of_birth',
      'phone_number': 'phone_number',
      'address': 'address',
      'address_lat': 'address_lat',
      'address_lon': 'address_lon',
      'address_place_id': 'address_place_id',
      'bvn': 'bvn',
      'nin': 'nin',
      'document_type': 'document_type',
      'document_number': 'document_number',
      'document_front_url': 'document_front_url',
      'document_back_url': 'document_back_url',
      'selfie_url': 'selfie_url',
      'lga': 'lga',
      'state': 'state'
    };

    // Filter and map the data to match your table structure
    const filteredData: any = {};
    Object.keys(updateData).forEach(key => {
      if (fieldMapping[key]) {
        filteredData[fieldMapping[key]] = updateData[key];
      }
    });

    // Add user_id and created_at/updated_at
    filteredData.user_id = user.id;
    filteredData.created_at = new Date().toISOString();
    filteredData.updated_at = new Date().toISOString();

    // First, check if a record exists for this user
    const { data: existingData, error: checkError } = await supabase
      .from('kyc_data')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    
    if (checkError && checkError.code === 'PGRST116') {
      // No record exists, create a new one
      console.log('Creating new KYC data record for user:', user.id);
      const { data: formData, error } = await supabase
        .from('kyc_data')
        .insert(filteredData)
        .select()
        .single();

      if (error) {
        console.error('Error creating KYC data:', error);
        return new Response(JSON.stringify({
          error: 'Failed to create KYC data',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      result = formData;
    } else if (checkError) {
      // Some other error occurred
      console.error('Error checking existing KYC data:', checkError);
      return new Response(JSON.stringify({
        error: 'Failed to check existing KYC data',
        details: checkError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Record exists, update it
      console.log('Updating existing KYC data record for user:', user.id);
      const { data: formData, error } = await supabase
        .from('kyc_data')
        .update(filteredData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating KYC data:', error);
        return new Response(JSON.stringify({
          error: 'Failed to update KYC data',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      result = formData;
    }

    return Response.json({
      status: 'success',
      message: 'KYC data saved successfully',
      formData: result
    });
  } catch (error) {
    console.error('Error in POST KYC form data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: 'Internal server error while saving KYC form data',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 