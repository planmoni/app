# Intercom Setup Guide for Expo React Native

This guide will help you set up Intercom in your Expo React Native app.

## ✅ What's Already Configured

Your app already has the basic Intercom setup:

1. **Package installed**: `@intercom/intercom-react-native`
2. **Configuration in app.json**: API keys and app ID configured
3. **Android setup**: MainActivity.kt configured with Intercom initialization
4. **iOS setup**: Podfile and project configuration ready

## 🔧 Current Configuration

### App Configuration
```json
// app.json
{
  "plugins": [
    [
      "@intercom/intercom-react-native",
      {
        "appId": "tf4dp3qt",
        "androidApiKey": "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf",
        "iosApiKey": "ios_sdk-de52645ae34ab0f059890a422f90b18092032115",
        "intercomRegion": "US"
      }
    ]
  ]
}
```

### Android Configuration
```kotlin
// android/app/src/main/java/com/planmoni/app/MainActivity.kt
IntercomModule.initialize(this, "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf", "tf4dp3qt");
```

## 🚀 How to Use Intercom

### 1. Basic Usage with Hook

```tsx
import { useIntercom } from '@/hooks/useIntercom';

function MyComponent() {
  const { present, loginUser, logout, isInitialized } = useIntercom();

  const handleHelp = async () => {
    await present(); // Opens Intercom messenger
  };

  const handleLogin = async () => {
    await loginUser('user123', 'user@example.com', 'John Doe');
  };

  return (
    <Button onPress={handleHelp} title="Get Help" />
  );
}
```

### 2. Using the Intercom Button Component

```tsx
import { IntercomButton } from '@/components/IntercomButton';

function MyScreen() {
  return (
    <View>
      {/* Primary button */}
      <IntercomButton title="Need Help?" variant="primary" />
      
      {/* Icon button */}
      <IntercomButton variant="icon" size="large" />
      
      {/* Secondary button */}
      <IntercomButton title="Contact Support" variant="secondary" />
    </View>
  );
}
```

### 3. Direct Service Usage

```tsx
import { intercomService } from '@/lib/intercom';

// Initialize Intercom
await intercomService.initialize();

// Login user
await intercomService.loginUser('user123', 'user@example.com', 'John Doe');

// Show messenger
await intercomService.present();

// Update user attributes
await intercomService.updateUser({ name: 'Jane Doe' });

// Logout
await intercomService.logout();
```

## 📱 Available Methods

### Core Methods
- `initialize()` - Initialize Intercom
- `loginUnidentifiedUser()` - Login guest user
- `loginUser(userId, email, name?, company?)` - Login identified user
- `updateUser(attributes)` - Update user attributes
- `logout()` - Logout user
- `present()` - Show Intercom messenger

### Configuration Methods
- `setLauncherVisibility(visibility)` - Show/hide launcher button
- `setInAppMessageVisibility(visibility)` - Show/hide in-app messages

### Utility Methods
- `isSupported()` - Check if Intercom is supported on platform
- `getInitializationStatus()` - Check if Intercom is initialized

## 🎨 Visibility Options

```tsx
import { Visibility } from '@/lib/intercom';

// Available options:
Visibility.VISIBLE    // Show
Visibility.GONE       // Hide
```

## 🔄 Automatic User Management

Your app automatically handles Intercom user management:

1. **App Launch**: Logs in unidentified user
2. **User Login**: Automatically logs in user with their details
3. **User Logout**: Automatically logs out user from Intercom

## 📍 Where to Add Intercom Buttons

### Common Locations:
1. **Settings Screen** - Help & Support section
2. **Profile Screen** - Contact support option
3. **Error States** - When something goes wrong
4. **Onboarding** - Help for new users
5. **Floating Action Button** - Always accessible help

### Example Implementation:

```tsx
// In your settings screen
import { IntercomButton } from '@/components/IntercomButton';

function SettingsScreen() {
  return (
    <View style={styles.container}>
      {/* Other settings */}
      
      <View style={styles.supportSection}>
        <Text style={styles.sectionTitle}>Support</Text>
        <IntercomButton 
          title="Get Help" 
          variant="primary" 
          size="medium" 
        />
      </View>
    </View>
  );
}
```

## 🐛 Troubleshooting

### Common Issues:

1. **Intercom not showing on web**
   - Intercom is not supported on web platform
   - The component will automatically hide itself

2. **Intercom not initializing**
   - Check your API keys in app.json
   - Ensure you're testing on a physical device or simulator
   - Check console logs for initialization errors

3. **User not logging in**
   - Ensure you're calling `loginUser` after authentication
   - Check that user ID and email are valid

### Debug Mode:

```tsx
// Enable debug logging
const { isInitialized, isSupported } = useIntercom();

console.log('Intercom supported:', isSupported);
console.log('Intercom initialized:', isInitialized);
```

## 🚀 Next Steps

1. **Add Intercom buttons** to your main screens
2. **Test user login/logout** flow
3. **Customize user attributes** based on your app's needs
4. **Set up Intercom workspace** rules and automation
5. **Configure in-app messages** and campaigns

## 📚 Additional Resources

- [Intercom React Native Documentation](https://developers.intercom.com/installing-intercom/docs/react-native-installation)
- [Intercom API Reference](https://developers.intercom.com/installing-intercom/docs/intercom-javascript-api-reference)
- [Intercom Help Center](https://www.intercom.com/help/)

## 🎯 Best Practices

1. **Always check platform support** before using Intercom
2. **Handle errors gracefully** - Intercom failures shouldn't break your app
3. **Use consistent user identification** across your app
4. **Provide clear call-to-actions** for support requests
5. **Test on both iOS and Android** devices

Your Intercom setup is now complete and ready to use! 🎉
