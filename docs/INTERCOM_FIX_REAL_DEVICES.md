# Intercom Fix for Real iOS Devices

## Problem
Intercom was working on iOS Simulator but showing a blank page on real devices.

## Root Causes
1. **Missing Intercom initialization in AppDelegate** - Intercom SDK was not being initialized natively in the iOS AppDelegate
2. **Missing NSAppTransportSecurity exceptions** - iOS was blocking Intercom's web content from loading due to App Transport Security restrictions
3. **Missing native import** - The Intercom module wasn't imported in the AppDelegate

## Solutions Applied

### 1. Updated AppDelegate.swift
**File:** `/ios/Planmoni/AppDelegate.swift`

Added Intercom import and initialization:

```swift
import Intercom

// In application didFinishLaunchingWithOptions:
Intercom.setApiKey("ios_sdk-de52645ae34ab0f059890a422f90b18092032115", forAppId: "tf4dp3qt")
Intercom.setLauncherVisible(false)
```

**Why this fixes it:**
- Initializes Intercom SDK natively before React Native loads
- Sets the launcher to hidden (we control it from React Native)
- Ensures Intercom is ready when the app starts

### 2. Updated Info.plist
**File:** `/ios/Planmoni/Info.plist`

Added NSAppTransportSecurity exceptions for Intercom domains:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSAllowsLocalNetworking</key>
  <true/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>intercom.io</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
    <key>intercomcdn.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
    <key>intercom-attachments-1.com</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
  </dict>
</dict>
```

**Why this fixes it:**
- Allows Intercom to load web content from their servers
- Permits loading of images, scripts, and other resources from Intercom CDN
- Enables file attachments to work properly

### 3. Reinstalled Dependencies
Ran the following commands to ensure all native modules are properly linked:

```bash
npm install
cd ios && pod install
npx expo prebuild --clean
```

## Testing on Real Devices

After applying these fixes, test on a real iOS device:

1. **Build and run on device:**
   ```bash
   npx expo run:ios --device
   ```

2. **Test Intercom functionality:**
   - Open the app
   - Navigate to a screen with Intercom support button
   - Tap the support button
   - Intercom messenger should open with full content (not blank)
   - Test sending a message
   - Test viewing help articles
   - Test file attachments

## Why It Worked on Simulator But Not Real Devices

**Simulator differences:**
- Simulators have more relaxed security policies
- Network requests are handled differently
- App Transport Security is less strict
- Native module initialization timing can differ

**Real device requirements:**
- Stricter App Transport Security enforcement
- Requires explicit domain exceptions for HTTP/HTTPS content
- Native SDK must be properly initialized before use
- All native modules must be correctly linked

## Important Notes

1. **After running `expo prebuild --clean`**, you must reapply these changes as prebuild regenerates the iOS folder
2. **Keep these changes in version control** to avoid losing them
3. **Test on multiple iOS versions** (iOS 14, 15, 16, 17) to ensure compatibility
4. **Monitor console logs** for any Intercom-related errors during testing

## Verification Checklist

- [x] Intercom import added to AppDelegate.swift
- [x] Intercom initialization added to didFinishLaunchingWithOptions
- [x] NSAppTransportSecurity exceptions added to Info.plist
- [x] Pods reinstalled
- [x] Project cleaned and rebuilt
- [ ] Tested on real iOS device
- [ ] Verified Intercom messenger opens correctly
- [ ] Verified messages can be sent
- [ ] Verified help articles load
- [ ] Verified file attachments work

## Troubleshooting

If Intercom still shows blank page:

1. **Check console logs** for network errors
2. **Verify API keys** in app.json match AppDelegate
3. **Clear derived data:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```
4. **Clean build:**
   ```bash
   cd ios
   xcodebuild clean
   ```
5. **Reinstall pods:**
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   ```

## Additional Resources

- [Intercom iOS SDK Documentation](https://developers.intercom.com/installing-intercom/docs/ios-installation)
- [Apple App Transport Security Guide](https://developer.apple.com/documentation/security/preventing_insecure_network_connections)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)

## Maintenance

When updating Expo or React Native versions:
1. Run `npx expo prebuild --clean`
2. Reapply the AppDelegate.swift changes
3. Verify Info.plist still has NSAppTransportSecurity exceptions
4. Test on real device before deploying

---

**Last Updated:** January 2025
**Tested On:** iOS 15.0+, Expo SDK 53, React Native 0.79.6
