# Planmoni Update Email Template

## Email HTML (Copy and paste this)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
    body {
      margin: 0;
      padding: 0;
      font-family: Inter, sans-serif;
      background-color: #F4F6F8;
    }
    .container {
      max-width: 480px;
      margin: 40px auto;
      background-color: #fff;
      border-radius: 12px;
      border: 1px solid #E0E0E0;
      overflow: hidden;
    }
    .header {
      background-color: #1A3C89;
      color: white;
      text-align: center;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header img {
      height: 40px;
    }
    .content {
      padding: 20px;
      color: #203B8B;
    }
    .alert-banner {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px 20px;
      margin: 0 0 20px 0;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .alert-icon {
      width: 24px;
      height: 24px;
      background-color: #f59e0b;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .alert-text {
      color: #92400e;
      font-weight: 600;
      font-size: 14px;
      margin: 0;
    }
    .update-button {
      display: inline-block;
      background-color: #1A3C89;
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
      transition: background-color 0.3s;
    }
    .update-button:hover {
      background-color: #152d6b;
    }
    .info-box {
      background-color: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .info-box h4 {
      margin: 0 0 12px 0;
      color: #1A3C89;
      font-size: 14px;
      font-weight: 600;
    }
    .info-box ul {
      margin: 0;
      padding-left: 20px;
      color: #203B8B;
      font-size: 14px;
      line-height: 1.6;
    }
    .info-box li {
      margin-bottom: 8px;
    }
    .info-box li:last-child {
      margin-bottom: 0;
    }
    .stores {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
    }
    .stores img {
      height: 45px;
    }
    .footer {
      font-size: 12px;
      color: #888;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/documents/logo4.png" alt="Planmoni Logo" />
    </div>
    <div class="content">
      <div class="alert-banner">
        <div class="alert-icon">!</div>
        <p class="alert-text">New Update Released!</p>
      </div>

      <h3 style="font-size: 1.6rem; font-weight: bold; margin: 0 0 16px 0;">Important Service Update</h3>

      <p style="font-size: 1.05rem; line-height: 1.6; margin: 0 0 16px 0;">
        We've rolled out a new update that simplifies the KYC process and makes using Planmoni easier and faster - for everyone.
      </p>

      <p style="font-size: 1.05rem; line-height: 1.6; margin: 0 0 20px 0;">
        Please update your app to enjoy the latest features and improvements.
      </p>

      <div style="text-align: center;">
        <a href="https://onelink.to/zua7ze" class="update-button">Click here to update</a>
      </div>

      <div class="info-box">
        <h4>What's New in This Update:</h4>
        <ul>
          <li><strong>Simplified Dashboard System</strong> - A cleaner, more intuitive interface for better navigation</li>
          <li><strong>Paystack Deposit Method</strong> - New payment option added for faster and more convenient deposits</li>
          <li><strong>Streamlined KYC Process</strong> - No more BVN and NIN OTP verifications required, except when requesting a dedicated account number</li>
        </ul>
      </div>

      <p style="font-size: 0.95rem; line-height: 1.6; margin: 20px 0 0 0; color: #666;">
        We're constantly working to improve your experience with Planmoni. This update brings you closer to seamless financial management.
      </p>

      <p style="font-size: 0.95rem; line-height: 1.6; margin: 12px 0 0 0; color: #666;">
        If you have any questions or concerns, please do not hesitate to contact our support team: <a href="mailto:support@planmoni.com" style="color: #1A3C89; text-decoration: none;">support@planmoni.com</a>.
      </p>

      <p style="font-size: 1rem; line-height: 1.6; margin: 24px 0 0 0; font-weight: 600;">
        Best regards,<br>
        <span style="color: #1A3C89;">The Planmoni Team</span>
      </p>

      <div class="stores">
        <a href="https://apps.apple.com/ng/app/planmoni-make-money-last/id6753706776" target="_blank">
          <img src="https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/documents/app-apple.png" alt="Download on App Store">
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.planmoni.app" target="_blank">
          <img src="https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/documents/app-google.png" alt="Get it on Google Play">
        </a>
      </div>
    </div>
  </div>
  <div class="footer">
    This is an automated message from Planmoni.<br>
    If you didn't expect this notification, please contact support immediately.
  </div>
</body>
</html>
```

## Plain Text Version (For email clients that don't support HTML)

```
IMPORTANT SERVICE UPDATE - Planmoni

New Update Released!

We've rolled out a new update that simplifies the KYC process and makes using Planmoni easier and faster - for everyone.

Please update your app to enjoy the latest features and improvements.

👉 Click here to update: https://onelink.to/zua7ze

WHAT'S NEW IN THIS UPDATE:

• Simplified Dashboard System - A cleaner, more intuitive interface for better navigation
• Paystack Deposit Method - New payment option added for faster and more convenient deposits
• Streamlined KYC Process - No more BVN and NIN OTP verifications required, except when requesting a dedicated account number

We're constantly working to improve your experience with Planmoni. This update brings you closer to seamless financial management.

If you have any questions or concerns, please do not hesitate to contact our support team: support@planmoni.com

Best regards,
The Planmoni Team

Download Planmoni:
App Store: https://apps.apple.com/ng/app/planmoni-make-money-last/id6753706776
Google Play: https://play.google.com/store/apps/details?id=com.planmoni.app

---
This is an automated message from Planmoni.
If you didn't expect this notification, please contact support immediately.
```

## Email Subject Lines (Choose one)

1. **Update Available: New Features & Simplified KYC Process**
2. **Planmoni Update: Paystack Deposits & Improved Experience**
3. **Important: Update Your Planmoni App Now**
4. **New Update: Simplified Dashboard & Faster Deposits**

## Sending Instructions

1. **Copy the HTML code** from the first section above
2. **Paste it into your email client** (Gmail, Outlook, Mailchimp, etc.)
3. **Choose a subject line** from the options above
4. **Send to your user base**

## Notes

- The email is mobile-responsive and will display correctly on all devices
- All links are functional and point to the correct destinations
- The update button is prominently displayed for easy access
- Store badges link directly to the App Store and Google Play listings
- Support email is clickable in the HTML version
