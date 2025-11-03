import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TOTP implementation using Web Crypto API
// This is a simplified implementation - in production, use a proper TOTP library

interface TOTPConfig {
  secret: string;
  timeStep: number;
  digits: number;
  algorithm: string;
}

class TOTPGenerator {
  private config: TOTPConfig;

  constructor(config: TOTPConfig) {
    this.config = config;
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
    const timeStep = Math.floor((time || Date.now()) / 1000 / this.config.timeStep);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(0, Math.floor(timeStep / 0x100000000), false);
    timeView.setUint32(4, timeStep & 0xffffffff, false);
    
    const key = this.base32Decode(this.config.secret);
    const hmac = await this.hmacSha1(key, new Uint8Array(timeBuffer));
    
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    
    const otp = code % Math.pow(10, this.config.digits);
    return otp.toString().padStart(this.config.digits, '0');
  }

  // Verify TOTP code with time window
  async verifyTOTP(token: string, time?: number, window: number = 1): Promise<boolean> {
    const currentTime = time || Date.now();
    
    for (let i = -window; i <= window; i++) {
      const testTime = currentTime + (i * this.config.timeStep * 1000);
      const expectedToken = await this.generateTOTP(testTime);
      
      if (expectedToken === token) {
        return true;
      }
    }
    
    return false;
  }
}

// Generate a random base32 secret
function generateSecret(length: number = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  
  return result;
}

// Generate backup codes
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    codes.push(code);
  }
  
  return codes;
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

    const { method } = req;
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

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

    // Handle different endpoints based on URL path
    const endpoint = url.pathname.split('/').pop();
    
    switch (method) {
      case 'POST':
        if (endpoint === 'generate-secret') {
          // Generate TOTP secret for user
          const secret = generateSecret();
          
          // Store secret in database
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ totp_secret: secret })
            .eq('id', user.id);
          
          if (updateError) {
            throw updateError;
          }
          
          return new Response(JSON.stringify({ secret }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (endpoint === 'verify-token') {
          const { token } = await req.json();
          
          if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
            return new Response(JSON.stringify({ error: 'Invalid token format' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Get user's TOTP secret
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
          
          // Verify TOTP token
          const totp = new TOTPGenerator({
            secret: profile.totp_secret,
            timeStep: 30,
            digits: 6,
            algorithm: 'SHA-1'
          });
          
          const isValid = await totp.verifyTOTP(token);
          
          // Log verification attempt
          await supabaseClient
            .from('two_factor_verification_attempts')
            .insert({
              user_id: user.id,
              attempt_type: 'totp',
              success: isValid,
              ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
              user_agent: req.headers.get('user-agent')
            });
          
          return new Response(JSON.stringify({ valid: isValid }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (endpoint === 'enable-totp') {
          const { token } = await req.json();
          
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
          
          const totp = new TOTPGenerator({
            secret: profile.totp_secret,
            timeStep: 30,
            digits: 6,
            algorithm: 'SHA-1'
          });
          
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
        }
        
        if (endpoint === 'generate-backup-codes') {
          const codes = generateBackupCodes();
          
          // Hash and store backup codes
          const codeHashes = await Promise.all(
            codes.map(async (code) => {
              const encoder = new TextEncoder();
              const data = encoder.encode(code);
              const hashBuffer = await crypto.subtle.digest('SHA-256', data);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            })
          );
          
          // Delete existing backup codes
          await supabaseClient
            .from('two_factor_backup_codes')
            .delete()
            .eq('user_id', user.id);
          
          // Insert new backup codes
          const backupCodeInserts = codeHashes.map(hash => ({
            user_id: user.id,
            code_hash: hash,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
          }));
          
          const { error: insertError } = await supabaseClient
            .from('two_factor_backup_codes')
            .insert(backupCodeInserts);
          
          if (insertError) {
            throw insertError;
          }
          
          return new Response(JSON.stringify({ codes }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (endpoint === 'verify-backup-code') {
          const { code } = await req.json();
          
          if (!code || typeof code !== 'string' || !/^[A-Z0-9]{8}$/.test(code.toUpperCase())) {
            return new Response(JSON.stringify({ error: 'Invalid backup code format' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Hash the provided code
          const encoder = new TextEncoder();
          const data = encoder.encode(code.toUpperCase());
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          
          // Find matching backup code
          const { data: backupCode, error: backupError } = await supabaseClient
            .from('two_factor_backup_codes')
            .select('id')
            .eq('user_id', user.id)
            .eq('code_hash', codeHash)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .single();
          
          const isValid = !backupError && backupCode;
          
          // Log verification attempt
          await supabaseClient
            .from('two_factor_verification_attempts')
            .insert({
              user_id: user.id,
              attempt_type: 'backup_code',
              success: isValid,
              ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
              user_agent: req.headers.get('user-agent')
            });
          
          if (isValid) {
            // Mark backup code as used
            await supabaseClient
              .from('two_factor_backup_codes')
              .update({ is_used: true, used_at: new Date().toISOString() })
              .eq('id', backupCode.id);
          }
          
          return new Response(JSON.stringify({ valid: isValid }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        break;
        
      case 'DELETE':
        if (endpoint === 'disable-totp') {
          // Disable TOTP
          const { error: disableError } = await supabaseClient
            .from('profiles')
            .update({
              totp_enabled: false,
              two_factor_enabled: false,
              two_factor_method: 'email',
              totp_secret: null,
              totp_setup_completed_at: null
            })
            .eq('id', user.id);
          
          if (disableError) {
            throw disableError;
          }
          
          // Delete all backup codes
          await supabaseClient
            .from('two_factor_backup_codes')
            .delete()
            .eq('user_id', user.id);
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        break;
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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
