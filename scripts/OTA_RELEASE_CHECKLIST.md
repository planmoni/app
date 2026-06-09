# OTA & Native Release Checklist

Use this before publishing EAS Updates or promoting Android/iOS builds.

## Runtime version (single source of truth)

- `app.config.js` → `expo.runtimeVersion` (authoritative)
- `app.json` → `expo.runtimeVersion` (keep in sync for tooling)
- Bump runtime when native modules or Expo SDK change

Current policy: **OTA bundles only apply to binaries built with the same `runtimeVersion`.**

## When JS-only OTA is safe

- UI/copy changes
- Business logic in TypeScript
- Non-native dependency patches that do not touch `package.json` native modules

## When a new native build is required

- `expo`, `react-native`, `react-native-reanimated`, `react-native-worklets`
- Firebase, Intercom, Sentry, AppsFlyer, or any config plugin change
- `app.config.js` plugin / `android` / `ios` native settings
- After `yarn prebuild` / `yarn prebuild:android` / `yarn prebuild:ios`

## Publish flow

1. `yarn validate:deps`
2. If native deps changed: `eas build --profile preview --platform android` (and iOS if needed)
3. Install fresh build on test devices
4. Run Android validation matrix (below)
5. `node scripts/publish-update.js preview "message"`
6. Promote to production after crash-free period

For native-sensitive `package.json` changes, set `CONFIRM_NATIVE_BUILD=1` only after step 2–4 pass.

## Android validation matrix

| Scenario | Pass criteria |
|----------|---------------|
| Cold start (fresh install) | Splash → home, no TurboModule errors |
| Warm start | Resume from background < 2s |
| Post-OTA reopen | Update applies, no crash on reload |
| Home tab | Carousel loads (lazy), no white screen |
| AI assistant | Reanimated messages animate |
| Onboarding / welcome modal | Opens when triggered, no startup import crash |

## Staged rollout order

1. `development` dev client (internal)
2. `preview` channel APK/AAB
3. `production` after Sentry/crash monitoring is clean 24–48h

## Reanimated / dev client

TurboModule crashes happen when JS loads `react-native-reanimated` against an old native binary. The app uses `lib/reanimatedSafe.tsx` with fallbacks by default.

After installing a **new** dev client with a matching native build, enable native animations locally:

```bash
# .env
EXPO_PUBLIC_USE_REANIMATED=true
```

EAS builds set this automatically via `eas.json`. Do not enable until the matching native build is installed.

## Commands

```bash
yarn validate:deps
yarn prebuild:android
cd android && ./gradlew clean && cd ..
eas build --profile development --platform android
npx expo start -c
node scripts/publish-update.js preview "your message"
```
