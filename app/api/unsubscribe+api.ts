import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #EF4444; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">Invalid Unsubscribe Link</div>
          <p>The unsubscribe link you clicked is invalid or has expired.</p>
          <p>If you'd like to manage your email preferences, please log in to your account.</p>
        </body>
        </html>
        `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    const { data, error } = await supabase.rpc('process_unsubscribe', {
      p_token: token
    });

    if (error || !data || !data.success) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe Failed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #EF4444; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">Unable to Process Unsubscribe Request</div>
          <p>${data?.message || 'The unsubscribe token is invalid or has expired.'}</p>
          <p>If you continue to receive emails, please contact our support team.</p>
        </body>
        </html>
        `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    const categoryText = data.category === 'all'
      ? 'all marketing emails'
      : `${data.category.replace('_', ' ')} emails`;

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Successfully Unsubscribed</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .success {
            color: #22C55E;
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #1E3A8A;
            font-size: 28px;
            margin-bottom: 15px;
          }
          p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin: 15px 0;
          }
          .button {
            display: inline-block;
            background-color: #1E3A8A;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from <strong>${categoryText}</strong>.</p>
          <p>You will no longer receive these types of emails from Planmoni.</p>
          <p>If you change your mind, you can update your email preferences anytime in your account settings.</p>
          <a href="https://planmoni.com/email-preferences" class="button">Manage Email Preferences</a>
          <div class="footer">
            <p>You'll still receive important account-related emails such as security alerts and transaction confirmations.</p>
          </div>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #EF4444; font-size: 24px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="error">Something Went Wrong</div>
        <p>We encountered an error while processing your unsubscribe request.</p>
        <p>Please try again later or contact our support team for assistance.</p>
      </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return createJsonResponse({ error: 'Missing token' }, 400);
    }

    const { data, error } = await supabase.rpc('process_unsubscribe', {
      p_token: token
    });

    if (error || !data || !data.success) {
      return createJsonResponse({
        success: false,
        message: data?.message || 'Failed to process unsubscribe request'
      }, 400);
    }

    return createJsonResponse({
      success: true,
      message: data.message,
      category: data.category
    });
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return createJsonResponse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
