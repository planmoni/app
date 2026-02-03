import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const url = new URL(req.url)
  // Get all query parameters from the incoming URL (e.g. reference, status)
  const params = url.searchParams.toString()
  
  // Construct the deep link URL
  const deepLink = `planmoni://mandate-status?${params}`
  
  console.log(`Redirecting from ${req.url} to ${deepLink}`)

  // Return a 302 Redirect
  return new Response(null, {
    status: 302,
    headers: {
      'Location': deepLink,
    },
  })
})
