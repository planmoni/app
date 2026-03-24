/**
 * Mono Direct Pay - HTTPS redirect handler
 *
 * Mono redirects here after payment (success or failure). We return a small HTML page
 * that posts the query params to the React Native WebView via postMessage, so the app
 * can navigate to success/failure without loading a custom scheme (which often fails
 * in WebViews).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const reason = url.searchParams.get("reason") ?? "";

  const payload = JSON.stringify({
    type: "mono_redirect",
    reference,
    status,
    reason,
  });
  const bytes = new TextEncoder().encode(payload);
  const binary = String.fromCharCode(...bytes);
  const payloadBase64 = btoa(binary);

  const html =
    "<!DOCTYPE html><html><head>" +
    "<meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Redirecting...</title>" +
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;}p{color:#666;}</style>" +
    "</head><body><p>Redirecting...</p>" +
    "<script>" +
    "(function(){var b='" +
    payloadBase64 +
    "';try{var p=decodeURIComponent(escape(atob(b)));if(window.ReactNativeWebView&&typeof window.ReactNativeWebView.postMessage==='function'){window.ReactNativeWebView.postMessage(p);}}catch(e){}}());" +
    "</script></body></html>";

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
