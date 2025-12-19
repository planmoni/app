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

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type OpenAIResponse = {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason?: string;
};

export async function getOpenAIChatCompletion({
  messages,
  model = 'gpt-3.5-turbo',
  temperature = 0.7,
  max_tokens = 2000,
  tools,
  tool_choice,
}: {
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}): Promise<OpenAIResponse> {
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

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = tool_choice || 'auto';
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'User-Agent': `Planmoni-App/${Platform.OS}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout: The request took too long to complete.');
      }
      // Re-throw network errors with more context
      if (fetchError.message?.includes('Network request failed') || fetchError.message?.includes('Failed to fetch')) {
        throw new Error('Network request failed. Please check your internet connection and try again.');
      }
      throw fetchError;
    }

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
    const message = data.choices?.[0]?.message || {};
    const content = message.content?.trim() || null;
    const tool_calls = message.tool_calls || undefined;
    const finish_reason = data.choices?.[0]?.finish_reason;
    
    if (__DEV__) {
      console.log('OpenAI API Success:', {
        contentLength: content?.length || 0,
        toolCallsCount: tool_calls?.length || 0,
        finishReason: finish_reason,
        usage: data.usage,
        platform: Platform.OS
      });
    }
    
    return {
      content,
      tool_calls,
      finish_reason,
    };
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
    if (err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
      throw new Error('Request timeout: The request took too long to complete. Please try again.');
    } else if (err.message?.includes('Network request failed') || err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
      throw new Error('API authentication failed. Please contact support.');
    } else if (err.message?.includes('403') || err.message?.includes('forbidden')) {
      throw new Error('API access forbidden. Please contact support.');
    } else if (err.message?.includes('429') || err.message?.includes('rate limit')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    } else {
      throw new Error(`AI service temporarily unavailable: ${err.message || 'Unknown error'}`);
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
    return typeof result.content === 'string' && result.content.toLowerCase().includes('hello');
  } catch (e) {
    return false;
  }
}