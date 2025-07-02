import { Platform } from 'react-native';
import Constants from 'expo-constants';

const OPENAI_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
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
    throw new Error('OpenAI API key is not set in environment variables.');
  }
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'Failed to fetch from OpenAI API');
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err: any) {
    console.error('OpenAI API error:', err);
    throw err;
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