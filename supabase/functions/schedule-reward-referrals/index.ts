import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all unique referrer_ids with pending/qualified referrals
  const { data: referrers, error } = await supabase
    .from("referrals")
    .select("referrer_id")
    .in("status", ["pending", "qualified"])
    .neq("referrer_id", null);

  if (error) return new Response("Error fetching referrers", { status: 500 });

  // Get unique referrer_ids
  const uniqueReferrers = Array.from(new Set((referrers || []).map(r => r.referrer_id)));

  for (const referrer_id of uniqueReferrers) {
    await fetch(Deno.env.get("REWARD_REFERRALS_API_URL")!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ referrer_id }),
    });
  }

  return new Response("Reward check complete", { status: 200 });
}); 