# Notifications Pipeline Freeze

This document freezes the canonical notification architecture for the 2026 overhaul.

## Canonical Paths

- **Push sender (remote):** `supabase/functions/send-push-notification`
- **Token source:** `profiles.fcm_token` (Expo token) + `user_push_tokens.expo_push_token`
- **Legacy queue worker compatibility:** `supabase/functions/send-push-notifications` delegates to canonical sender
- **In-app feed source:** `events` table
- **Tap routing source of truth:** `lib/notificationRouting.ts` used by `app/_layout.tsx`

## Deprecated / Transitional Paths

- Direct FCM v1 send logic inside `send-push-notifications` (removed)
- Notification tap navigation in `contexts/NotificationContext.tsx` (removed)
- Notification tap navigation in `lib/notifications.ts` (removed; foreground diagnostics only)
- `push_notification_queue` direct delivery path (transitional only)

## Required Event Producers

Transactional producers must call `send-push-notification`:

- `supabase/functions/verify-paystack-payment/index.ts`
- `supabase/functions/mono-webhook/index.ts`
- `supabase/functions/safehaven-webhook/index.ts`
- `supabase/functions/process-due-payouts/index.ts`
- `supabase/functions/process-vault-payout-schedules/index.ts`

## Preference Contracts

- `profiles.push_notifications` governs push category toggles and quiet hours
- `profiles.notification_preferences` remains backwards-compatible for old keys (`payouts`, `deposits`, etc.)
- Security alerts bypass quiet-hours suppression

## Action/Data Contract for push payloads

All push payloads should include:

- `type`: canonical notification type
- `action`: one of `view_plan`, `view_balance`, `open_home`, `create_plan`, `view_vault`
- `route`: fallback route string for direct navigation
- Optional IDs: `plan_id`, `vault_schedule_id`, `transaction_reference`

