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

    // Get or create KYC progress for the user
    const { data: progress, error } = await supabase
      .rpc('get_or_create_kyc_progress', { user_uuid: user.id });

    if (error) {
      console.error('Error fetching KYC progress:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch KYC progress',
        details: error.message
      }, 500);
    }

    // Calculate step progress
    const stepProgress = {
      personal: progress.personal_info_completed ? 1 : 0,
      bvn_verification: progress.bvn_verified ? 1 : 0,
      id_face_match: progress.documents_verified ? 1 : 0,
      address_details: progress.address_completed ? 1 : 0,
      review: progress.overall_completed ? 1 : 0
    };

    const totalSteps = 4; // personal, bvn_verification, id_face_match, address_details
    const completedSteps = Object.values(stepProgress).reduce((sum, step) => sum + step, 0);
    const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

    return createJsonResponse({
      status: 'success',
      progress: {
        ...progress,
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

    // Update KYC progress
    const { data: progress, error } = await supabase
      .from('kyc_progress')
      .upsert({
        user_id: user.id,
        ...updateObject
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating KYC progress:', error);
      return createJsonResponse({ 
        error: 'Failed to update KYC progress',
        details: error.message
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: 'KYC progress updated successfully',
      progress
    });
  } catch (error) {
    console.error('Error in POST KYC progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while updating KYC progress',
      details: errorMessage
    }, 500);
  }
} 