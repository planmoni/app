import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Keyboard,
  Dimensions,
  Image,
  Button,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { Send, Sparkles, ArrowRight, Wallet, TrendingUp, Calendar, Clock, X, AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import { getOpenAIChatCompletion, testOpenAIConnection } from '../../lib/openai';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import AddPayoutAccountModal from '@/components/AddPayoutAccountModal';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { useCreatePayout } from '@/hooks/useCreatePayout';
import { formatPayoutFrequency, getDayOfWeekName } from '@/lib/formatters';
import { useBanks } from '@/hooks/useBanks';
import { getBankIconLogo } from '@/lib/bankIcons';

import { Animated, FadeIn, FadeOut, Layout } from '@/lib/reanimatedSafe';

// Define message types
type MessageType = 'text' | 'plan' | 'insight';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  type: MessageType;
  timestamp: Date;
  metadata?: any;
}

// Suggested prompts for the user
const SUGGESTED_PROMPTS = [
  "Help me plan 50k for 2 months",
  "Create a daily payout plan for 30k",
  "How can I improve my money habits?",
  "Set up daily savings for 1 week",
  "Analyze my money patterns",
];

// Helper to convert written numbers to digits (supports up to billions)
function wordsToNumber(words: string): number | null {
  const smallNumbers: { [key: string]: number } = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
  };
  const tens: { [key: string]: number } = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
  };
  const scales: { [key: string]: number } = {
    'hundred': 100, 'thousand': 1000, 'million': 1000000, 'billion': 1000000000
  };
  let result = 0;
  let current = 0;
  let found = false;
  words = words.replace(/ and /g, ' ');
  const tokens = words.toLowerCase().split(/[-\s]+/);
  for (let token of tokens) {
    if (smallNumbers[token] !== undefined) {
      current += smallNumbers[token];
      found = true;
    } else if (tens[token] !== undefined) {
      current += tens[token];
      found = true;
    } else if (token === 'a') {
      current += 1;
      found = true;
    } else if (scales[token] !== undefined) {
      if (current === 0) current = 1;
      current *= scales[token];
      result += current;
      current = 0;
      found = true;
    } else if (token === 'naira' || token === 'n' || token === '₦') {
      // skip currency
    } else if (token === 'point') {
      // handle decimals
      let decimal = '0.';
      let i = tokens.indexOf(token) + 1;
      while (i < tokens.length && smallNumbers[tokens[i]] !== undefined) {
        decimal += smallNumbers[tokens[i]].toString();
        i++;
      }
      result += parseFloat(decimal);
      break;
    }
  }
  result += current;
  return found ? result : null;
}

export default function AIAssistantScreen() {
  const { colors, isDark } = useTheme();
  const { session, isLoading: authLoading } = useAuth();
  const { balance, lockedBalance } = useBalance();
  const availableBalance = balance - (lockedBalance || 0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const windowHeight = Dimensions.get('window').height;
  const insets = useSafeAreaInsets();
  const floatingNavOffset = Math.max(insets.bottom, 12) + 64;
  const [error, setError] = useState<string | null>(null);
  
  // Rate limiting and daily limits
  const [lastPromptTime, setLastPromptTime] = useState<number>(0);
  const [dailyPromptCount, setDailyPromptCount] = useState<number>(0);
  const [lastResetDate, setLastResetDate] = useState<string>('');
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState<boolean>(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastType, setLastType] = useState<'plan' | 'insight' | 'text' | null>(null);
  // Plan creation conversational state
  const [planCreationStep, setPlanCreationStep] = useState<'idle' | 'awaiting_destination' | 'awaiting_frequency' | 'awaiting_day_of_week' | 'awaiting_emergency' | 'showing_emergency_rules' | 'confirming' | 'success'>('idle');
  const [planDraft, setPlanDraft] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const { payoutAccounts, isLoading: payoutAccountsLoading, fetchPayoutAccounts } = usePayoutAccounts();
  const [emergencyEnabled, setEmergencyEnabled] = useState<boolean | null>(null);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const { createPayout, isLoading: isCreatingPayout, error: createPayoutError } = useCreatePayout();
  const { banks } = useBanks();

  // Add frequency options
  const frequencyOptions = [
    'daily',
    'weekly',
    'specific day',
    'bi-weekly',
    'monthly',
    'month end',
    'bi-annually',
    'annually',
    'custom schedule',
  ];

  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        scrollToBottom();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Show suggestions when input field is clear (regardless of conversation history)
  useEffect(() => {
    if (!inputText.trim() && !keyboardVisible) {
      setShowSuggestions(true);
    }
  }, [inputText, keyboardVisible]);

  // Initialize rate limiting and daily limits from secure storage
  useEffect(() => {
    const initializeUsageData = async () => {
      const today = new Date().toDateString();
      const savedData = await loadUsageData();
      
      if (savedData) {
        // Check if we need to reset daily count (new day)
        if (savedData.lastResetDate !== today) {
          // New day - reset counters
          setDailyPromptCount(0);
          setLastResetDate(today);
          setLastPromptTime(0);
          setIsDailyLimitReached(false);
          // Save reset data
          await saveUsageData({
            dailyPromptCount: 0,
            lastResetDate: today,
            lastPromptTime: 0
          });
        } else {
          // Same day - restore saved data
          setDailyPromptCount(savedData.dailyPromptCount || 0);
          setLastResetDate(savedData.lastResetDate || today);
          setLastPromptTime(savedData.lastPromptTime || 0);
          setIsDailyLimitReached((savedData.dailyPromptCount || 0) >= 20);
        }
      } else {
        // No saved data - initialize with today's date
        setDailyPromptCount(0);
        setLastResetDate(today);
        setLastPromptTime(0);
        setIsDailyLimitReached(false);
        // Save initial data
        await saveUsageData({
          dailyPromptCount: 0,
          lastResetDate: today,
          lastPromptTime: 0
        });
      }
    };

    initializeUsageData();
  }, []);

  // Update secure storage when usage data changes
  useEffect(() => {
    if (lastResetDate) { // Only save after initialization
      saveUsageData({
        dailyPromptCount,
        lastResetDate,
        lastPromptTime
      });
    }
  }, [dailyPromptCount, lastResetDate, lastPromptTime]);

  // Add welcome message when component mounts
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content: `Hi ${session?.user?.user_metadata?.first_name || 'there'}! I'm your financial assistant. I can help you create payout plans, analyze your spending, and provide personalized financial advice. How can I help you today?`,
      sender: 'ai',
      type: 'text',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [session?.user?.user_metadata?.first_name]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Update handleSendMessage to intercept input for plan creation steps
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Check rate limiting first
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.canProceed) {
      // Show friendly rate limit message
      const rateLimitMessage: Message = {
        id: `rate-limit-${Date.now()}`,
        content: rateLimitCheck.message!,
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, rateLimitMessage]);
      setInputText('');
      return;
    }

    // If in a plan creation step, route input to plan step handler
    if (planCreationStep !== 'idle') {
      handlePlanStepInput(inputText.trim());
      setInputText('');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      sender: 'user',
      type: 'text',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setShowSuggestions(false);
    setIsTyping(true);
    setError(null);
    setLastUserMessage(inputText.trim());
    setLastType(null);

    // Update rate limiting counters
    const now = Date.now();
    const newCount = dailyPromptCount + 1;
    
    setLastPromptTime(now);
    setDailyPromptCount(newCount);

    // Save updated data to secure storage
    saveUsageData({
      dailyPromptCount: newCount,
      lastResetDate,
      lastPromptTime: now
    });

    // Show warning when approaching daily limit
    if (newCount === 18) {
      const warningMessage: Message = {
        id: `warning-${Date.now()}`,
        content: "Just a friendly heads up! You have 2 prompts left for today. Make them count! 😊",
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, warningMessage]);
    } else if (newCount === 19) {
      const warningMessage: Message = {
        id: `warning-${Date.now()}`,
        content: "Last prompt for today! Choose wisely! 🎯",
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, warningMessage]);
    }

    setTimeout(() => {
      generateAIResponse(userMessage.content, { availableBalance, balance, lockedBalance });
    }, 500);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
    setInputFocused(true);
    inputRef.current?.focus();
  };

  const retryLastRequest = () => {
    if (!lastUserMessage) return;
    setError(null);
    setIsTyping(true);
    if (lastType === 'plan') {
      generatePlanResponse(lastUserMessage, { availableBalance, balance, lockedBalance });
    } else if (lastType === 'insight') {
      generateInsightResponse(lastUserMessage, { availableBalance, balance, lockedBalance });
    } else {
      generateTextResponse(lastUserMessage, { availableBalance, balance, lockedBalance });
    }
  };

  const generateAIResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const lowerCaseMessage = userMessage.toLowerCase();
    
    // Check for clear plan-related keywords with context
    const hasPlanKeywords = lowerCaseMessage.includes('plan') || 
                           lowerCaseMessage.includes('budget') ||
                           lowerCaseMessage.includes('pay myself') ||
                           (lowerCaseMessage.includes('earn') && (lowerCaseMessage.includes('monthly') || lowerCaseMessage.includes('weekly')));
    
    // Check for clear insight-related keywords with context
    const hasInsightKeywords = lowerCaseMessage.includes('analyze') || 
                              lowerCaseMessage.includes('pattern') || 
                              lowerCaseMessage.includes('spending') ||
                              lowerCaseMessage.includes('habits') ||
                              lowerCaseMessage.includes('improve');
    
    // Check for specific plan patterns (amount + timeframe)
    const hasPlanPattern = /\d+[kmb]?\s*(for|over|in)\s*\d+\s*(month|week|year)/i.test(userMessage) ||
                          /plan\s+\d+[kmb]?/i.test(userMessage) ||
                          /schedule\s+\d+[kmb]?/i.test(userMessage);
    
    // Check for specific insight patterns
    const hasInsightPattern = /analyze\s+(my|your)/i.test(userMessage) ||
                             /spending\s+pattern/i.test(userMessage) ||
                             /money\s+habits/i.test(userMessage);
    
    // Prioritize specific patterns over general keywords
    if (hasPlanPattern || (hasPlanKeywords && !hasInsightKeywords)) {
      setLastType('plan');
      await generatePlanResponse(userMessage, balances);
    } 
    else if (hasInsightPattern || (hasInsightKeywords && !hasPlanKeywords)) {
      setLastType('insight');
      await generateInsightResponse(userMessage, balances);
    } 
    else {
      // For ambiguous messages, use text response which is more flexible
      setLastType('text');
      await generateTextResponse(userMessage, balances);
    }
  };

  const generateTextResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const { availableBalance, balance, lockedBalance } = balances;
    let response = "";
    try {
      const systemPrompt = `You are Planmoni, a helpful, friendly, and expert financial assistant for Nigerian users.\nUser: ${getUserName()}\nAvailable balance: ₦${availableBalance.toLocaleString()}\nTotal balance: ₦${balance.toLocaleString()}\nLocked balance: ₦${lockedBalance.toLocaleString()}\nGive advice in a conversational, encouraging, and clear way. If the user asks about their finances, use these numbers for context. If you are unsure, say so. Do not make up numbers or facts.`;
      const aiResult = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 256
      });
      response = aiResult.content || "I'm here to help with your financial planning.";
    } catch (err: any) {
      console.error('AI Text Response Error:', {
        error: err.message,
        userMessage: userMessage.substring(0, 100),
        platform: Platform.OS,
        isDev: __DEV__
      });
      
      // Provide more specific error messages based on the error type
      if (err.message?.includes('API key')) {
        setError('AI service configuration issue. Please contact support.');
        response = "I'm having trouble connecting to my AI service right now. This might be a configuration issue. Please contact our support team for assistance.";
      } else if (err.message?.includes('Network') || err.message?.includes('connection')) {
        setError('Network connection issue. Please check your internet connection.');
        response = "I'm having trouble connecting to the internet right now. Please check your connection and try again.";
      } else if (err.message?.includes('timeout')) {
        setError('Request timed out. Please try again.');
        response = "The request is taking longer than expected. Please try asking your question again.";
      } else if (err.message?.includes('authentication')) {
        setError('AI service authentication failed. Please contact support.');
        response = "I'm experiencing an authentication issue with my AI service. Please contact our support team.";
      } else {
        setError('AI service temporarily unavailable. Please try again.');
        response = "I'm temporarily unable to process your request. Please try again in a moment.";
      }
    }
    const aiMessage: Message = {
      id: Date.now().toString(),
      content: response,
      sender: 'ai',
      type: 'text',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  // Update isSimplePayoutPrompt to support k/m/b suffixes and written numbers
  const isSimplePayoutPrompt = (message: string) => {
    // Looks for patterns like 'plan 1b for 2 months', 'plan 500k for 2 months', 'plan five hundred thousand for 6 months', etc.
    const regex = /(plan|help me plan|payout|disburse|schedule)\s+((?:[₦]?[\d,.]+(?:[kKmMbB])?)|(?:a |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve |thirteen |fourteen |fifteen |sixteen |seventeen |eighteen |nineteen |twenty |thirty |forty |fifty |sixty |seventy |eighty |ninety |hundred |thousand |million |billion|and|point| )+)\s*(for|over)?\s*((?:\d+|a |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve |thirteen |fourteen |fifteen |sixteen |seventeen |eighteen |nineteen |twenty)[ ]*)\s*(month|months|week|weeks|year|years)/i;
    return regex.test(message);
  };

  const generatePlanResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const { availableBalance, balance, lockedBalance } = balances;
    let aiMessage: Message | null = null;
    // If the prompt is a simple payout plan, use hardcoded suggestions
    if (isSimplePayoutPrompt(userMessage)) {
      const targetAmount = extractAmount(userMessage) || 500000;
      const timeframe = extractTimeframe(userMessage) || 6;
      let content = `Based on your goal to schedule payouts totaling ₦${targetAmount.toLocaleString()} over ${timeframe} months, here are some flexible payout schedules you can set up:`;
      aiMessage = {
        id: Date.now().toString(),
        content,
        sender: 'ai',
        type: 'plan',
        timestamp: new Date(),
        metadata: {
          targetAmount,
          timeframe,
          plans: getPlanOptions(targetAmount, timeframe, userMessage)
        }
      };
      setMessages(prev => [...prev, aiMessage!]);
      setIsTyping(false);
      return;
    }
    try {
      // In-context examples for payout scheduling
      const examples = [
        { user: "Help me plan 150k for 3 months", ai: '{"type": "plan", "content": "Here is a payout schedule to disburse ₦150,000 over 3 months.", "metadata": {"targetAmount": 150000, "timeframe": 3, "plans": [{"title": "Monthly Payout", "amount": 50000, "frequency": "monthly", "description": "Schedule a payout of ₦50,000 every month for 3 months."}]}}' },
        { user: "I want to payout 100k weekly for 2 months", ai: '{"type": "plan", "content": "Here is your weekly payout schedule.", "metadata": {"targetAmount": 100000, "timeframe": 2, "plans": [{"title": "Weekly Payout", "amount": 12500, "frequency": "weekly", "description": "Schedule a payout of ₦12,500 every week for 2 months."}]}}' },
        { user: "Disburse 60k biweekly for 6 months", ai: '{"type": "plan", "content": "Here is your bi-weekly payout schedule.", "metadata": {"targetAmount": 60000, "timeframe": 6, "plans": [{"title": "Bi-weekly Payout", "amount": 5000, "frequency": "biweekly", "description": "Schedule a payout of ₦5,000 every two weeks for 6 months."}]}}' },
        { user: "I want to payout 10k daily for 10 days", ai: '{"type": "plan", "content": "Here is your daily payout schedule.", "metadata": {"targetAmount": 10000, "timeframe": 10, "plans": [{"title": "Daily Payout", "amount": 1000, "frequency": "daily", "description": "Schedule a payout of ₦1,000 every day for 10 days."}]}}' },
        { user: "Disburse 200k at the end of every month for 4 months", ai: '{"type": "plan", "content": "Here is your end-of-month payout schedule.", "metadata": {"targetAmount": 200000, "timeframe": 4, "plans": [{"title": "End-of-Month Payout", "amount": 50000, "frequency": "end_of_month", "description": "Schedule a payout of ₦50,000 at the end of each month for 4 months."}]}}' }
      ];
      const systemPrompt = `You are Planmoni, a helpful, friendly, and expert payout scheduling assistant for Nigerian users.\nUser: ${getUserName()}\nAvailable balance: ₦${availableBalance.toLocaleString()}\nTotal balance: ₦${balance.toLocaleString()}\nLocked balance: ₦${lockedBalance.toLocaleString()}\n\nIMPORTANT: Planmoni is a payout scheduling app. Your job is to help users plan and schedule payouts over time, regardless of their current balance. Do NOT check if the user can "afford" a payout up front. Never block or warn about insufficient balance. Always suggest flexible payout schedules, and encourage users to schedule payouts as funds become available.\n\nUse only payout, schedule, disbursement, or plan your payouts language. Never use savings or saving plan language.\n\nIf the user asks for a payout schedule, respond ONLY with a valid JSON object like this:\n{\n  \"type\": \"plan\",\n  \"content\": \"summary of the payout schedule\",\n  \"metadata\": {\n    \"targetAmount\": 1000000,\n    \"timeframe\": 6,\n    \"plans\": [ {\n      \"title\": \"Weekly Payout\",\n      \"amount\": 50000,\n      \"frequency\": \"weekly\",\n      \"description\": \"Schedule a payout of ₦50,000 every week for 6 months." } ]\n  }\n}\nDo not include any text outside the JSON.\nIf the user's available balance is low, encourage them to schedule payouts as funds become available, and offer flexible options.\nBe positive, supportive, and empowering. Never block the user from seeing a payout schedule.\n\nHere are some examples:\n${examples.map(e => `User: ${e.user}\nAI: ${e.ai}`).join('\n')}\n\nIf you are unsure, say so in the content field. Do not make up numbers or facts.`;
      const openaiResponse = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        max_tokens: 512
      });
      const openaiText = openaiResponse.content || '';
      const jsonStart = openaiText.indexOf('{');
      const jsonEnd = openaiText.lastIndexOf('}');
      let parsed: any = null;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          parsed = JSON.parse(openaiText.substring(jsonStart, jsonEnd + 1));
        } catch (e) {}
      }
      if (parsed && parsed.type === 'plan' && parsed.metadata && Array.isArray(parsed.metadata.plans)) {
        // Check if frequency is missing or ambiguous
        const planHasFrequency = parsed.metadata.plans.some((p: any) => p.frequency);
        if (!planHasFrequency) {
          // Prompt user for frequency
          setPlanDraft(parsed);
          setPlanCreationStep('awaiting_frequency');
          setMessages(prev => [
            ...prev,
            {
              id: `ask-frequency-${Date.now()}`,
              content: 'How often do you want your payouts? Please choose: weekly, specific day, bi-weekly, monthly, month end, bi-annually, annually, or custom schedule.',
              sender: 'ai',
              type: 'text',
              timestamp: new Date(),
              metadata: { step: 'frequency' }
            }
          ]);
          return;
        }
        aiMessage = {
          id: Date.now().toString(),
          content: parsed.content || 'Here is a personalized payout schedule for you:',
          sender: 'ai',
          type: 'plan',
          timestamp: new Date(),
          metadata: parsed.metadata
        };
      } else {
        // Handle invalid or ambiguous AI response gracefully
        console.warn('AI returned invalid response for plan request:', {
          userMessage: userMessage.substring(0, 100),
          aiResponse: openaiText.substring(0, 200),
          parsed: parsed,
          platform: Platform.OS
        });
        
        // Provide a helpful fallback response instead of throwing an error
        aiMessage = {
          id: Date.now().toString(),
          content: "I'd be happy to help you create a payout plan! Could you please be more specific about what you'd like to plan? For example:\n\n• \"Plan 50k for 3 months\"\n• \"Create a weekly payout schedule for 100k\"\n• \"Help me plan 200k over 6 months\"\n\nWhat amount and timeframe are you thinking about?",
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        };
      }
    } catch (err: any) {
      console.error('AI Plan Response Error:', {
        error: err.message,
        userMessage: userMessage.substring(0, 100),
        platform: Platform.OS,
        isDev: __DEV__
      });
      
      // Provide more specific error messages based on the error type
      if (err.message?.includes('API key')) {
        setError('AI service configuration issue. Please contact support.');
      } else if (err.message?.includes('Network') || err.message?.includes('connection')) {
        setError('Network connection issue. Please check your internet connection.');
      } else if (err.message?.includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else if (err.message?.includes('authentication')) {
        setError('AI service authentication failed. Please contact support.');
      } else {
        setError('AI service temporarily unavailable. Please try again.');
      }
    }
    if (!aiMessage && !error) {
      const targetAmount = extractAmount(userMessage) || 500000;
      const timeframe = extractTimeframe(userMessage) || 6;
      let content = `Based on your goal to schedule payouts totaling ₦${targetAmount.toLocaleString()} over ${timeframe} months, here are some flexible payout schedules you can set up:`;
      content += `\n\nYou can always adjust your payout schedule as your needs or available funds change. Planmoni makes it easy to stay on track!`;
      aiMessage = {
        id: Date.now().toString(),
        content,
        sender: 'ai',
        type: 'plan',
        timestamp: new Date(),
        metadata: {
          targetAmount,
          timeframe,
          plans: getPlanOptions(targetAmount, timeframe, userMessage)
        }
      };
    }
    if (aiMessage) setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  // Helper to determine if the user was specific about payout schedule
  const extractFrequency = (message: string): 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'end_of_month' | 'first_of_month' | null => {
    const lower = message.toLowerCase();
    if (lower.includes('daily') || lower.includes('every day')) return 'daily';
    if (lower.includes('weekly')) return 'weekly';
    if (lower.includes('biweekly') || lower.includes('bi-weekly') || lower.includes('every two weeks')) return 'biweekly';
    if (lower.includes('end of month') || lower.includes('end-of-month')) return 'end_of_month';
    if (lower.includes('first of month') || lower.includes('first-of-month')) return 'first_of_month';
    if (lower.includes('monthly')) return 'monthly';
    return null;
  };

  // Helper to generate plan options
  const getPlanOptions = (targetAmount: number, timeframe: number, userMessage?: string) => {
    const monthlyAmount = Math.ceil(targetAmount / timeframe);
    const weeklyAmount = Math.ceil(monthlyAmount / 4.33);
    const biweeklyAmount = Math.ceil(monthlyAmount / 2);
    const endOfMonthAmount = Math.ceil(targetAmount / timeframe);
    const firstOfMonthAmount = Math.ceil(targetAmount / timeframe);
    const freq = userMessage ? extractFrequency(userMessage) : null;
    
    // Calculate daily amounts for different durations
    const dailyAmount7 = Math.ceil(targetAmount / 7);
    const dailyAmount30 = Math.ceil(targetAmount / 30);
    const dailyAmount90 = Math.ceil(targetAmount / 90);
    
    if (freq === 'daily') {
      // Provide multiple daily options
      return [
        {
          title: "Daily Payout (7 days)",
          amount: dailyAmount7,
          frequency: "daily",
          duration: 7,
          description: `Schedule a payout of ₦${dailyAmount7.toLocaleString()} every day for 7 days.`
        },
        {
          title: "Daily Payout (30 days)",
          amount: dailyAmount30,
          frequency: "daily",
          duration: 30,
          description: `Schedule a payout of ₦${dailyAmount30.toLocaleString()} every day for 30 days.`
        },
        {
          title: "Daily Payout (90 days)",
          amount: dailyAmount90,
          frequency: "daily",
          duration: 90,
          description: `Schedule a payout of ₦${dailyAmount90.toLocaleString()} every day for 90 days.`
        }
      ];
    } else if (freq === 'weekly') {
      return [
        {
          title: "Weekly Payout",
          amount: weeklyAmount,
          frequency: "weekly",
          description: `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${timeframe} months.`
        }
      ];
    } else if (freq === 'biweekly') {
      return [
        {
          title: "Bi-weekly Payout",
          amount: biweeklyAmount,
          frequency: "biweekly",
          description: `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${timeframe} months.`
        }
      ];
    } else if (freq === 'monthly') {
      return [
        {
          title: "Monthly Payout",
          amount: monthlyAmount,
          frequency: "monthly",
          description: `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${timeframe} months.`
        }
      ];
    } else if (freq === 'end_of_month') {
      return [
        {
          title: "End-of-Month Payout",
          amount: endOfMonthAmount,
          frequency: "end_of_month",
          description: `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${timeframe} months.`
        }
      ];
    } else if (freq === 'first_of_month') {
      return [
        {
          title: "First-of-Month Payout",
          amount: firstOfMonthAmount,
          frequency: "first_of_month",
          description: `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${timeframe} months.`
        }
      ];
    }
    // Default: show all options including daily
    return [
      {
        title: "Daily Payout (7 days)",
        amount: dailyAmount7,
        frequency: "daily",
        duration: 7,
        description: `Schedule a payout of ₦${dailyAmount7.toLocaleString()} every day for 7 days.`
      },
      {
        title: "Daily Payout (30 days)",
        amount: dailyAmount30,
        frequency: "daily",
        duration: 30,
        description: `Schedule a payout of ₦${dailyAmount30.toLocaleString()} every day for 30 days.`
      },
      {
        title: "Weekly Payout",
        amount: weeklyAmount,
        frequency: "weekly",
        description: `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${timeframe} months.`
      },
      {
        title: "Bi-weekly Payout",
        amount: biweeklyAmount,
        frequency: "biweekly",
        description: `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${timeframe} months.`
      },
      {
        title: "Monthly Payout",
        amount: monthlyAmount,
        frequency: "monthly",
        description: `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${timeframe} months.`
      },
      {
        title: "End-of-Month Payout",
        amount: endOfMonthAmount,
        frequency: "end_of_month",
        description: `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${timeframe} months.`
      },
      {
        title: "First-of-Month Payout",
        amount: firstOfMonthAmount,
        frequency: "first_of_month",
        description: `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${timeframe} months.`
      }
    ];
  };

  const generateInsightResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const { availableBalance, balance, lockedBalance } = balances;
    let aiMessage: Message | null = null;
    try {
      const systemPrompt = `You are Planmoni, a helpful, friendly, and expert financial assistant for Nigerian users.\nUser: ${getUserName()}\nAvailable balance: ₦${availableBalance.toLocaleString()}\nTotal balance: ₦${balance.toLocaleString()}\nLocked balance: ₦${lockedBalance.toLocaleString()}\nIf the user asks for financial insights or analysis, respond ONLY with a valid JSON object like this:\n{\n  \"type\": \"insight\",\n  \"content\": \"summary of the insights\",\n  \"metadata\": {\n    \"insights\": [ {\n      \"title\": \"...\", \"value\": \"...\", \"change\": \"...\", \"description\": \"...\" } ],\n    \"recommendations\": [ \"...\" ]\n  }\n}\nDo not include any text outside the JSON.\nIf the user's available balance is low, provide supportive, actionable advice to help them improve. If the available balance is high, suggest ways to optimize, invest, or grow their finances. Always be positive, supportive, and never block the user from seeing insights. Do not make up numbers or facts.`;
      const openaiResponse = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        max_tokens: 512
      });
      const openaiText = openaiResponse.content || '';
      const jsonStart = openaiText.indexOf('{');
      const jsonEnd = openaiText.lastIndexOf('}');
      let parsed: any = null;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          parsed = JSON.parse(openaiText.substring(jsonStart, jsonEnd + 1));
        } catch (e) {}
      }
      if (parsed && parsed.type === 'insight' && parsed.metadata && Array.isArray(parsed.metadata.insights)) {
        aiMessage = {
          id: Date.now().toString(),
          content: parsed.content || 'Here are some insights based on your finances:',
          sender: 'ai',
          type: 'insight',
          timestamp: new Date(),
          metadata: parsed.metadata
        };
      } else {
        // Handle invalid or ambiguous AI response gracefully
        console.warn('AI returned invalid response for insight request:', {
          userMessage: userMessage.substring(0, 100),
          aiResponse: openaiText.substring(0, 200),
          parsed: parsed,
          platform: Platform.OS
        });
        
        // Provide a helpful fallback response instead of throwing an error
        aiMessage = {
          id: Date.now().toString(),
          content: "I'd be happy to help you analyze your finances! Could you please be more specific about what you'd like to know? For example:\n\n• \"Analyze my spending patterns\"\n• \"How can I improve my money habits?\"\n• \"What are my financial insights?\"\n\nWhat specific aspect of your finances would you like me to help you with?",
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        };
      }
    } catch (err: any) {
      console.error('AI Insight Response Error:', {
        error: err.message,
        userMessage: userMessage.substring(0, 100),
        platform: Platform.OS,
        isDev: __DEV__
      });
      
      // Provide more specific error messages based on the error type
      if (err.message?.includes('API key')) {
        setError('AI service configuration issue. Please contact support.');
      } else if (err.message?.includes('Network') || err.message?.includes('connection')) {
        setError('Network connection issue. Please check your internet connection.');
      } else if (err.message?.includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else if (err.message?.includes('authentication')) {
        setError('AI service authentication failed. Please contact support.');
      } else {
        setError('AI service temporarily unavailable. Please try again.');
      }
    }
    if (!aiMessage && !error) {
      // fallback local logic
      const monthlyExpense = Math.max(availableBalance * 0.3, 100000);
      const monthsCovered = availableBalance > 0 ? (availableBalance / monthlyExpense) : 0;
      const insights = [
        {
          title: "Spending Pattern",
          value: availableBalance < 50000 ? "Tight" : availableBalance > 500000 ? "Healthy" : "Moderate",
          change: availableBalance > 500000 ? "+10%" : availableBalance < 50000 ? "-20%" : "-5%",
          description: availableBalance < 50000
            ? "Your spending is outpacing your savings. Consider reviewing your monthly expenses."
            : availableBalance > 500000
              ? "You're maintaining a healthy spending pattern. Keep it up!"
              : "Your spending is fairly balanced, but there's room for improvement."
        },
        {
          title: "Locked Funds",
          value: `₦${(lockedBalance || 0).toLocaleString()}`,
          change: lockedBalance > 0 ? "+5%" : "0%",
          description: lockedBalance > 0
            ? "Some of your funds are currently locked in plans or pending transactions."
            : "All your funds are available for use."
        },
        {
          title: "Emergency Fund",
          value: `₦${availableBalance.toLocaleString()}`,
          change: `${monthsCovered.toFixed(1)} months covered`,
          description: monthsCovered < 1
            ? "Your emergency fund covers less than a month of expenses. Aim for at least 3-6 months."
            : monthsCovered < 3
              ? `Your emergency fund covers about ${monthsCovered.toFixed(1)} months. Consider increasing it for better security.`
              : `Great! Your emergency fund covers over ${monthsCovered.toFixed(1)} months of expenses.`
        }
      ];
      const recommendations = [
        availableBalance < 100000 ? "Try reducing discretionary spending this month. Start small and build up your savings!" : "Consider automating your savings for consistency and explore investment opportunities.",
        monthsCovered < 3 ? "Aim to build your emergency fund to cover at least 3 months of expenses. Every little bit helps!" : "Explore investment options for surplus funds to grow your wealth.",
        lockedBalance > 0 ? "Review your locked funds to ensure they align with your goals. Stay on track!" : "All your funds are available for new plans. Keep up the good work!"
      ];
      aiMessage = {
        id: Date.now().toString(),
        content: "I've analyzed your financial data and here are some insights:",
        sender: 'ai',
        type: 'insight',
        timestamp: new Date(),
        metadata: {
          insights,
          recommendations
        }
      };
    }
    if (aiMessage) setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  // Helper functions to extract information from user messages
  const extractAmount = (message: string): number | null => {
    // Normalize message
    let normalized = message.toLowerCase().replace(/[,₦]/g, ' ');
    // 1. Try to match numeric forms with optional k/m/b suffix
    const regex = /([0-9]+(?:\.[0-9]+)?)(k|m|b)?\s*(naira|n)?/i;
    const match = normalized.match(regex);
    if (match) {
      let amount = parseFloat(match[1]);
      const suffix = match[2]?.toLowerCase();
      if (suffix === 'k') amount *= 1000;
      if (suffix === 'm') amount *= 1000000;
      if (suffix === 'b') amount *= 1000000000;
      return Math.round(amount);
    }
    // 2. Try to match numbers with commas/decimals (e.g., 1,000,000.00)
    const commaRegex = /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)/;
    const commaMatch = normalized.match(commaRegex);
    if (commaMatch) {
      let amount = parseFloat(commaMatch[1].replace(/,/g, ''));
      return Math.round(amount);
    }
    // 3. Try to match written numbers (e.g., 'five hundred thousand naira', 'a million')
    const writtenRegex = /((?:a |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve |thirteen |fourteen |fifteen |sixteen |seventeen |eighteen |nineteen |twenty |thirty |forty |fifty |sixty |seventy |eighty |ninety |hundred |thousand |million |billion|and|point| )+)/i;
    const writtenMatch = normalized.match(writtenRegex);
    if (writtenMatch) {
      const num = wordsToNumber(writtenMatch[1].trim());
      if (num !== null) return Math.round(num);
    }
    // 4. Try to match 'a million', 'a thousand', etc.
    if (/a million/.test(normalized)) return 1000000;
    if (/a thousand/.test(normalized)) return 1000;
    // 5. Try to match currency at the end (e.g., '500,000 naira')
    const endCurrencyRegex = /([0-9]+(?:\.[0-9]+)?)\s*(naira|n)$/i;
    const endCurrencyMatch = normalized.match(endCurrencyRegex);
    if (endCurrencyMatch) {
      return Math.round(parseFloat(endCurrencyMatch[1]));
    }
    return null;
  };

  const extractTimeframe = (message: string): number | null => {
    // Map written numbers to digits
    const numberWords: { [key: string]: number } = {
      'one': 1,
      'two': 2,
      'three': 3,
      'four': 4,
      'five': 5,
      'six': 6,
      'seven': 7,
      'eight': 8,
      'nine': 9,
      'ten': 10,
      'eleven': 11,
      'twelve': 12,
      'thirteen': 13,
      'fourteen': 14,
      'fifteen': 15,
      'sixteen': 16,
      'seventeen': 17,
      'eighteen': 18,
      'nineteen': 19,
      'twenty': 20
    };
    let normalized = message.toLowerCase();
    // Replace written numbers with digits
    Object.entries(numberWords).forEach(([word, digit]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      normalized = normalized.replace(regex, digit.toString());
    });
    // Look for time periods like "6 months", "1 year", etc.
    const monthRegex = /(\d+)\s*(month|months)/i;
    const yearRegex = /(\d+)\s*(year|years)/i;
    const monthMatch = normalized.match(monthRegex);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }
    const yearMatch = normalized.match(yearRegex);
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 12;
    }
    // Check for month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < months.length; i++) {
      if (normalized.includes(months[i])) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const targetMonth = i;
        // Calculate months difference, accounting for next year if needed
        let monthsDiff = targetMonth - currentMonth;
        if (monthsDiff <= 0) {
          monthsDiff += 12; // Target is next year
        }
        return monthsDiff;
      }
    }
    return null;
  };

  // Intercept Create Plan to start conversational flow
  const handleCreatePlan = (plan: any) => {
    // Calculate total plan amount
    let totalPlanAmount = 0;
    if (plan.metadata && plan.metadata.targetAmount) {
      totalPlanAmount = plan.metadata.targetAmount;
    } else if (plan.metadata && Array.isArray(plan.metadata.plans)) {
      totalPlanAmount = plan.metadata.plans.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    } else if (plan.amount) {
      totalPlanAmount = plan.amount;
    }
    if (totalPlanAmount > availableBalance) {
      const shortfall = Math.max(totalPlanAmount - availableBalance, 0);
      setMessages(prev => [
        ...prev,
        {
          id: `insufficient-funds-${Date.now()}`,
          content: `You do not have enough funds (₦${availableBalance.toLocaleString()}) to create this plan. Total needed: ₦${totalPlanAmount.toLocaleString()}. You need to add ₦${shortfall.toLocaleString()} more.`,
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'insufficient_funds', planAmount: totalPlanAmount, availableBalance, shortfall }
        }
      ]);
      return;
    }
    setPlanDraft(plan);
    setPlanCreationStep('awaiting_destination');
    setMessages(prev => [
      ...prev,
      {
        id: `choose-destination-${Date.now()}`,
        content: 'Which account should receive your payouts? Please select an existing account or add a new one.',
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
        metadata: { step: 'destination' }
      }
    ]);
  };

  // Handle user selecting a payout account
  const handleSelectAccount = (account: any) => {
    setSelectedAccount(account);
    setPlanCreationStep('awaiting_emergency');
    setMessages(prev => [
      ...prev,
      {
        id: `selected-destination-${Date.now()}`,
        content: `Payouts will be sent to: ${account.bank_name} ••••${account.account_number.slice(-4)} (${account.account_name})`,
        sender: 'user',
        type: 'text',
        timestamp: new Date(),
        metadata: { step: 'destination' }
      },
      {
        id: `ask-emergency-${Date.now()}`,
        content: 'Do you want to enable emergency withdrawals for this plan? (yes/no)',
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
        metadata: { step: 'emergency' }
      }
    ]);
  };

  // Handle user response to emergency withdrawal
  const handleEmergencyResponse = (response: string) => {
    const normalized = response.trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'y') {
      setEmergencyEnabled(true);
      setPlanCreationStep('showing_emergency_rules');
      setMessages(prev => [
        ...prev,
        {
          id: `emergency-yes-${Date.now()}`,
          content: 'Yes, enable emergency withdrawals.',
          sender: 'user',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'emergency' }
        },
        {
          id: `emergency-rules-${Date.now()}`,
          content: 'Emergency Withdrawal Rules:\n- Instant withdrawal: 12% processing fee\n- 24-hour withdrawal: 6% processing fee\n- 72-hour withdrawal: No processing fee',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'emergency_rules' }
        },
        {
          id: `confirm-plan-${Date.now()}`,
          content: 'Ready to create your plan? Type "confirm" to proceed or "cancel" to abort.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'confirm' }
        }
      ]);
      setPlanCreationStep('confirming');
    } else if (normalized === 'no' || normalized === 'n') {
      setEmergencyEnabled(false);
      setMessages(prev => [
        ...prev,
        {
          id: `emergency-no-${Date.now()}`,
          content: 'No, do not enable emergency withdrawals.',
          sender: 'user',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'emergency' }
        },
        {
          id: `confirm-plan-${Date.now()}`,
          content: 'Ready to create your plan? Type "confirm" to proceed or "cancel" to abort.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'confirm' }
        }
      ]);
      setPlanCreationStep('confirming');
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `emergency-invalid-${Date.now()}`,
          content: 'Please reply with "yes" or "no" to enable or disable emergency withdrawals.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'emergency' }
        }
      ]);
    }
  };

  // Handle user confirmation to create the plan
  const handlePlanConfirmation = async (response: string) => {
    const normalized = response.trim().toLowerCase();
    if (normalized === 'confirm') {
      if (!planDraft || !selectedAccount) {
        setMessages(prev => [
          ...prev,
          {
            id: `plan-error-${Date.now()}`,
            content: 'Error: Missing plan details or account selection. Please try again.',
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'error' }
          }
        ]);
        return;
      }

      try {
        // Extract plan details
        const plan = planDraft.metadata?.plans?.[0] || planDraft;
        const targetAmount = planDraft.metadata?.targetAmount || plan.amount || 0;
        const timeframe = planDraft.metadata?.timeframe || 1;
        
        // Calculate payout amount and duration
        const payoutAmount = Math.ceil(targetAmount / timeframe);
        let duration = timeframe;
        
        // Map frequency to database format
        let frequency: any = 'monthly';
        let dayOfWeek: number | undefined;
        
        switch (plan.frequency) {
          case 'daily':
            frequency = 'daily';
            // Use the duration from the plan if available, otherwise calculate from timeframe
            duration = plan.duration || Math.ceil(timeframe * 30); // Default to days if timeframe is in months
            break;
          case 'weekly':
            frequency = 'weekly';
            break;
          case 'bi-weekly':
          case 'biweekly':
            frequency = 'biweekly';
            break;
          case 'monthly':
            frequency = 'monthly';
            break;
          case 'specific day':
            frequency = 'weekly_specific';
            dayOfWeek = selectedDayOfWeek !== null ? selectedDayOfWeek : 1; // Use selected day or default to Monday
            break;
          case 'month end':
            frequency = 'end_of_month';
            break;
          case 'bi-annually':
          case 'biannual':
            frequency = 'biannual';
            break;
          case 'annually':
            frequency = 'annually';
            break;
          default:
            frequency = 'monthly';
        }

        // Calculate start date (next occurrence based on frequency)
        const today = new Date();
        let startDate = today.toISOString().split('T')[0];
        
        if (frequency === 'weekly_specific' && dayOfWeek !== undefined) {
          const currentDay = today.getDay();
          let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
          if (daysToAdd === 0) daysToAdd = 7; // If today is the selected day, schedule for next week
          const nextDate = new Date(today);
          nextDate.setDate(today.getDate() + daysToAdd);
          startDate = nextDate.toISOString().split('T')[0];
        }

        // Create the payout plan using the existing hook
        await createPayout({
          name: `${formatPayoutFrequency(frequency, dayOfWeek)} Payout Plan`,
          description: `${formatPayoutFrequency(frequency, dayOfWeek)} payout of ₦${payoutAmount.toLocaleString()}`,
          totalAmount: targetAmount,
          payoutAmount: payoutAmount,
          frequency: frequency,
          dayOfWeek: dayOfWeek,
          duration: duration,
          startDate: startDate,
          bankAccountId: null, // We're using payout accounts
          payoutAccountId: selectedAccount.id,
          customDates: [],
          emergencyWithdrawalEnabled: emergencyEnabled || false
        });

        // Success message
        setMessages(prev => [
          ...prev,
          {
            id: `plan-confirmed-${Date.now()}`,
            content: 'Your payout plan has been created successfully! 🎉 You will be redirected to the success page.',
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'success' }
          }
        ]);

        // Reset state after a delay
        setTimeout(() => {
          setPlanCreationStep('idle');
          setPlanDraft(null);
          setSelectedAccount(null);
          setEmergencyEnabled(null);
          setSelectedDayOfWeek(null);
        }, 2000);

      } catch (error) {
        console.error('Error creating payout plan:', error);
        setMessages(prev => [
          ...prev,
          {
            id: `plan-error-${Date.now()}`,
            content: `Failed to create payout plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'error' }
          }
        ]);
      }
    } else if (normalized === 'cancel') {
      setPlanCreationStep('idle');
      setPlanDraft(null);
      setSelectedAccount(null);
      setEmergencyEnabled(null);
      setSelectedDayOfWeek(null);
      setMessages(prev => [
        ...prev,
        {
          id: `plan-cancelled-${Date.now()}`,
          content: 'Plan creation cancelled.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'cancelled' }
        }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `confirm-invalid-${Date.now()}`,
          content: 'Please type "confirm" to create the plan or "cancel" to abort.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'confirm' }
        }
      ]);
    }
  };

  // Handle user reply for frequency
  const handleFrequencyResponse = (response: string) => {
    const normalized = response.trim().toLowerCase();
    // Try to match to one of the options
    const matched = frequencyOptions.find(opt => normalized.includes(opt.replace(/[- ]/g, '')) || normalized === opt.replace(/[- ]/g, ''));
    
    if (matched && planDraft) {
      // Update planDraft with selected frequency
      const updatedPlan = { ...planDraft };
      if (updatedPlan.metadata && Array.isArray(updatedPlan.metadata.plans)) {
        updatedPlan.metadata.plans = updatedPlan.metadata.plans.map((p: any) => ({ ...p, frequency: matched }));
      }
      setPlanDraft(updatedPlan);
      
      // If specific day is selected, ask for the day of week
      if (matched === 'specific day') {
        setPlanCreationStep('awaiting_day_of_week');
        setMessages(prev => [
          ...prev,
          {
            id: `selected-frequency-${Date.now()}`,
            content: `Payout frequency set to: ${matched}`,
            sender: 'user',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'frequency' }
          },
          {
            id: `choose-day-${Date.now()}`,
            content: 'Which day of the week do you want your payouts? Please choose: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday.',
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'day_of_week' }
          }
        ]);
      } else {
        setPlanCreationStep('awaiting_destination');
        setMessages(prev => [
          ...prev,
          {
            id: `selected-frequency-${Date.now()}`,
            content: `Payout frequency set to: ${matched}`,
            sender: 'user',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'frequency' }
          },
          {
            id: `choose-destination-${Date.now()}`,
            content: 'Which account should receive your payouts? Please select an existing account or add a new one.',
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'destination' }
          }
        ]);
      }
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `frequency-invalid-${Date.now()}`,
          content: 'Please reply with one of: weekly, specific day, bi-weekly, monthly, month end, bi-annually, annually, or custom schedule.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'frequency' }
        }
      ]);
    }
  };

  // Handle day of week selection
  const handleDayOfWeekResponse = (response: string) => {
    const normalized = response.trim().toLowerCase();
    const dayMap: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    const dayNumber = dayMap[normalized];
    if (dayNumber !== undefined) {
      setSelectedDayOfWeek(dayNumber);
      setPlanCreationStep('awaiting_destination');
      setMessages(prev => [
        ...prev,
        {
          id: `selected-day-${Date.now()}`,
          content: `Payout day set to: ${getDayOfWeekName(dayNumber)}`,
          sender: 'user',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'day_of_week' }
        },
        {
          id: `choose-destination-${Date.now()}`,
          content: 'Which account should receive your payouts? Please select an existing account or add a new one.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'destination' }
        }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `day-invalid-${Date.now()}`,
          content: 'Please reply with one of: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'day_of_week' }
        }
      ]);
    }
  };

  // Update handlePlanStepInput to handle frequency step
  const handlePlanStepInput = (input: string) => {
    if (planCreationStep === 'awaiting_frequency') {
      handleFrequencyResponse(input);
    } else if (planCreationStep === 'awaiting_day_of_week') {
      handleDayOfWeekResponse(input);
    } else if (planCreationStep === 'awaiting_emergency') {
      handleEmergencyResponse(input);
    } else if (planCreationStep === 'confirming') {
      handlePlanConfirmation(input);
    }
  };

  const getUserName = () => session?.user?.user_metadata?.first_name || 'User';

  // Secure storage helper functions
  const saveUsageData = async (data: { dailyPromptCount: number; lastResetDate: string; lastPromptTime: number }) => {
    try {
      await SecureStore.setItemAsync('ai_usage_data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  };

  const loadUsageData = async () => {
    try {
      const data = await SecureStore.getItemAsync('ai_usage_data');
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    }
    return null;
  };

  const clearUsageData = async () => {
    try {
      await SecureStore.deleteItemAsync('ai_usage_data');
    } catch (error) {
      console.error('Failed to clear usage data:', error);
    }
  };

  // Rate limiting check
  const checkRateLimit = (): { canProceed: boolean; message?: string } => {
    const now = Date.now();
    const timeSinceLastPrompt = now - lastPromptTime;
    const minInterval = 2000; // 2 seconds between prompts
    
    // Check if user is sending prompts too frequently
    if (timeSinceLastPrompt < minInterval) {
      const remainingTime = Math.ceil((minInterval - timeSinceLastPrompt) / 1000);
      return {
        canProceed: false,
        message: `Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before sending another message. I need a moment to process your requests properly! 😊`
      };
    }
    
    // Check daily limit
    if (isDailyLimitReached) {
      return {
        canProceed: false,
        message: `You've reached your daily limit of 20 prompts! 🎉 That's quite a productive day! Come back tomorrow and I'll be here to help you with more financial planning. In the meantime, feel free to explore the other features of the app!`
      };
    }
    
    return { canProceed: true };
  };

  // Function to close input and dismiss keyboard
  const closeInput = () => {
    setInputFocused(false);
    setInputText('');
    setShowSuggestions(true);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  // Debug function to test AI connection
  const testAIConnection = async () => {
    try {
      console.log('Testing AI connection...');
      const isConnected = await testOpenAIConnection();
      console.log('AI Connection Test Result:', isConnected);
      
      if (isConnected) {
        setMessages(prev => [...prev, {
          id: `debug-${Date.now()}`,
          content: '✅ AI connection test successful! The AI service is working properly.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `debug-${Date.now()}`,
          content: '❌ AI connection test failed. There may be an issue with the AI service configuration.',
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      console.error('AI Connection Test Error:', error);
      setMessages(prev => [...prev, {
        id: `debug-error-${Date.now()}`,
        content: `❌ AI connection test error: ${error.message}`,
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      }]);
    }
  };

  // Debug function to reset usage data (for testing)
  const resetUsageData = async () => {
    try {
      await clearUsageData();
      const today = new Date().toDateString();
      setDailyPromptCount(0);
      setLastResetDate(today);
      setLastPromptTime(0);
      setIsDailyLimitReached(false);
      
      setMessages(prev => [...prev, {
        id: `debug-reset-${Date.now()}`,
        content: '🔄 Usage data reset successfully! Daily limits have been cleared.',
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      console.error('Reset Usage Data Error:', error);
      setMessages(prev => [...prev, {
        id: `debug-reset-error-${Date.now()}`,
        content: `❌ Failed to reset usage data: ${error.message}`,
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      }]);
    }
  };



  const renderMessage = (message: Message, index: number) => {
    const isUser = message.sender === 'user';
    
    // Render different message types
    switch (message.type) {
      case 'text':
        // Check for insufficient funds step
        if (message.metadata && message.metadata.step === 'insufficient_funds') {
          return (
            <Animated.View 
              key={message.id} 
              entering={FadeIn.duration(300)} 
              layout={Layout.springify()}
              style={[
                styles.messageBubble,
                styles.aiBubble,
                { backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary }
              ]}
            >
              <Text style={[styles.messageText, styles.aiText, { color: colors.text }]}> 
                {message.content}
              </Text>
              <TouchableOpacity
                style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start' }}
                onPress={handleAddFunds}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 20 }}>Add Funds</Text>
              </TouchableOpacity>
              <View style={styles.aiBadgeContainer}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={styles.aiBadgeText}>Planmoni AI</Text>
              </View>
            </Animated.View>
          );
        }
        return (
          <Animated.View 
            key={message.id} 
            entering={FadeIn.duration(300)} 
            layout={Layout.springify()}
            style={[
              styles.messageBubble,
              isUser ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary }]
            ]}
          >
            <Text style={[
              styles.messageText,
              isUser ? styles.userText : [styles.aiText, { color: colors.text }]
            ]}>
              {message.content}
            </Text>
            {!isUser && (
              <View style={styles.aiBadgeContainer}>
              </View>
            )}
          </Animated.View>
        );
        
      case 'plan':
        return (
          <Animated.View 
            key={message.id} 
            entering={FadeIn.duration(300)} 
            layout={Layout.springify()}
            style={[
              styles.messageBubble,
              styles.aiBubble,
              styles.planBubble,
              { backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary }
            ]}
          >
            <Text style={[styles.messageText, styles.aiText, { color: colors.text }]}>
              {message.content}
            </Text>
            
            <View style={styles.planOptions}>
              {message.metadata.plans.map((plan: any, i: number) => (
                <View key={i} style={[styles.planOption, { backgroundColor: isDark ? colors.backgroundSecondary : colors.card }]}>
                  <View style={styles.planHeader}>
                    <View style={styles.planTitleContainer}>
                      <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                      <Text style={[styles.planAmount, { color: colors.primary }]}>
                        ₦{plan.amount.toLocaleString()}
                      </Text>
                    </View>
                    {plan.frequency === 'daily' && <Clock size={20} color={colors.primary} />}
                    {plan.frequency === 'weekly' && <Clock size={20} color={colors.primary} />}
                    {plan.frequency === 'biweekly' && <Clock size={20} color={colors.primary} />}
                    {plan.frequency === 'monthly' && <Clock size={20} color={colors.primary} />}
                    {plan.frequency === 'end_of_month' && <Clock size={20} color={colors.primary} />}
                    {plan.frequency === 'first_of_month' && <Clock size={20} color={colors.primary} />}
                  </View>
                  
                  <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                    {plan.description}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.planButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleCreatePlan({...plan, metadata: message.metadata})}
                  >
                    <Text style={styles.planButtonText}>Create Plan</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.aiBadgeContainer}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={styles.aiBadgeText}>Planmoni AI</Text>
            </View>
          </Animated.View>
        );
        
      case 'insight':
        return (
          <Animated.View 
            key={message.id} 
            entering={FadeIn.duration(300)} 
            layout={Layout.springify()}
            style={[
              styles.messageBubble,
              styles.aiBubble,
              styles.insightBubble,
              { backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary }
            ]}
          >
            <Text style={[styles.messageText, styles.aiText, { color: colors.text }]}>
              {message.content}
            </Text>
            
            <View style={styles.insightsContainer}>
              {message.metadata.insights.map((insight: any, i: number) => (
                <View key={i} style={[styles.insightCard, { backgroundColor: isDark ? colors.backgroundSecondary : colors.card }]}>
                  <View style={styles.insightHeader}>
                    <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
                    <Text style={[styles.insightValue, { color: colors.primary }]}>{insight.value}</Text>
                  </View>
                  <Text style={[styles.insightDescription, { color: colors.textSecondary }]}>
                    {insight.description}
                  </Text>
                </View>
              ))}
            </View>
            
            <View style={styles.recommendationsContainer}>
              <Text style={[styles.recommendationsTitle, { color: colors.text }]}>Recommendations:</Text>
              {message.metadata.recommendations.map((recommendation: string, i: number) => (
                <View key={i} style={styles.recommendationItem}>
                  <View style={[styles.recommendationBullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                    {recommendation}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.aiBadgeContainer}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={styles.aiBadgeText}>Planmoni AI</Text>
            </View>
          </Animated.View>
        );
        
      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    authGateContainer: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    authGateTitle: {
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 24,
    },
    authGateSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: 12,
    },
    authGatePrimary: {
      marginTop: 28,
      width: '100%',
      maxWidth: 360,
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
    },
    authGatePrimaryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    authGateSecondary: {
      marginTop: 12,
      width: '100%',
      maxWidth: 360,
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 2,
      alignItems: 'center',
    },
    authGateSecondaryText: {
      fontSize: 16,
      fontWeight: '600',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Platform.OS === 'ios' ? 16 : 14,
      paddingVertical: Platform.OS === 'ios' ? 16 : 14,
      backgroundColor: colors.background,
      borderBottomWidth: 0.4,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: Platform.OS === 'ios' ? 25 : 20,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'left',
    },
    headerTitleGradientWrapper: {
      alignSelf: 'flex-start',
    },
    headerTitleGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    headerSubtitle: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: colors.textSecondary,
    },
    aiIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesContainer: {
      flex: 1,
      padding: Platform.OS === 'ios' ? 16 : 10,
    },
    messageRow: {
      marginBottom: 16,
      maxWidth: '80%',
    },
    userMessageRow: {
      alignSelf: 'flex-end',
    },
    aiMessageRow: {
      alignSelf: 'flex-start',
    },
    messageBubble: {
      borderRadius: 20,
      padding: Platform.OS === 'ios' ? 16 : 10,
      marginBottom: 8,
      maxWidth: '80%',
    },
    userBubble: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    planBubble: {
      width: '95%',
    },
    insightBubble: {
      width: '95%',
    },
    messageText: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      lineHeight: 24,
      flexWrap: 'wrap',
    },
    userText: {
      color: '#FFFFFF',
    },
    aiText: {
      color: colors.text,
    },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: 16,
      backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
      borderRadius: 20,
      padding: Platform.OS === 'ios' ? 12 : 10,
      paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 4,
    },
    typingText: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Platform.OS === 'ios' ? 12 : 10,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
      borderRadius: 12,
      paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: colors.text,
      marginRight: 8,
      maxHeight: 120,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.border,
    },
    suggestionsContainer: {
      padding: Platform.OS === 'ios' ? 16 : 10,
      backgroundColor: colors.surface,
    },
    suggestionsTitle: {
      fontSize: Platform.OS === 'ios' ? 16 : 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    suggestionsScroll: {
      flexDirection: 'row',
    },
    suggestionBubble: {
      backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
      borderRadius: 16,
      paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionText: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: colors.text,
    },
    planOptions: {
      marginTop: 16,
      gap: 12,
    },
    planOption: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: Platform.OS === 'ios' ? 16 : 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    planTitleContainer: {
      flex: 1,
      marginRight: 8,
    },
    planTitle: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '600',
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    planAmount: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
    },
    planDescription: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    planButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 100,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
      gap: 8,
    },
    planButtonText: {
      color: '#FFFFFF',
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '600',
    },
    insightsContainer: {
      marginTop: 16,
      gap: 12,
    },
    insightCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: Platform.OS === 'ios' ? 16 : 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    insightTitle: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    insightValue: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
    },
    insightDescription: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      flexWrap: 'wrap',
    },
    recommendationsContainer: {
      marginTop: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
      borderRadius: 12,
      padding: Platform.OS === 'ios' ? 16 : 10 ,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recommendationsTitle: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    recommendationBullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      marginRight: 8,
    },
    recommendationText: {
      flex: 1,
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      lineHeight: 20,
      flexWrap: 'wrap',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyImage: {
      width: 120,
      height: 120,
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    aiBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 4,
    },
    aiBadgeText: {
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      color: '#888',
      marginLeft: 4,
    },
    errorBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF3F3',
      borderRadius: 16,
      padding: 12,
      marginTop: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#E57373',
      gap: 8,
    },
    errorText: {
      color: '#E57373',
      fontSize: Platform.OS === 'ios' ? 18 : 16,
      flex: 1,
    },
    retryButton: {
      marginLeft: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: '#E57373',
      borderRadius: 8,
    },
    retryText: {
      color: '#FFF',
      fontWeight: '600',
      fontSize: Platform.OS === 'ios' ? 18 : 16,
    },
    debugButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginLeft: 8,
    },
    debugButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      marginBottom: -10,
    },
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    promptCounter: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      minWidth: 50,
      alignItems: 'center',
    },
    promptCounterText: {
      fontSize: 12,
      fontWeight: '600',
    },
    debugButtonsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginLeft: 8,
    },
  });

  // Add this function to handle navigation to Add Funds
  const handleAddFunds = () => {
    // Replace with your navigation logic
    if (router) router.push('/add-funds');
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!session?.user?.id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGateContainer}>
          <Sparkles size={52} color={colors.primary} />
          <Text style={[styles.authGateTitle, { color: colors.text }]}>Sign in to use Planmoni AI</Text>
          <Text style={[styles.authGateSubtitle, { color: colors.textSecondary }]}>
            Create an account or sign in to chat with your assistant and build payout plans.
          </Text>
          <Pressable
            style={[styles.authGatePrimary, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/onboarding/country-select')}
          >
            <Text style={styles.authGatePrimaryText}>Sign up</Text>
          </Pressable>
          <Pressable
            style={[styles.authGateSecondary, { borderColor: isDark ? '#fff' : colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={[styles.authGateSecondaryText, { color: isDark ? '#fff' : colors.primary }]}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <MaskedView
            maskElement={
              <Text style={styles.headerTitle} numberOfLines={1}>
                Planmoni AI
              </Text>
            }
          >
            <LinearGradient
              colors={['#0A36B5', '#3C82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerTitle, { opacity: 0 }]}>Planmoni AI</Text>
            </LinearGradient>
          </MaskedView>
        </View>
        <View style={styles.headerRightContainer}>
          {/* Daily prompt counter - only show when limit is reached */}
          {isDailyLimitReached && (
            <View style={[
              styles.promptCounter, 
              { 
                backgroundColor: '#FFE6E6',
                borderWidth: 1,
                borderColor: '#FF6B6B'
              }
            ]}>
              <Text style={[
                styles.promptCounterText, 
                { 
                  color: '#FF6B6B',
                  fontWeight: '700'
                }
              ]}>
                {dailyPromptCount}/20
              </Text>
            </View>
          )}
          
          {inputFocused && (
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.border }]}
              onPress={closeInput}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        {/* {__DEV__ && (
          <View style={styles.debugButtonsContainer}>
            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: colors.primary }]}
              onPress={testAIConnection}
            >
              <Text style={styles.debugButtonText}>Test AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: '#FF6B6B' }]}
              onPress={resetUsageData}
            >
              <Text style={styles.debugButtonText}>Reset Usage</Text>
            </TouchableOpacity>
          </View>
        )} */}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message, index) => renderMessage(message, index))}
        
        {isTyping && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(300)}
            style={styles.typingIndicator}
          >
            <Animated.View style={styles.typingDot} />
            <Animated.View style={styles.typingDot} />
            <Animated.View style={styles.typingDot} />
            <Text style={styles.typingText}>Thinking...</Text>
          </Animated.View>
        )}
        
        {isCreatingPayout && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(300)}
            style={styles.typingIndicator}
          >
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.typingText}>Creating your payout plan...</Text>
          </Animated.View>
        )}
        
        {createPayoutError && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            style={styles.errorBubble}
          >
            <AlertTriangle size={16} color="#E57373" />
            <Text style={styles.errorText}>{createPayoutError}</Text>
          </Animated.View>
        )}
        {/* Plan creation destination selection UI */}
        {planCreationStep === 'awaiting_destination' && !payoutAccountsLoading && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text }}>Your payout accounts:</Text>
            {payoutAccounts.length === 0 && (
              <Text style={{ marginBottom: 8, color: colors.text }}>No payout accounts found.</Text>
            )}
            {payoutAccounts.map(account => {
              const bankIcon = getBankIconLogo(account.bank_name);
              return (
                <Pressable
                  key={account.id}
                  style={{ 
                    padding: 12, 
                    borderWidth: 1, 
                    borderColor: colors.border, 
                    borderRadius: 8, 
                    marginBottom: 8,
                    backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                  onPress={() => handleSelectAccount(account)}
                >
                  {/* Bank Icon */}
                  <View style={{ marginRight: 12, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                    {bankIcon.logoSvg ? (
                      React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                        width: 32,
                        height: 32,
                        fill: colors.textSecondary
                      })
                    ) : bankIcon.logo ? (
                      <Image 
                        source={bankIcon.logo} 
                        style={{ width: 32, height: 32, resizeMode: 'contain' }}
                      />
                    ) : (
                      <View style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 16, 
                        backgroundColor: colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                          {account.bank_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Account Details */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500' }}>
                      {account.bank_name} ••••{account.account_number.slice(-4)}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 16, marginTop: 2 }}>
                      {account.account_name}
                    </Text>
                    {account.is_default && (
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
                        Default
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
            <Button title="Add New Account" onPress={() => setShowAddAccountModal(true)} />
          </View>
        )}
        {/* Day of week selection UI */}
        {planCreationStep === 'awaiting_day_of_week' && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text}}>Choose a day of the week:</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8, color: colors.text}}
              placeholder="Sunday, Monday, Tuesday, etc."
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              returnKeyType="done"
            />
          </View>
        )}
        
        {/* Emergency withdrawal input UI */}
        {planCreationStep === 'awaiting_emergency' && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text}}>Reply "yes" or "no" below:</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginBottom: 10, color: colors.text, fontSize: 16}}
              placeholder="yes or no"
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              returnKeyType="done"
            />
          </View>
        )}
        {/* Plan confirmation input UI */}
        {planCreationStep === 'confirming' && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text,}}>Type "confirm" to create the plan or "cancel" to abort:</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginBottom: 10, color: colors.text, fontSize: 16}}
              placeholder="confirm or cancel"
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              returnKeyType="done"
            />
          </View>
        )}
      </ScrollView>

      {showSuggestions && !inputText.trim() && !keyboardVisible && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Try asking about:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsScroll}
          >
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.suggestionBubble}
                onPress={() => handleSuggestionPress(prompt)}
              >
                <Text style={styles.suggestionText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Add payout account modal */}
      <AddPayoutAccountModal
        isVisible={showAddAccountModal}
        onClose={async (newAccount) => {
          setShowAddAccountModal(false);
          if (newAccount) {
            await fetchPayoutAccounts();
            handleSelectAccount(newAccount);
          }
        }}
      />

      {planCreationStep === 'idle' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View
            style={[
              styles.inputContainer,
              { paddingBottom: keyboardVisible ? 12 : floatingNavOffset + 8 },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="How can I help you today?"
              placeholderTextColor={colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onFocus={() => {
                setShowSuggestions(false);
                setInputFocused(true);
              }}
              onBlur={() => setInputFocused(false)}
              maxLength={500}
              editable={!isCreatingPayout}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isCreatingPayout || isRateLimited || isDailyLimitReached) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isTyping || isCreatingPayout || isRateLimited || isDailyLimitReached}
            >
              {isCreatingPayout ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}