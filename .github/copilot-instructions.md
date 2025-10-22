<!--
Guidelines for AI coding agents working on the Planmoni (Expo React Native) app.
Keep this file short and concrete — reference real files and commands so an agent can be productive immediately.
-->

# Copilot / AI agent instructions for Planmoni

Purpose: provide targeted, discoverable knowledge for AI agents to make safe, correct edits in this repo.

## Big picture (what this app is)
- Expo + React Native mobile app using TypeScript and `expo-router` (file-based routing). Entry: `index.js` -> `expo-router/entry`.
- Primary UI lives under `app/` (routes are file-system based). Layout and global providers are configured in `app/_layout.tsx`.
- Global state uses React Contexts in `app/contexts/` (e.g. `AuthContext`, `ThemeContext`, `PinContext`, `AppLockContext`, `BalanceContext`). Providers are composed at the top-level in `app/_layout.tsx` — preserve order when editing.
- Many integrations: Supabase (`@supabase/supabase-js`), Firebase, Intercom, Sentry, Stream Chat, Resend; native modules via Expo and several community packages (see `package.json` dependencies).

## Quick dev workflows (commands this repo actually uses)
- Start development (dev client): `yarn start` (runs `expo start --dev-client`).
- Standard expo dev: `yarn dev` (runs `npx expo start`).
- Run on Android/iOS emulators: `yarn android` / `yarn ios` (these use `expo run:*`).
- Reset project helper: `yarn reset-project` executes `./scripts/reset-project.js` — use this when caches or native state need clearing.
- Lint: `yarn lint` (uses Expo ESLint config).

Notes: this repo uses `expo-dev-client` for custom native modules; use `expo start --dev-client` for device testing. Do not assume `expo start` will match dev-client behavior.

## Key files and patterns (where to look for examples)
- Routing and app structure: `app/` (routes, `(auth)/`, `(tabs)/`, `+not-found.tsx`). Edit routes by adding/removing files here.
- Global providers & startup: `app/_layout.tsx` — contains font loading, Splash handling, `initializeNotifications()` call, and provider composition.
- Theme values & usage: `app/contexts/ThemeContext.tsx` — colors are centralized here (refer to `colors` object for design tokens when styling components).
- Secure storage helpers: `app/lib/secure-storage` (used by contexts like `ThemeContext`). Prefer these helpers over ad-hoc AsyncStorage calls.
- Native error suppression and startup hooks: `index.js` imports `./lib/errorSuppressor` — check before changing startup behavior.
- Notifications: `app/lib/notifications` is initialized in `_layout.tsx`; clean-up semantics are present — keep init/cleanup when changing auth flows.

## Concrete examples & important lifecycle notes

- Auth/session lifecycle (see `app/contexts/AuthContext.tsx`):
	- Sessions are managed by `useSupabaseAuth()` (hook) and are persisted/restored by session persistence utilities in `app/lib/session-persistence.ts` and `app/lib/session-restoration.ts` (look before changing auth flow).
	- `AuthContext` initializes third-party services when a session exists (for example Intercom via `intercomService.init(session)`), and logs out services on session removal. Preserve these `useEffect` hooks and their dependency arrays.
	- Profile snapshot management: `ProfileSnapshotManager.saveMetadataSnapshot()` and `refreshProfileSnapshot()` run when `session.user.id` is present. On sign-out the provider calls `ProfileSnapshotManager.clearProfileSnapshot()`; keep this behavior unless you handle snapshots elsewhere.
	- Sign-in calls may also invoke serverless functions (example: invokes `supabase.functions.invoke('login-notification', { body: { userId } })`). Avoid removing that call unless replacing with an equivalent event.
	- UI behavior: `AuthProvider` renders `SessionExpiredModal` when token errors occur (JWT expired / refresh token missing). Don't suppress that modal without adjusting token refresh flows.

- Notifications (see `app/lib/notifications.ts` & `app/lib/push-notifications.ts`):
	- `initializeNotifications(userId)` requests permissions, registers for push tokens and calls `storeFCMToken(userId, token)`. It returns a cleanup function that removes listeners — `_layout.tsx` calls it and expects a cleanup to be returned. Keep the promise/cleanup pattern in place.
	- `registerForPushNotificationsAsync()` requires a physical device (logs "Must use a physical device for push notifications" on simulators). Tests that rely on FCM must mock or guard for simulators.
	- Notification listeners are created via `Notifications.addNotificationReceivedListener` and `addNotificationResponseReceivedListener` and the returned `cleanup()` removes them. Always call cleanup on unmount or session change.
	- `push-notifications.ts` contains a `PushNotificationService` singleton which stores tokens in Supabase. If you change storage schema, update both `notifications.ts` and `push-notifications.ts`.

- Secure storage (see `app/lib/secure-storage.ts`):
	- Exposes `saveItem`, `getItem`, `deleteItem` and a set of keys (e.g. `APP_LOCK_PIN_KEY`, `AUTH_SESSION_KEY`, etc.). Use these helpers; they wrap `expo-secure-store` on native and a `WebStorage` fallback (localStorage or an in-memory Map) on web.
	- Error handling: the helpers log errors and (for set/delete) rethrow in some cases — account for that in callers. Do not replace with AsyncStorage unless intentionally widening threat model.

## Quick tips for making changes safely
- When changing provider order or adding a new global provider, update `app/_layout.tsx` and test the startup path: fonts load, `SplashScreen.hideAsync()` is called only after fonts + auth readiness.
- If adding/removing native dependencies, note that the project uses `expo-dev-client` and will likely require rebuilding the dev client (`eas build` / `expo run:ios|android`) for native changes to take effect.
- For push notifications, prefer mocking `registerForPushNotificationsAsync()` or gating by `Device.isDevice` in unit tests — CI runners will not have a device token.

Inline snippets (copyable patterns)

Below are 3 short, copy-paste friendly patterns that frequently appear in this repo. Keep the surrounding comments and dependency arrays when adapting them.

1) initialize notifications in `_layout.tsx` (async init + cleanup — must be awaited and cleanup returned):

```ts
useEffect(() => {
	if (session?.user?.id) {
		initializeNotifications(session.user.id).then(cleanup => {
			return () => { if (cleanup) cleanup(); };
		}).catch(err => console.warn('Failed to init notifications', err));
	}
}, [session?.user?.id]);
```

2) initialize third-party services on auth change in `AuthContext.tsx` (init on session, logout on removal):

```ts
useEffect(() => {
	if (session) {
		intercomService.init(session);
	} else {
		intercomService.logout();
	}
}, [session]);
```

3) profile snapshot pattern in `AuthContext.tsx` (save immediately, refresh in background):

```ts
useEffect(() => {
	if (session?.user?.id) {
		if (session.user.user_metadata) {
			ProfileSnapshotManager.saveMetadataSnapshot(session.user.id, session.user.user_metadata);
		}
		ProfileSnapshotManager.refreshProfileSnapshot(session.user.id).catch(console.error);
	}
}, [session?.user?.id]);
```

Would you like me to (A) add a short PR template for changes touching providers/native deps, or (B) expand the snippets to include testing/mocking examples (e.g. how to mock `registerForPushNotificationsAsync()` and `expo-secure-store`)?

## Project-specific conventions & rules
- TypeScript path alias: `@/*` maps to repository root (see `tsconfig.json`). Import using `@/contexts/...` or `@/lib/...`.
- Context providers order matters: `ThemeProvider` -> `ToastProvider` -> `AuthProvider` -> `PinProvider` -> `AppLockProvider` -> `BalanceProvider` (see `app/_layout.tsx`). Keep this ordering unless you intentionally change dependency relationships.
- Keep the native splash/hide logic intact: fonts are loaded and `SplashScreen.hideAsync()` is called only after fonts + auth readiness. Changing this can cause flash-of-unstyled-content issues.
- Theme values are canonical: use `useTheme()` from `app/contexts/ThemeContext.tsx` instead of hardcoding colors.
- Storage keys are centralized (e.g. `THEME_PREFERENCE_KEY` inside `ThemeContext.tsx`) — follow existing keys when reading/writing persisted preferences.

## Integration points & external dependencies to be careful about
- Authentication/session: `app/contexts/AuthContext` (used heavily for conditional routing). Changes here affect many screens.
- Notifications: `app/lib/notifications` (initialized when `session.user.id` exists). Preserve async cleanup patterns.
- Server/API helpers: `api/` at repo root contains server-like helpers (`dojah-kyc+api.ts`, `paystack-tokenize+api.ts`, etc.). These are used by app services — update only with clear intent.
- Native modules & third-party SDKs: Sentry, Intercom, Supabase, Stream Chat. Check `package.json` before adding/removing native deps; modifying native deps may require rebuilding dev-client.

## How to make safe edits (do / don't rules for an AI agent)
- Do: follow existing import alias (`@/...`), use typed Context hooks (`useTheme()`, `useAuth()`), and refer to `app/_layout.tsx` for lifecycle expectations.
- Do: preserve provider order, initialize and cleanup side effects (look for returned cleanup functions from `useEffect`).
- Don't: add or remove native dependencies without updating README and noting that `expo-dev-client` may need rebuild and that CI may fail on native changes.
- Don't: change splash/font-loading logic lightly — test on device/emulator.

## Example edits & where to add tests / validation
- UI color change: update `lightColors` / `darkColors` in `app/contexts/ThemeContext.tsx` and use `useTheme()` in components (example usage: `app/components/AppBlur.tsx`).
- Add a new route: create file under `app/(tabs)/your-screen.tsx` or `app/new-route.tsx` and export default screen component — `expo-router` will pick it up.
- Add analytics or page tracking: modify `app/_layout.tsx` where `usePageTracking()` is called.

## Quick PR checklist for agents
- Build: ensure TypeScript compiles (repo uses strict TS). Run `yarn dev` and verify no runtime errors on startup.
- Lint: run `yarn lint` and fix issues.
- Manual sanity: open on simulator or device (if native change, note rebuild requirement). Verify provider ordering and splash behavior.
- Mention changed files that touch providers, routing, or native deps in PR description and why.

If anything above is unclear or you need more examples (specific files, test scripts, or how-to-run on device), tell me which area to expand and I will iterate.
