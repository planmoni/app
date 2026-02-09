# iOS Up Next Widget Setup

The Planmoni app includes an iOS home screen widget that shows your next payout plan and a countdown. This doc covers one-time setup and how it works.

## Apple Developer Portal: App Group

The main app and the widget extension share data via **App Groups**. You must create the App Group in the Apple Developer Portal and assign it to both targets.

1. Go to [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Click **+** to add a new identifier, choose **App Groups**, then **Continue**.
3. Set **Description** (e.g. "Planmoni widget") and **Identifier**: `group.app.planmoni.widget` (must match the value in `app.config.js` and `targets/widget/expo-target.config.js`).
4. Register the App Group.
5. Edit your **App ID** for the main app (`app.planmoni`) and enable **App Groups**; add `group.app.planmoni.widget`.
6. After running `npx expo prebuild -p ios`, the widget extension will have its own App ID (e.g. `app.planmoni.widget`). In the Portal, create or edit that App ID and enable **App Groups** with the same `group.app.planmoni.widget`.

Without this, the widget will not receive data from the app.

## Deep link

Tapping the widget opens the app to the payout plan screen via:

- **URL scheme**: `myapp://view-payout?id=<planId>`

Expo Router handles this and `app/view-payout.tsx` reads `id` from `useLocalSearchParams()`.

## Build

1. Ensure `app.config.js` includes the App Group entitlement and the `@bacons/apple-targets` plugin.
2. Run: `npx expo prebuild -p ios --clean` (or your project’s `prebuild:ios` script).
3. Open the project in Xcode and build the **Planmoni** app (the widget target is built with it).

After installing, add the “Up Next” widget from the iOS home screen widget gallery.
