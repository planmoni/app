// Follow Deno's ES modules convention
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const paystackSecretKey = Deno.env.get('PAYSTACK_LIVE_SECRET_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  try {
    console.log('🔄 Starting transaction check...')

    // Check if already processing
    const { data: existingLock } = await supabase
      .from('system_locks')
      .select('*')
      .eq('lock_name', 'transaction_processing')
      .eq('status', 'active')
      .maybeSingle()

    if (existingLock) {
      console.log('⏳ Transaction processing already in progress, skipping...')
      return new Response(JSON.stringify({ message: 'Already processing' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create processing lock
    const { error: lockError } = await supabase
      .from('system_locks')
      .insert({
        lock_name: 'transaction_processing',
        status: 'active',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      })

    if (lockError) {
      console.error('❌ Error creating processing lock:', lockError)
      return new Response(JSON.stringify({ error: 'Failed to create lock' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get all Paystack accounts
    const { data: paystackAccounts, error: accountsError } = await supabase
      .from('paystack_accounts')
      .select('user_id, account_number, customer_code')

    if (accountsError || !paystackAccounts) {
      console.error('❌ Error fetching Paystack accounts:', accountsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch accounts' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Found ${paystackAccounts.length} Paystack accounts`)

    let totalProcessed = 0
    let totalNewTransactions = 0

    // Process each account
    for (const account of paystackAccounts) {
      try {
        console.log(`🔍 Checking transactions for account: ${account.account_number}`)

        // Fetch transactions from Paystack API
        const response = await fetch('https://api.paystack.co/transaction', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          console.error(`❌ Paystack API error for account ${account.account_number}: ${response.status}`)
          continue
        }

        const data = await response.json()
        
        if (!data.status || !data.data) {
          console.log(`⚠️ No data from Paystack for account ${account.account_number}`)
          continue
        }

        // Filter transactions for this account
        const accountTransactions = data.data.filter((tx: any) => 
          tx.authorization?.account_number === account.account_number &&
          tx.status === 'success' &&
          tx.channel === 'dedicated_nuban'
        )

        console.log(`📈 Found ${accountTransactions.length} transactions for account ${account.account_number}`)

        // Get existing transaction references
        const { data: existingTransactions } = await supabase
          .from('transactions')
          .select('reference')
          .eq('user_id', account.user_id)
          .eq('type', 'deposit')

        const existingReferences = new Set(existingTransactions?.map((t: any) => t.reference) || [])

        // Find new transactions
        const newTransactions = accountTransactions.filter((tx: any) => 
          !existingReferences.has(tx.reference) &&
          tx.metadata?.receiver_account_number
        )

        console.log(`🆕 Found ${newTransactions.length} new transactions for account ${account.account_number}`)

        // Process new transactions
        for (const tx of newTransactions) {
          try {
            const amountInNaira = tx.amount / 100

            console.log(`💰 Processing transaction: ${tx.reference}, Amount: ₦${amountInNaira}`)

            // Process deposit atomically
            const { data: result, error } = await supabase.rpc('process_paystack_deposit', {
              p_user_id: account.user_id,
              p_amount: amountInNaira,
              p_reference: tx.reference
            })

            if (error) {
              console.error(`❌ Error processing transaction ${tx.reference}:`, error)
              continue
            }

            if (result && result.success) {
              console.log(`✅ Successfully processed transaction ${tx.reference}`)
              totalNewTransactions++

              // Send push notification
              await supabase.rpc('send_push_notification', {
                p_user_id: account.user_id,
                p_title: 'Funds Received',
                p_body: `₦${amountInNaira.toLocaleString()} has been added to your wallet`,
                p_data: {
                  type: 'deposit_successful',
                  transaction_reference: tx.reference,
                  amount: amountInNaira
                }
              })

              // Send email notification directly
              await sendEmailDirect(account.user_id, amountInNaira, tx.reference)

            } else {
              console.error(`❌ Failed to process transaction ${tx.reference}`)
            }

          } catch (txError) {
            console.error(`❌ Error processing transaction ${tx.reference}:`, txError)
          }
        }

        totalProcessed++

      } catch (accountError) {
        console.error(`❌ Error processing account ${account.account_number}:`, accountError)
      }
    }

    // Clean up lock
    await supabase
      .from('system_locks')
      .delete()
      .eq('lock_name', 'transaction_processing')

    console.log(`🎉 Transaction check completed! Processed ${totalProcessed} accounts, found ${totalNewTransactions} new transactions`)

    return new Response(JSON.stringify({
      success: true,
      processed_accounts: totalProcessed,
      new_transactions: totalNewTransactions
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Fatal error in transaction check:', error)
    
    // Clean up lock on error
    try {
      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_name', 'transaction_processing')
    } catch (cleanupError) {
      console.error('❌ Error cleaning up lock:', cleanupError)
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Function to send email notification directly
async function sendEmailDirect(userId: string, amount: number, reference: string) {
  try {
    // Get user email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    // Send email directly using Resend API
    const emailSubject = "Funds Received - Planmoni"
    const emailHtml = generateDepositEmailHtml({
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      accountNumber: 'Virtual Account',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference
    })

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to: userProfile.email,
        subject: emailSubject,
        html: emailHtml
      })
    })

    if (emailResponse.ok) {
      console.log(`📧 Email notification sent to ${userProfile.email}`)
    } else {
      console.error('❌ Failed to send email notification:', await emailResponse.text())
    }
  } catch (error) {
    console.error('❌ Error sending email notification:', error)
  }
}

// Email template for deposit notifications
function generateDepositEmailHtml(data: {
  firstName: string
  amount: string
  accountNumber: string
  date: string
  reference: string
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Funds Received - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Funds Received!</h1>
          <p>Hello ${data.firstName}, money has been added to your Planmoni wallet</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Account Number:</span>
              <span class="value">${data.accountNumber}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center;">
            <a href="https://planmoni.com" class="button">View in App</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Your funds are now available in your wallet and ready to be used for your payout plans.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Planmoni</p>
          <p>If you didn't expect this transaction, please contact support immediately</p>
        </div>
      </div>
    </body>
    </html>
  `
} 