import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TOTP implementation using Web Crypto API
class TOTPGenerator {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  // Convert base32 string to bytes
  private base32Decode(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const inputUpper = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
    
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = new Uint8Array(Math.ceil((inputUpper.length * 5) / 8));
    
    for (let i = 0; i < inputUpper.length; i++) {
      value = (value << 5) | alphabet.indexOf(inputUpper[i]);
      bits += 5;
      
      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }
    
    return output.slice(0, index);
  }

  // Generate HMAC-SHA1
  private async hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
  }

  // Generate TOTP code
  async generateTOTP(time?: number): Promise<string> {
    const timeStep = Math.floor((time || Date.now()) / 1000 / 30);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(0, Math.floor(timeStep / 0x100000000), false);
    timeView.setUint32(4, timeStep & 0xffffffff, false);
    
    const key = this.base32Decode(this.secret);
    const hmac = await this.hmacSha1(key, new Uint8Array(timeBuffer));
    
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    
    const otp = code % 1000000;
    return otp.toString().padStart(6, '0');
  }

  // Verify TOTP code with time window
  async verifyTOTP(token: string, time?: number, window: number = 1): Promise<boolean> {
    const currentTime = time || Date.now();
    
    for (let i = -window; i <= window; i++) {
      const testTime = currentTime + (i * 30 * 1000);
      const expectedToken = await this.generateTOTP(testTime);
      
      if (expectedToken === token) {
        return true;
      }
    }
    
    return false;
  }
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body safely
    let requestBody;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'Empty request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { token } = requestBody;
    
    // Verify token first
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('totp_secret')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile?.totp_secret) {
      return new Response(JSON.stringify({ error: 'TOTP not configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const totp = new TOTPGenerator(profile.totp_secret);
    const isValid = await totp.verifyTOTP(token);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid verification token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Enable TOTP
    const { error: enableError } = await supabaseClient
      .from('profiles')
      .update({
        totp_enabled: true,
        two_factor_enabled: true,
        two_factor_method: 'authenticator',
        totp_setup_completed_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (enableError) {
      throw enableError;
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
})
