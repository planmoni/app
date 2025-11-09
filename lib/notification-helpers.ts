import { supabase } from "./supabase";

export interface SendNotificationParams {
  user_ids?: string[];
  notification_type:
    | "payout_ready"
    | "payout_failed"
    | "deposit_received"
    | "security_alert"
    | "general";
  title: string;
  body: string;
  data?: Record<string, any>;
  send_to_all?: boolean;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
}

/**
 * Send push notification to users via Supabase Edge Function
 */
export async function sendPushNotification(
  params: SendNotificationParams
): Promise<NotificationResponse> {
  try {
    console.log("📤 Sending push notification:", params);

    const { data, error } = await supabase.functions.invoke(
      "send-push-notification",
      {
        body: params,
      }
    );

    if (error) {
      console.error("❌ Error sending push notification:", error);
      throw error;
    }

    console.log("✅ Push notification sent successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Failed to send push notification:", error);
    throw error;
  }
}

/**
 * Send a payout ready notification to a specific user
 */
export async function sendPayoutReadyNotification(
  userId: string,
  payoutAmount: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "payout_ready",
    title: "Payout Ready! 💰",
    body: `Your payout of ₦${payoutAmount.toLocaleString()} is ready for transfer.`,
    data: {
      type: "payout_ready",
      amount: payoutAmount,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a payout failed notification to a specific user
 */
export async function sendPayoutFailedNotification(
  userId: string,
  reason: string
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "payout_failed",
    title: "Payout Failed ⚠️",
    body: `There was an issue with your payout: ${reason}`,
    data: {
      type: "payout_failed",
      reason,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a deposit received notification to a specific user
 */
export async function sendDepositReceivedNotification(
  userId: string,
  amount: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "deposit_received",
    title: "Deposit Received! 💳",
    body: `₦${amount.toLocaleString()} has been added to your account.`,
    data: {
      type: "deposit_received",
      amount,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a security alert to a specific user
 */
export async function sendSecurityAlertNotification(
  userId: string,
  alertType: string,
  details: string
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "security_alert",
    title: "Security Alert 🔒",
    body: `${alertType}: ${details}`,
    data: {
      type: "security_alert",
      alert_type: alertType,
      details,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a general notification to all users
 */
export async function sendGeneralNotificationToAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<NotificationResponse> {
  return sendPushNotification({
    send_to_all: true,
    notification_type: "general",
    title,
    body,
    data: {
      type: "general",
      timestamp: new Date().toISOString(),
      ...data,
    },
  });
}

/**
 * Test notification function - sends a test notification to the current user
 */
export async function sendTestNotification(): Promise<NotificationResponse> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    return sendPushNotification({
      user_ids: [user.id],
      notification_type: "general",
      title: "Test Notification 🧪",
      body: "This is a test notification from Planmoni!",
      data: {
        type: "test",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Failed to send test notification:", error);
    throw error;
  }
}

/**
 * Send a payout plan created notification to a specific user
 */
export async function sendPayoutPlanCreatedNotification(
  userId: string,
  planName: string,
  payoutAmount: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "general",
    title: "Payout Plan Created! 🎯",
    body: `Your payout plan "${planName}" has been created successfully. You'll receive ₦${payoutAmount.toLocaleString()} per payout.`,
    data: {
      type: "payout_plan_created",
      plan_name: planName,
      amount: payoutAmount,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a payout retry notification to a specific user
 */
export async function sendPayoutRetryNotification(
  userId: string,
  amount: number,
  attemptNumber: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "payout_ready",
    title: "Payout Retry Initiated 🔄",
    body: `We're retrying your ₦${amount.toLocaleString()} payout (attempt ${attemptNumber}). We'll notify you once it's complete.`,
    data: {
      type: "payout_retry",
      amount,
      attempt_number: attemptNumber,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a final payout failure notification to a specific user
 */
export async function sendPayoutFinalFailureNotification(
  userId: string,
  amount: number,
  maxAttempts: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "payout_failed",
    title: "Payout Failed ❌",
    body: `Your ₦${amount.toLocaleString()} payout failed after ${maxAttempts} attempts. Funds have been returned to your wallet.`,
    data: {
      type: "payout_final_failure",
      amount,
      max_attempts: maxAttempts,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a payout cancelled notification to a specific user
 */
export async function sendPayoutCancelledNotification(
  userId: string,
  amount: number,
  reason?: string
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "general",
    title: "Payout Cancelled 🚫",
    body: `Your ₦${amount.toLocaleString()} payout has been cancelled${reason ? `: ${reason}` : ""}. Funds have been returned to your wallet.`,
    data: {
      type: "payout_cancelled",
      amount,
      reason,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a KYC status notification to a specific user
 */
export async function sendKYCStatusNotification(
  userId: string,
  status: "approved" | "rejected" | "pending" | "requires_documents",
  message: string
): Promise<NotificationResponse> {
  const statusEmojis = {
    approved: "✅",
    rejected: "❌",
    pending: "⏳",
    requires_documents: "📄",
  };

  const titles = {
    approved: "KYC Approved",
    rejected: "KYC Verification Failed",
    pending: "KYC Under Review",
    requires_documents: "KYC Documents Required",
  };

  return sendPushNotification({
    user_ids: [userId],
    notification_type: "security_alert",
    title: `${titles[status]} ${statusEmojis[status]}`,
    body: message,
    data: {
      type: "kyc_status_update",
      status,
      message,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a login security notification to a specific user
 */
export async function sendLoginSecurityNotification(
  userId: string,
  deviceInfo: {
    device?: string;
    location?: string;
    time?: string;
    ip?: string;
  }
): Promise<NotificationResponse> {
  const {
    device = "Unknown device",
    location = "Unknown location",
    time,
  } = deviceInfo;

  return sendPushNotification({
    user_ids: [userId],
    notification_type: "security_alert",
    title: "New Login Detected 🔐",
    body: `New login from ${device} in ${location}${time ? ` at ${time}` : ""}. If this wasn't you, please secure your account immediately.`,
    data: {
      type: "login_security_alert",
      device_info: deviceInfo,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send an emergency withdrawal notification to a specific user
 */
export async function sendEmergencyWithdrawalNotification(
  userId: string,
  amount: number,
  status: "initiated" | "completed" | "failed"
): Promise<NotificationResponse> {
  const statusEmojis = {
    initiated: "🚨",
    completed: "✅",
    failed: "❌",
  };

  const titles = {
    initiated: "Emergency Withdrawal Initiated",
    completed: "Emergency Withdrawal Completed",
    failed: "Emergency Withdrawal Failed",
  };

  const bodies = {
    initiated: `Emergency withdrawal of ₦${amount.toLocaleString()} has been initiated. We're processing your request urgently.`,
    completed: `Emergency withdrawal of ₦${amount.toLocaleString()} has been completed successfully.`,
    failed: `Emergency withdrawal of ₦${amount.toLocaleString()} failed. Please contact support for assistance.`,
  };

  return sendPushNotification({
    user_ids: [userId],
    notification_type: status === "failed" ? "security_alert" : "general",
    title: `${titles[status]} ${statusEmojis[status]}`,
    body: bodies[status],
    data: {
      type: "emergency_withdrawal",
      amount,
      status,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a plan expiry reminder notification to a specific user
 */
export async function sendPlanExpiryReminderNotification(
  userId: string,
  planName: string,
  daysUntilExpiry: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "general",
    title: "Plan Expiry Reminder ⏰",
    body: `Your payout plan "${planName}" will expire in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}. Consider extending or creating a new plan.`,
    data: {
      type: "plan_expiry_reminder",
      plan_name: planName,
      days_until_expiry: daysUntilExpiry,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a wallet low balance notification to a specific user
 */
export async function sendLowBalanceNotification(
  userId: string,
  currentBalance: number,
  threshold: number
): Promise<NotificationResponse> {
  return sendPushNotification({
    user_ids: [userId],
    notification_type: "general",
    title: "Low Wallet Balance ⚠️",
    body: `Your wallet balance (₦${currentBalance.toLocaleString()}) is below ₦${threshold.toLocaleString()}. Add funds to continue your payout plans.`,
    data: {
      type: "low_balance_warning",
      current_balance: currentBalance,
      threshold,
      timestamp: new Date().toISOString(),
    },
  });
}
