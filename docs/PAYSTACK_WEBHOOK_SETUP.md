# Paystack Webhook Setup Guide

This guide will help you configure Paystack webhooks so that your app receives notifications when money is sent to your virtual account.

## 🚨 **Current Issue**
Money is showing in your Paystack dashboard but not reflecting in your app. This means the webhook isn't configured or isn't reaching your app.

## 🔧 **Step-by-Step Setup**

### 1. **Get Your Webhook URL**

Your webhook URL should be:
```
https://your-domain.com/api/paystack-webhook
```

**For development/testing:**
- If using Expo: `https://your-expo-url.com/api/paystack-webhook`
- If using local development: You'll need to use a service like ngrok

### 2. **Configure Webhook in Paystack Dashboard**

1. **Login to Paystack Dashboard**
   - Go to https://dashboard.paystack.com/
   - Login with your account

2. **Navigate to Webhooks**
   - Go to **Settings** → **Webhooks**
   - Or search for "Webhooks" in the dashboard

3. **Add New Webhook**
   - Click **"Add Webhook"** or **"Create Webhook"**
   - Enter your webhook URL
   - Select the events you want to listen to:
     - ✅ `charge.success` (when money is sent to virtual account)
     - ✅ `dedicated_account.assigned` (when virtual account is created)
     - ✅ `transfer.success` (when transfers are completed)

4. **Save the Webhook**
   - Click **"Save"** or **"Create"**
   - Copy the **Webhook Secret** (you'll need this for your environment variables)

### 3. **Set Environment Variables**

Add these to your `.env` file:
```bash
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here
```

### 4. **Test the Webhook**

1. **Send a test payment** to your virtual account
2. **Check Paystack webhook logs** in the dashboard
3. **Check your app logs** for webhook reception

## 🔍 **Troubleshooting**

### **Webhook Not Being Sent**

1. **Check Webhook Status in Paystack**
   - Go to Settings → Webhooks
   - Check if the webhook is "Active"
   - Look for any error messages

2. **Check Webhook URL**
   - Make sure the URL is publicly accessible
   - Test with a simple HTTP request
   - Ensure no typos in the URL

3. **Check Event Selection**
   - Make sure `charge.success` is selected
   - Verify the webhook is configured for the right events

### **Webhook Being Sent But Not Processed**

1. **Check Your App Logs**
   - Look for webhook reception logs
   - Check for any error messages
   - Verify the webhook signature

2. **Test Webhook Endpoint**
   ```bash
   node scripts/test-webhook-endpoint.js
   ```

3. **Check Environment Variables**
   - Verify `PAYSTACK_WEBHOOK_SECRET` is set
   - Make sure the secret matches Paystack's

### **Common Issues**

1. **Local Development**
   - Paystack can't reach localhost
   - Use ngrok: `ngrok http 3000`
   - Update webhook URL with ngrok URL

2. **HTTPS Required**
   - Paystack requires HTTPS for webhooks
   - Use ngrok or deploy to get HTTPS

3. **Wrong Events**
   - Make sure you're listening to `charge.success`
   - Check if the payment actually triggered the event

## 🧪 **Testing Steps**

### 1. **Test Webhook Endpoint**
```bash
node scripts/test-webhook-endpoint.js
```

### 2. **Test with Real Payment**
1. Send money to your virtual account
2. Check Paystack webhook logs
3. Check your app logs
4. Verify balance update

### 3. **Check Webhook Logs in Paystack**
1. Go to Settings → Webhooks
2. Click on your webhook
3. Check "Webhook Logs" or "Event History"
4. Look for successful/failed deliveries

## 📊 **Monitoring**

### **Paystack Dashboard**
- Webhook delivery status
- Event history
- Error messages
- Response times

### **Your App Logs**
- Webhook reception
- Processing status
- Error messages
- Balance updates

## 🆘 **Still Not Working?**

If the webhook still isn't working:

1. **Double-check everything** in this guide
2. **Test with ngrok** for local development
3. **Check Paystack support** for webhook issues
4. **Verify your app is running** and accessible
5. **Check firewall/network** settings

## 📞 **Support**

- **Paystack Support**: Contact Paystack for webhook issues
- **App Issues**: Check your app logs and configuration
- **Network Issues**: Verify your endpoint is accessible 