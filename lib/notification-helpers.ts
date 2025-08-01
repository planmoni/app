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
