import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack API endpoint for tokenizing cards
const PAYSTACK_API_URL = 'https://api.paystack.co/charge';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Verify user authentication
async function verifyAuth(request: Request) {
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
}

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

    // Check if Paystack secret key is available
    if (!PAYSTACK_SECRET_KEY) {
      console.error('Paystack API key not configured');
      return new Response(JSON.stringify({ error: 'Payment service not properly configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get card details from request body
    const requestBody = await request.json();
    console.log('Received card tokenization request:', {
      email: user.email,
      card_number_length: requestBody.card_number ? requestBody.card_number.length : 0,
      has_cvv: !!requestBody.cvv,
      has_expiry: !!requestBody.expiry_month && !!requestBody.expiry_year
    });
    
    const { 
      card_number, 
      cvv, 
      expiry_month, 
      expiry_year, 
      email = user.email 
    } = requestBody;

    // Validate required fields
    if (!card_number || !cvv || !expiry_month || !expiry_year) {
      return new Response(JSON.stringify({ error: 'Missing required card details' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For demo purposes, we'll simulate a successful response
    // In a real app, this would make an actual API call to Paystack
    console.log('Simulating Paystack API call for card tokenization');
    
    // Simulate successful response
    return Response.json({
      status: 'success',
      message: 'Card tokenized successfully',
      card: {
        last_four: card_number.slice(-4),
        exp_month: expiry_month,
        exp_year: expiry_year,
        card_type: card_number.startsWith('4') ? 'visa' : 
                  card_number.startsWith('5') ? 'mastercard' : 
                  card_number.startsWith('6') ? 'verve' : 'unknown',
        bank: 'Demo Bank'
      }
    });
    
    /* In a real implementation, you would make an actual API call:
    
    // Make request to Paystack API
    const response = await fetch(PAYSTACK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        card: {
          number: card_number.replace(/\s/g, ''),
          cvv,
          expiry_month,
          expiry_year
        }
      })
    });

    const data = await response.json();

    // Check if the request was successful
    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: data.message || 'Failed to tokenize card' 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If the charge requires additional action (like OTP)
    if (data.data.status === 'send_otp' || data.data.status === 'send_phone') {
      return Response.json({
        status: 'requires_action',
        action: data.data.status,
        reference: data.data.reference
      });
    }

    // If the charge was successful
    if (data.data.status === 'success') {
      // Store the card token in the database
      const { error: dbError } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          type: 'card',
          provider: 'paystack',
          token: data.data.authorization.authorization_code,
          last_four: data.data.authorization.last4,
          exp_month: data.data.authorization.exp_month,
          exp_year: data.data.authorization.exp_year,
          card_type: data.data.authorization.card_type,
          bank: data.data.authorization.bank,
          is_default: false
        });

      if (dbError) {
        console.error('Error storing card token:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to save card information' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return Response.json({
        status: 'success',
        message: 'Card tokenized successfully',
        card: {
          last_four: data.data.authorization.last4,
          exp_month: data.data.authorization.exp_month,
          exp_year: data.data.authorization.exp_year,
          card_type: data.data.authorization.card_type,
          bank: data.data.authorization.bank
        }
      });
    }

    // For any other status
    return Response.json({
      status: data.data.status,
      reference: data.data.reference,
      message: data.message
    });
    */
    
  } catch (error) {
    console.error('Error tokenizing card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error during card processing',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle OTP submission
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if Paystack secret key is available
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Paystack API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get OTP and reference from request body
    const { otp, reference } = await request.json();

    if (!otp || !reference) {
      return new Response(JSON.stringify({ error: 'OTP and reference are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For demo purposes, simulate a successful response
    console.log('Simulating OTP verification for reference:', reference);
    
    return Response.json({
      status: 'success',
      message: 'OTP verified successfully',
      card: {
        last_four: '4242',
        exp_month: '12',
        exp_year: '25',
        card_type: 'visa',
        bank: 'Demo Bank'
      }
    });
    
    /* In a real implementation:
    
    // Submit OTP to Paystack
    const response = await fetch(`https://api.paystack.co/charge/submit_otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        otp,
        reference
      })
    });

    const data = await response.json();

    // Check if the request was successful
    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: data.message || 'Failed to verify OTP' 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If the charge was successful
    if (data.data.status === 'success') {
      // Store the card token in the database
      const { error: dbError } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          type: 'card',
          provider: 'paystack',
          token: data.data.authorization.authorization_code,
          last_four: data.data.authorization.last4,
          exp_month: data.data.authorization.exp_month,
          exp_year: data.data.authorization.exp_year,
          card_type: data.data.authorization.card_type,
          bank: data.data.authorization.bank,
          is_default: false
        });

      if (dbError) {
        console.error('Error storing card token:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to save card information' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return Response.json({
        status: 'success',
        message: 'Card tokenized successfully',
        card: {
          last_four: data.data.authorization.last4,
          exp_month: data.data.authorization.exp_month,
          exp_year: data.data.authorization.exp_year,
          card_type: data.data.authorization.card_type,
          bank: data.data.authorization.bank
        }
      });
    }

    // For any other status
    return Response.json({
      status: data.data.status,
      reference: data.data.reference,
      message: data.message
    });
    */
  } catch (error) {
    console.error('Error processing OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error during OTP verification',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}