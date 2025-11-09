import { sendEmail } from '@/lib/email-service';
import { wrapMarketingEmail } from '@/lib/email-templates';
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

async function verifyServiceRole(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];

    if (token === supabaseServiceKey) {
      return { isServiceRole: true };
    }

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

export async function POST(request: Request) {
  try {
    const auth = await verifyServiceRole(request);
    if (!auth) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_campaign':
        return await createCampaign(body);

      case 'send_campaign':
        return await sendCampaign(body);

      case 'schedule_campaign':
        return await scheduleCampaign(body);

      default:
        return createJsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('Error in marketing campaigns API:', error);
    return createJsonResponse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

async function createCampaign(body: any) {
  const { title, subject, html_content, category, metadata } = body;

  if (!title || !subject || !html_content || !category) {
    return createJsonResponse({ error: 'Missing required fields' }, 400);
  }

  const validCategories = ['promotional', 'product_update', 'educational', 'newsletter'];
  if (!validCategories.includes(category)) {
    return createJsonResponse({ error: 'Invalid category' }, 400);
  }

  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      title,
      subject,
      html_content,
      category,
      status: 'draft',
      metadata: metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating campaign:', error);
    return createJsonResponse({ error: 'Failed to create campaign' }, 500);
  }

  return createJsonResponse({
    success: true,
    campaign: data
  });
}

async function scheduleCampaign(body: any) {
  const { campaign_id, scheduled_at } = body;

  if (!campaign_id || !scheduled_at) {
    return createJsonResponse({ error: 'Missing required fields' }, 400);
  }

  const { data, error } = await supabase
    .from('email_campaigns')
    .update({
      scheduled_at,
      status: 'scheduled'
    })
    .eq('id', campaign_id)
    .select()
    .single();

  if (error) {
    console.error('Error scheduling campaign:', error);
    return createJsonResponse({ error: 'Failed to schedule campaign' }, 500);
  }

  return createJsonResponse({
    success: true,
    campaign: data
  });
}

async function sendCampaign(body: any) {
  const { campaign_id, recipient_filters } = body;

  if (!campaign_id) {
    return createJsonResponse({ error: 'Missing campaign_id' }, 400);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaign_id)
    .single();

  if (campaignError || !campaign) {
    return createJsonResponse({ error: 'Campaign not found' }, 404);
  }

  if (campaign.status === 'sent') {
    return createJsonResponse({ error: 'Campaign already sent' }, 400);
  }

  await supabase
    .from('email_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaign_id);

  let recipientsQuery = supabase
    .from('profiles')
    .select('id, first_name, email, marketing_email_preferences');

  if (recipient_filters?.segment) {
    switch (recipient_filters.segment) {
      case 'all_active':
        break;
      case 'kyc_verified':
        recipientsQuery = recipientsQuery.eq('kyc_verified', true);
        break;
    }
  }

  const { data: recipients, error: recipientsError } = await recipientsQuery;

  if (recipientsError) {
    await supabase
      .from('email_campaigns')
      .update({ status: 'draft' })
      .eq('id', campaign_id);

    return createJsonResponse({ error: 'Failed to fetch recipients' }, 500);
  }

  const categoryMap: Record<string, string> = {
    'promotional': 'promotional',
    'product_update': 'product_updates',
    'educational': 'educational',
    'newsletter': 'newsletters'
  };

  const preferenceKey = categoryMap[campaign.category];

  const filteredRecipients = recipients.filter(recipient => {
    const prefs = recipient.marketing_email_preferences as any;
    if (!prefs) return true;
    return prefs[preferenceKey] !== false;
  });

  let successCount = 0;
  let failureCount = 0;

  for (const recipient of filteredRecipients) {
    try {
      const { data: tokenData } = await supabase
        .rpc('generate_unsubscribe_token', {
          p_user_id: recipient.id,
          p_category: campaign.category
        });

      const unsubscribeToken = tokenData || '';

      const emailHtml = wrapMarketingEmail({
        firstName: recipient.first_name || 'User',
        htmlContent: campaign.html_content,
        category: campaign.category as any,
        unsubscribeToken,
        campaignId: campaign.id
      });

      await sendEmail(recipient.email, campaign.subject, emailHtml);

      await supabase
        .from('email_campaign_recipients')
        .insert({
          campaign_id: campaign.id,
          user_id: recipient.id,
          email: recipient.email,
          sent_at: new Date().toISOString()
        });

      successCount++;
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);

      await supabase
        .from('email_campaign_recipients')
        .insert({
          campaign_id: campaign.id,
          user_id: recipient.id,
          email: recipient.email,
          sent_at: new Date().toISOString(),
          bounced: true,
          bounce_reason: error instanceof Error ? error.message : 'Unknown error'
        });

      failureCount++;
    }
  }

  await supabase
    .from('email_campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: successCount + failureCount
    })
    .eq('id', campaign_id);

  return createJsonResponse({
    success: true,
    message: `Campaign sent to ${successCount} recipients`,
    stats: {
      total_recipients: filteredRecipients.length,
      sent: successCount,
      failed: failureCount
    }
  });
}

export async function GET(request: Request) {
  try {
    const auth = await verifyServiceRole(request);
    if (!auth) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get('campaign_id');
    const status = url.searchParams.get('status');

    if (campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) {
        return createJsonResponse({ error: 'Campaign not found' }, 404);
      }

      const { data: recipients } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId);

      return createJsonResponse({
        success: true,
        campaign,
        recipients
      });
    }

    let query = supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      return createJsonResponse({ error: 'Failed to fetch campaigns' }, 500);
    }

    return createJsonResponse({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return createJsonResponse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await verifyServiceRole(request);
    if (!auth) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const { campaign_id, updates } = body;

    if (!campaign_id || !updates) {
      return createJsonResponse({ error: 'Missing required fields' }, 400);
    }

    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return createJsonResponse({ error: 'Failed to update campaign' }, 500);
    }

    return createJsonResponse({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return createJsonResponse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyServiceRole(request);
    if (!auth) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get('campaign_id');

    if (!campaignId) {
      return createJsonResponse({ error: 'Missing campaign_id' }, 400);
    }

    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      console.error('Error deleting campaign:', error);
      return createJsonResponse({ error: 'Failed to delete campaign' }, 500);
    }

    return createJsonResponse({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return createJsonResponse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
