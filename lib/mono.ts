// Mono SDK integration for bank account linking
export interface MonoConfig {
    publicKey: string
    onSuccess: (response: any) => void
    onError: (error: any) => void
    onClose: () => void
  }
  
  export const initializeMono = (config: MonoConfig) => {
    // This would typically use the Mono React Native SDK
    // For now, we'll simulate the configuration
    return {
      ...config,
      publicKey: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY!,
    }
  }
  export const linkBankAccount = async (monoCode: string) => {
    try {
      // Call your backend to exchange mono code for account details
      const response = await fetch("/api/mono/link-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: monoCode }),
      })
  
      return await response.json()
    } catch (error) {
      throw new Error("Failed to link bank account")
    }
  }
  