declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: string;
      EXPO_PUBLIC_MONO_PUBLIC_KEY: string;
      EXPO_PUBLIC_API_URL: string;
      PAYSTACK_SECRET_KEY: string;
      DOJAH_PUBLIC_KEY: string;
      DOJAH_PRIVATE_KEY: string;
      DOJAH_APP_ID: string;
    }
  }
}

// SVG module declarations
declare module "*.svg" {
  import React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

// Ensure this file is treated as a module
export {};