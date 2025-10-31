# Intercom Integration Usage Guide

## Overview

Your app already has a comprehensive Intercom integration that automatically initializes when users log in. This ensures instant access to support chat without any loading delays.

## How It Works

### 1. Automatic Initialization
- When a user logs in, the `AuthContext` automatically calls `intercomService.init(session)`
- The `useIntercom` hook runs background authentication to pre-authenticate the user
- This happens seamlessly in the background, so the user doesn't experience any delays

### 2. Instant Access
- Once initialized, users can access Intercom instantly through various components
- No loading time or authentication delays when opening the chat

### 3. Fallback Handling
- If authentication fails, the system gracefully falls back to unidentified user mode
- Users can still access support, just without personalized data

## Available Components

### 1. IntercomButton
A customizable button component for triggering Intercom chat.

```tsx
import { IntercomButton } from '@/components/IntercomButton';

// Basic usage
<IntercomButton />

// Customized
<IntercomButton 
  title="Get Help"
  variant="secondary"
  size="large"
/>
```

### 2. QuickIntercomButton
A floating action button for instant access to support.

```tsx
import { QuickIntercomButton } from '@/components/QuickIntercomButton';

<QuickIntercomButton 
  size={56}
  position="bottom-right"
/>
```

### 3. IntercomIntegration
A wrapper component that adds a floating Intercom button to your app.

```tsx
import { IntercomIntegration } from '@/components/IntercomIntegration';

<IntercomIntegration showFloatingButton={true}>
  {/* Your app content */}
</IntercomIntegration>
```

### 4. HelpCenterModal
A comprehensive help center with FAQ and Intercom integration.

```tsx
import HelpCenterModal from '@/components/HelpCenterModal';

<HelpCenterModal 
  isVisible={showHelp}
  onClose={() => setShowHelp(false)}
/>
```

## Usage Examples

### 1. Add to Your Main Layout
Wrap your main app content with the IntercomIntegration component:

```tsx
// In your main layout file (e.g., app/_layout.tsx)
import { IntercomIntegration } from '@/components/IntercomIntegration';

export default function RootLayout() {
  return (
    <IntercomIntegration>
      {/* Your existing app content */}
    </IntercomIntegration>
  );
}
```

### 2. Add to Specific Screens
Add Intercom buttons to specific screens where users might need help:

```tsx
// In any screen component
import { IntercomButton } from '@/components/IntercomButton';

export default function MyScreen() {
  return (
    <View>
      {/* Your screen content */}
      
      <IntercomButton 
        title="Need Help?"
        variant="secondary"
        size="medium"
      />
    </View>
  );
}
```

### 3. Custom Implementation
Use the useIntercom hook directly for custom implementations:

```tsx
import { useIntercom } from '@/hooks/useIntercom';

export default function CustomSupportButton() {
  const { present, isLoading, isAuthenticated } = useIntercom();

  const handlePress = async () => {
    try {
      await present();
    } catch (error) {
      console.error('Failed to open Intercom:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={isLoading}>
      <Text>{isLoading ? 'Opening...' : 'Chat with Support'}</Text>
    </TouchableOpacity>
  );
}
```

## Configuration

### App Configuration
The Intercom configuration is already set up in your `app.json`:

```json
{
  "expo": {
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
}
```

### Android Configuration
The Android MainApplication is already configured with the correct API key.

## User Experience

### For Logged-in Users
1. User logs in → Intercom automatically initializes in background
2. User clicks support button → Chat opens instantly (no loading)
3. User sees personalized support with their account information

### For Unidentified Users
1. If authentication fails → System falls back to unidentified mode
2. User can still access support → Chat opens with basic functionality
3. Support agent can still help, but without user context

## Best Practices

1. **Use the floating button sparingly** - Don't add it to every screen
2. **Place strategically** - Add to screens where users are likely to need help
3. **Provide alternatives** - Use HelpCenterModal for comprehensive help
4. **Test thoroughly** - Ensure the integration works on both platforms

## Troubleshooting

### Common Issues

1. **Intercom not opening**
   - Check if user is logged in
   - Verify network connectivity
   - Check console logs for authentication errors

2. **Loading delays**
   - This shouldn't happen with the current setup
   - If it does, check if background authentication is working

3. **Authentication failures**
   - System will automatically fall back to unidentified mode
   - Check Supabase Edge Function for JWT generation

### Debug Information
Use the `useIntercom` hook to get debug information:

```tsx
const { isAuthenticated, isSupported } = useIntercom();
console.log('Intercom status:', { isAuthenticated, isSupported });
```

## Support

The Intercom integration is designed to work seamlessly with your existing authentication system. Users will have instant access to support chat without any loading delays, providing a smooth user experience.
