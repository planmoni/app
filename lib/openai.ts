import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Enhanced API key retrieval with better error handling
const getOpenAIAPIKey = () => {
  // Try multiple sources for the API key
  const key = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY || 
              process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
              Constants.expoConfig?.extra?.OPENAI_API_KEY;
  
  if (__DEV__) {
    console.log('OpenAI API Key check:', {
      hasKey: !!key,
      keyLength: key?.length || 0,
      keyPrefix: key?.substring(0, 10) || 'none',
      source: Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY ? 'expoConfig' : 'process.env'
    });
  }
  
  return key;
};

const OPENAI_API_KEY = getOpenAIAPIKey();
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function getOpenAIChatCompletion({
  messages,
  model = 'gpt-3.5-turbo',
  temperature = 0.7,
  max_tokens = 512,
}: {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  if (!OPENAI_API_KEY) {
    const errorMsg = 'OpenAI API key is not set in environment variables.';
    console.error('OpenAI API Key Error:', {
      expoConfig: !!Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY,
      processEnv: !!process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      platform: Platform.OS,
      isDev: __DEV__
    });
    throw new Error(errorMsg);
  }

  try {
    if (__DEV__) {
      console.log('OpenAI API Request:', {
        model,
        temperature,
        max_tokens,
        messageCount: messages.length,
        platform: Platform.OS
      });
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'User-Agent': `Planmoni-App/${Platform.OS}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (__DEV__) {
      console.log('OpenAI API Response Status:', response.status);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      
      if (__DEV__) {
        console.error('OpenAI API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          platform: Platform.OS
        });
      }
      
      throw new Error(`OpenAI API Error: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (__DEV__) {
      console.log('OpenAI API Success:', {
        contentLength: content.length,
        usage: data.usage,
        platform: Platform.OS
      });
    }
    
    return content;
  } catch (err: any) {
    // Enhanced error logging for debugging
    const errorInfo = {
      message: err.message,
      name: err.name,
      platform: Platform.OS,
      isNetworkError: err.message?.includes('network') || err.message?.includes('fetch'),
      isTimeoutError: err.message?.includes('timeout'),
      isAuthError: err.message?.includes('401') || err.message?.includes('unauthorized'),
      stack: __DEV__ ? err.stack : undefined
    };
    
    console.error('OpenAI API Error Details:', errorInfo);
    
    // Re-throw with more context
    if (err.message?.includes('network') || err.message?.includes('fetch')) {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
      throw new Error('API authentication failed. Please contact support.');
    } else if (err.message?.includes('timeout')) {
      throw new Error('Request timed out. Please try again.');
    } else {
      throw new Error(`AI service temporarily unavailable: ${err.message}`);
    }
  }
}

// Test function to check if OpenAI API key and implementation are working
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const result = await getOpenAIChatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello.' }
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0,
      max_tokens: 5
    });
    return typeof result === 'string' && result.toLowerCase().includes('hello');
  } catch (e) {
    return false;
  }
}