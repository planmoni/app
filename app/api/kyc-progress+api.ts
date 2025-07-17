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

// Get KYC progress
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get KYC progress for the user
    const { data: progress, error } = await supabase
      .from('kyc_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching KYC progress:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch KYC progress',
        details: error.message
      }, 500);
    }

    // If no progress exists, create a default one
    let kycProgress;
    if (error && error.code === 'PGRST116') {
      console.log('No KYC progress found, creating default for user:', user.id);
      
      const defaultProgress = {
        user_id: user.id,
        current_step: 'personal',
        personal_info_completed: false,
        bvn_verified: false,
        documents_verified: false,
        address_completed: false,
        overall_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newProgress, error: createError } = await supabase
        .from('kyc_progress')
        .insert(defaultProgress)
        .select()
        .single();

      if (createError) {
        console.error('Error creating default KYC progress:', createError);
        return createJsonResponse({ 
          error: 'Failed to create default KYC progress',
          details: createError.message
        }, 500);
      }

      kycProgress = newProgress;
    } else {
      kycProgress = progress;
    }

    // Calculate step progress
    const stepProgress = {
      personal: kycProgress.personal_info_completed ? 1 : 0,
      bvn_verification: kycProgress.bvn_verified ? 1 : 0,
      id_face_match: kycProgress.documents_verified ? 1 : 0,
      address_details: kycProgress.address_completed ? 1 : 0,
      review: kycProgress.overall_completed ? 1 : 0
    };

    const totalSteps = 4; // personal, bvn_verification, id_face_match, address_details
    const completedSteps = Object.values(stepProgress).reduce((sum, step) => sum + step, 0);
    const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

    return createJsonResponse({
      status: 'success',
      progress: {
        ...kycProgress,
        stepProgress,
        progressPercentage,
        totalSteps,
        completedSteps
      }
    });
  } catch (error) {
    console.error('Error in GET KYC progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while fetching KYC progress',
      details: errorMessage
    }, 500);
  }
}

// Update KYC progress
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get update data from request body
    const updateData = await request.json();
    const { 
      currentStep, 
      personalInfoCompleted, 
      bvnVerified, 
      documentsVerified, 
      addressCompleted, 
      overallCompleted 
    } = updateData;

    // Validate current step
    const validSteps = ['personal', 'bvn_verification', 'id_face_match', 'address_details', 'review'];
    if (currentStep && !validSteps.includes(currentStep)) {
      return createJsonResponse({ error: 'Invalid current step' }, 400);
    }

    // Prepare update object
    const updateObject: any = {};
    if (currentStep !== undefined) updateObject.current_step = currentStep;
    if (personalInfoCompleted !== undefined) updateObject.personal_info_completed = personalInfoCompleted;
    if (bvnVerified !== undefined) updateObject.bvn_verified = bvnVerified;
    if (documentsVerified !== undefined) updateObject.documents_verified = documentsVerified;
    if (addressCompleted !== undefined) updateObject.address_completed = addressCompleted;
    if (overallCompleted !== undefined) updateObject.overall_completed = overallCompleted;

    // Add user_id and timestamps
    updateObject.user_id = user.id;
    updateObject.created_at = new Date().toISOString();
    updateObject.updated_at = new Date().toISOString();

    // First, check if a record exists for this user
    const { data: existingData, error: checkError } = await supabase
      .from('kyc_progress')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    
    if (checkError && checkError.code === 'PGRST116') {
      // No record exists, create a new one
      console.log('Creating new KYC progress record for user:', user.id);
      const { data: progress, error } = await supabase
        .from('kyc_progress')
        .insert(updateObject)
        .select()
        .single();

      if (error) {
        console.error('Error creating KYC progress:', error);
        return createJsonResponse({ 
          error: 'Failed to create KYC progress',
          details: error.message
        }, 500);
      }
      
      result = progress;
    } else if (checkError) {
      // Some other error occurred
      console.error('Error checking existing KYC progress:', checkError);
      return createJsonResponse({ 
        error: 'Failed to check existing KYC progress',
        details: checkError.message
      }, 500);
    } else {
      // Record exists, update it
      console.log('Updating existing KYC progress record for user:', user.id);
      const { data: progress, error } = await supabase
        .from('kyc_progress')
        .update(updateObject)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating KYC progress:', error);
        return createJsonResponse({ 
          error: 'Failed to update KYC progress',
          details: error.message
        }, 500);
      }
      
      result = progress;
    }

    return createJsonResponse({
      status: 'success',
      message: 'KYC progress saved successfully',
      progress: result
    });
  } catch (error) {
    console.error('Error in POST KYC progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while saving KYC progress',
      details: errorMessage
    }, 500);
  }
} 