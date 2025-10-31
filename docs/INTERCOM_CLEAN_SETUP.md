# Clean Intercom Setup Guide

## Overview

This is a clean, simplified Intercom integration that follows the official Intercom documentation exactly. The setup includes:

1. ✅ **Proper JWT generation** with base64url encoding
2. ✅ **Clean React Native integration** using official methods
3. ✅ **Automatic user authentication** when users log in
4. ✅ **Floating support button** for instant access

## Files Created/Updated

### 1. Edge Function (`supabase/functions/intercom-jwt/index.ts`)
- ✅ Generates proper JWT with base64url encoding
- ✅ Includes user data in JWT payload
- ✅ Handles authentication and error cases

### 2. Intercom Hook (`hooks/useIntercom.ts`)
- ✅ Simple, clean implementation
- ✅ Automatic user authentication on login
- ✅ Fallback to unidentified user if needed
- ✅ Easy-to-use `openChat()` function

### 3. Intercom Button (`components/IntercomButton.tsx`)
- ✅ Multiple variants: primary, secondary, floating
- ✅ Loading states and status indicators
- ✅ Responsive design

### 4. Configuration (`app.json`)
- ✅ Updated with correct iOS API key from Intercom dashboard
- ✅ Proper plugin configuration

## Usage

### Basic Usage
```tsx
import { IntercomButton } from '@/components/IntercomButton';

// Simple button
<IntercomButton title="Get Help" />

// Floating button
<IntercomButton variant="floating" />
```

### Using the Hook Directly
```tsx
import { useIntercom } from '@/hooks/useIntercom';

function MyComponent() {
  const { openChat, isLoading, isAuthenticated } = useIntercom();
  
  return (
    <TouchableOpacity onPress={openChat}>
      <Text>{isLoading ? 'Opening...' : 'Chat with Support'}</Text>
    </TouchableOpacity>
  );
}
```

## How It Works

1. **User Logs In** → `useIntercom` hook automatically authenticates with Intercom
2. **JWT Generation** → Edge function creates secure JWT with user data
3. **Instant Access** → Users can open chat immediately without loading delays
4. **Fallback Support** → If authentication fails, falls back to unidentified user

## Environment Variables

Make sure you have these environment variables set in your Supabase Edge Function:

```bash
INTERCOM_SECRET=your_intercom_api_secret_here
```

## Testing

1. **Deploy the Edge Function** to Supabase
2. **Test JWT generation** - should return properly formatted JWT
3. **Test Intercom integration** - should open chat instantly
4. **Verify user data** - should show user information in Intercom

## Troubleshooting

### JWT Issues
- Check that `INTERCOM_SECRET` is set correctly
- Verify JWT is base64url encoded (no `+`, `/`, or `=` characters)
- Test JWT at [jwt.io](https://jwt.io)

### Intercom Not Opening
- Check that user is logged in
- Verify network connectivity
- Check console logs for authentication errors

### User Data Not Showing
- Ensure JWT includes correct user_id
- Verify user metadata is being passed correctly
- Check Intercom dashboard for user data

## Next Steps

1. **Deploy Edge Function** to Supabase
2. **Test the integration** with a real user
3. **Customize the button** styling as needed
4. **Add to other screens** where users might need help

The integration is now clean, simple, and follows Intercom's best practices!
