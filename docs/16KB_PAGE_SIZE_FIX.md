# 16 KB Page Size Support Fix

## Problem
Google Play Console error: "Your app does not support 16 KB memory page sizes"

## Solution

According to the [Android Developer Guide](https://developer.android.com/guide/practices/page-sizes), starting November 1st, 2025, all apps targeting Android 15+ (API 35) must support 16 KB page sizes.

### Requirements:
1. **Android Gradle Plugin (AGP) 8.5.1+** - Automatically aligns native libraries to 16 KB during packaging
2. **NDK r28+** - Compiles native code with 16 KB alignment by default
3. **All native libraries rebuilt** - All `.so` files must be 16 KB aligned

### What We've Configured:

1. **EAS Build Configuration** (`eas.json`):
   - Set `"image": "latest"` to ensure latest build tools are used
   - This ensures AGP 8.5.1+ and NDK r28+ are available

2. **Build Configuration** (`android/app/build.gradle`):
   - Added comments documenting 16 KB support requirements
   - NDK ABI filters are configured
   - Packaging options are set correctly

3. **Gradle Properties** (`android/gradle.properties`):
   - Added documentation about 16 KB support requirements

### Next Steps:

1. **Rebuild your app** using EAS Build:
   ```bash
   eas build --platform android --profile production
   ```

2. **Verify the build** uses AGP 8.5.1+ and NDK r28+:
   - Check EAS Build logs for AGP and NDK versions
   - Ensure the build completes successfully

3. **Test the APK** (optional):
   ```bash
   # Download the APK from EAS Build
   # Verify 16 KB alignment
   zipalign -c -P 16 -v 4 your-app.apk
   ```

4. **Upload to Play Store**:
   - The new build should pass the 16 KB page size check

### If You Still Get Errors:

If you still get the error after rebuilding, it means some native libraries in your dependencies don't support 16 KB page sizes. You'll need to:

1. **Identify problematic libraries**:
   - Check EAS Build logs for warnings about native libraries
   - Look for libraries with 4 KB alignment (0x1000) instead of 16 KB (0x4000)

2. **Update dependencies**:
   - Update React Native to latest version
   - Update Expo SDK to latest version
   - Update all native dependencies to versions that support 16 KB

3. **Contact library maintainers**:
   - If a third-party library doesn't support 16 KB, contact the maintainer
   - Check GitHub issues for the library

### References:
- [Android Developer Guide: Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)
- [Google Play 16 KB Requirement Blog Post](https://android-developers.googleblog.com/2025/07/transition-to-16-kb-page-sizes-android-apps-games-android-studio.html)

