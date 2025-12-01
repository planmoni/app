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
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
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
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useRequireAuth } from '@/hooks/useRequireAuth';

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

// Helper to generate suggested prompts based on user's balance
const generateSuggestedPrompts = (availableBalance: number): string[] => {
  // Calculate appropriate amounts based on balance
  // Use 10-20% of balance, but ensure minimums and maximums
  let planAmount: number;
  let dailyAmount: number;
  
  if (availableBalance < 10000) {
    // Very low balance - suggest small amounts
    planAmount = Math.max(1000, Math.floor(availableBalance * 0.5));
    dailyAmount = Math.max(500, Math.floor(availableBalance * 0.3));
  } else if (availableBalance < 50000) {
    // Low balance - suggest 10-15% of balance
    planAmount = Math.floor(availableBalance * 0.15);
    dailyAmount = Math.floor(availableBalance * 0.1);
  } else if (availableBalance < 200000) {
    // Medium balance - suggest 10-20% of balance
    planAmount = Math.floor(availableBalance * 0.2);
    dailyAmount = Math.floor(availableBalance * 0.15);
  } else {
    // High balance - suggest reasonable amounts (not too high)
    planAmount = Math.min(500000, Math.floor(availableBalance * 0.2));
    dailyAmount = Math.min(200000, Math.floor(availableBalance * 0.15));
  }
  
  // Round to nearest thousand for cleaner display
  planAmount = Math.round(planAmount / 1000) * 1000;
  dailyAmount = Math.round(dailyAmount / 1000) * 1000;
  
  // Format amounts
  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k`;
    }
    return amount.toString();
  };
  
  return [
    `Help me plan 100k for 1 month`,
    `Create a daily payout plan for 5k`,
    "How can I improve my money habits?",
    "Give me some financial advice",
    "Analyze my spending patterns",
  ];
};

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
  const { textSizeMultiplier } = useTextSize();
  const { session } = useAuth();
  const { balance, lockedBalance } = useBalance();
  const availableBalance = balance - (lockedBalance || 0);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const dayOfWeekInputRef = useRef<TextInput>(null);
  const emergencyInputRef = useRef<TextInput>(null);
  const confirmInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const windowHeight = Dimensions.get('window').height;
  const [error, setError] = useState<string | null>(null);
  
  // Rate limiting and daily limits
  const [lastPromptTime, setLastPromptTime] = useState<number>(0);
  const [dailyPromptCount, setDailyPromptCount] = useState<number>(0);
  const [lastResetDate, setLastResetDate] = useState<string>('');
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState<boolean>(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastType, setLastType] = useState<'plan' | 'insight' | 'text' | null>(null);
  // Clarifying question state
  const [awaitingClarification, setAwaitingClarification] = useState<{
    targetAmount: number;
    timeframe: number;
    timeframeUnit: 'weeks' | 'months' | 'days';
    options: Array<{ frequency: string; amount: number; description: string }>;
  } | null>(null);
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
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const isInitialMount = useRef(true);

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
      (event) => {
        setKeyboardVisible(true);
        // Scroll to bottom or to focused input
        setTimeout(() => {
          scrollToBottom();
        }, 100);
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

  // Scroll to input when plan creation step changes
  useEffect(() => {
    if (planCreationStep !== 'idle') {
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  }, [planCreationStep]);

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

  // Add welcome message when component mounts (only for authenticated users)
  useEffect(() => {
    if (!isAuthenticated) {
      // Don't show welcome message for unauthenticated users - they see the feature showcase instead
      setMessages([]);
      return;
    }
    
    const welcomeMessage: Message = {
      id: 'welcome',
      content: `Hi ${session?.user?.user_metadata?.first_name || 'there'}! I'm your financial assistant. I can help you create payout plans, analyze your spending, and provide personalized financial advice. How can I help you today?`,
      sender: 'ai',
      type: 'text',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [session?.user?.user_metadata?.first_name, isAuthenticated]);

  // Scroll to bottom when messages change (but not on initial mount)
  useEffect(() => {
    // Skip scrolling on initial mount to prevent auto-scroll to top
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Only scroll if there are messages and user is authenticated
    if (messages.length > 0 && isAuthenticated) {
      scrollToBottom();
    }
  }, [messages, isAuthenticated]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const scrollToInput = (inputRef: React.RefObject<TextInput | null>) => {
    setTimeout(() => {
      scrollToBottom();
      // Additional scroll to ensure input is visible
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }, 300);
  };

  // Update handleSendMessage to intercept input for plan creation steps
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Check authentication first
    if (!isAuthenticated) {
      const loginMessage: Message = {
        id: `login-required-${Date.now()}`,
        content: 'Please login to use the AI assistant. Click the login button to get started!',
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, loginMessage]);
      setInputText('');
      requireAuth(() => {}, '/(tabs)/ai-assistant');
      return;
    }

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

    // Check if user is responding to a clarifying question
    // Only check if the message seems like a response to clarification (short, simple answer)
    if (awaitingClarification && inputText.trim().length < 50) {
      handleClarificationResponse(inputText.trim(), awaitingClarification);
      setInputText('');
      return;
    } else if (awaitingClarification && inputText.trim().length >= 50) {
      // If it's a longer message, it might be a new request - clear clarification state
      setAwaitingClarification(null);
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
    // Redirect to login if user is not authenticated
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    
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
    // If it's a very specific plan pattern, use hardcoded logic
    // Otherwise, use OpenAI for more nuanced responses
    if (hasPlanPattern && isSimplePayoutPrompt(userMessage)) {
      setLastType('plan');
      await generatePlanResponse(userMessage, balances);
    } 
    else if (hasPlanKeywords || hasPlanPattern) {
      // For plan-related queries that aren't very specific, use OpenAI for better handling
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
      response = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 256
      });
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
  // Only return true for very specific prompts with clear amount and timeframe
  const isSimplePayoutPrompt = (message: string) => {
    // Looks for very specific patterns like 'plan 5k for 1 week', 'plan 500k for 2 months', etc.
    // Must have both amount and timeframe clearly specified
    const regex = /(plan|help me plan|payout|disburse|schedule)\s+((?:[₦]?[\d,.]+(?:[kKmMbB])?)|(?:a |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve |thirteen |fourteen |fifteen |sixteen |seventeen |eighteen |nineteen |twenty |thirty |forty |fifty |sixty |seventy |eighty |ninety |hundred |thousand |million |billion|and|point| )+)\s+(for|over|in)\s+((?:\d+|a |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve |thirteen |fourteen |fifteen |sixteen |seventeen |eighteen |nineteen |twenty)[ ]*)\s*(month|months|week|weeks|day|days|year|years)/i;
    return regex.test(message);
  };

  const generatePlanResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const { availableBalance, balance, lockedBalance } = balances;
    let aiMessage: Message | null = null;
    // If the prompt is a simple payout plan, check if frequency is ambiguous
    if (isSimplePayoutPrompt(userMessage)) {
      const targetAmount = extractAmount(userMessage);
      const timeframeData = extractTimeframe(userMessage);
      const extractedFreq = extractFrequency(userMessage);
      
      // Check if we have both amount and timeframe, but frequency is ambiguous
      if (targetAmount && timeframeData && !extractedFreq) {
        let timeframe: number;
        let timeframeUnit: 'weeks' | 'months' | 'days' = 'months';
        let timeframeDisplay: string;
        
        if (timeframeData.unit === 'weeks') {
          timeframe = timeframeData.value;
          timeframeUnit = 'weeks';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'week' : 'weeks'}`;
        } else if (timeframeData.unit === 'days') {
          timeframe = timeframeData.value;
          timeframeUnit = 'days';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'day' : 'days'}`;
        } else {
          timeframe = timeframeData.value;
          timeframeUnit = 'months';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
        }
        
        // Generate clarifying question with potential options
        const clarifyingOptions = generateClarifyingOptions(targetAmount, timeframe, timeframeUnit);
        
        if (clarifyingOptions.length > 1) {
          // Ask clarifying question and store context
          let content = `I want to make sure I understand correctly. When you say "plan ₦${targetAmount.toLocaleString()} for ${timeframeDisplay}", do you mean:\n\n`;
          clarifyingOptions.forEach((option, index) => {
            content += `${index + 1}. ${option.description}\n`;
          });
          content += `\nPlease let me know which option you prefer (you can say the number, like "1" or "2", or describe it like "daily" or "weekly").`;
          
          // Store clarification context
          setAwaitingClarification({
            targetAmount,
            timeframe,
            timeframeUnit,
            options: clarifyingOptions
          });
          
          aiMessage = {
            id: Date.now().toString(),
            content,
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: {
              step: 'clarifying_frequency',
              targetAmount,
              timeframe,
              timeframeUnit,
              options: clarifyingOptions
            }
          };
          setMessages(prev => [...prev, aiMessage!]);
          setIsTyping(false);
          return;
        }
      }
      
      // If frequency is specified or only one option makes sense, proceed with plan generation
      const targetAmountFinal = targetAmount || 500000;
      const timeframeDataFinal = timeframeData;
      
      let timeframe: number;
      let timeframeUnit: 'weeks' | 'months' | 'days' = 'months';
      let timeframeDisplay: string;
      
      if (timeframeDataFinal) {
        if (timeframeDataFinal.unit === 'weeks') {
          timeframe = timeframeDataFinal.value;
          timeframeUnit = 'weeks';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'week' : 'weeks'}`;
        } else if (timeframeDataFinal.unit === 'days') {
          timeframe = timeframeDataFinal.value;
          timeframeUnit = 'days';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'day' : 'days'}`;
        } else {
          timeframe = timeframeDataFinal.value;
          timeframeUnit = 'months';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
        }
      } else {
        timeframe = 6;
        timeframeDisplay = '6 months';
      }
      
      let content = `Based on your goal to schedule payouts totaling ₦${targetAmountFinal.toLocaleString()} over ${timeframeDisplay}, here are some flexible payout schedules you can set up:`;
      aiMessage = {
        id: Date.now().toString(),
        content,
        sender: 'ai',
        type: 'plan',
        timestamp: new Date(),
        metadata: {
          targetAmount: targetAmountFinal,
          timeframe,
          timeframeUnit,
          plans: getPlanOptions(targetAmountFinal, timeframe, userMessage, timeframeUnit)
        }
      };
      setMessages(prev => [...prev, aiMessage!]);
      setIsTyping(false);
      // Clear any pending clarification when generating a plan
      setAwaitingClarification(null);
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
      const systemPrompt = `You are Planmoni, a helpful, friendly, and expert payout scheduling assistant for Nigerian users.\nUser: ${getUserName()}\nAvailable balance: ₦${availableBalance.toLocaleString()}\nTotal balance: ₦${balance.toLocaleString()}\nLocked balance: ₦${lockedBalance.toLocaleString()}\n\nIMPORTANT: Planmoni is a payout scheduling app. Your job is to help users plan and schedule payouts over time, regardless of their current balance. Do NOT check if the user can "afford" a payout up front. Never block or warn about insufficient balance. Always suggest flexible payout schedules, and encourage users to schedule payouts as funds become available.\n\nUse only payout, schedule, disbursement, or plan your payouts language. Never use savings or saving plan language.\n\nIf the user's request is ambiguous (e.g., "plan 5k for 1 week" without specifying frequency), respond with a clarifying question in this format:\n{\n  \"type\": \"clarify\",\n  \"content\": \"I want to make sure I understand correctly. When you say 'plan ₦5,000 for 1 week', do you mean:\\n\\n1. A weekly payout of ₦5,000 (one payout per week)\\n2. A daily payout of ₦714 per day for 7 days (totaling ₦5,000)\\n\\nPlease let me know which option you prefer.\"\n}\n\nIf the user asks for a payout schedule with clear details, respond ONLY with a valid JSON object like this:\n{\n  \"type\": \"plan\",\n  \"content\": \"summary of the payout schedule\",\n  \"metadata\": {\n    \"targetAmount\": 1000000,\n    \"timeframe\": 6,\n    \"plans\": [ {\n      \"title\": \"Weekly Payout\",\n      \"amount\": 50000,\n      \"frequency\": \"weekly\",\n      \"description\": \"Schedule a payout of ₦50,000 every week for 6 months." } ]\n  }\n}\nDo not include any text outside the JSON.\nIf the user's available balance is low, encourage them to schedule payouts as funds become available, and offer flexible options.\nBe positive, supportive, and empowering. Never block the user from seeing a payout schedule.\n\nHere are some examples:\n${examples.map(e => `User: ${e.user}\nAI: ${e.ai}`).join('\n')}\n\nIf you are unsure or the request is ambiguous, ask clarifying questions. Do not make up numbers or facts.`;
      const openaiResponse = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        max_tokens: 512
      });
      const jsonStart = openaiResponse.indexOf('{');
      const jsonEnd = openaiResponse.lastIndexOf('}');
      let parsed: any = null;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          parsed = JSON.parse(openaiResponse.substring(jsonStart, jsonEnd + 1));
        } catch (e) {}
      }
      
      // Handle clarifying questions from OpenAI
      if (parsed && parsed.type === 'clarify') {
        const clarifyMessage: Message = {
          id: Date.now().toString(),
          content: parsed.content,
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
          metadata: { step: 'clarifying' }
        };
        setMessages(prev => [...prev, clarifyMessage]);
        setIsTyping(false);
        return;
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
          aiResponse: openaiResponse.substring(0, 200),
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
      // Fallback: try to extract amount and timeframe, but use OpenAI for better handling
      const targetAmount = extractAmount(userMessage);
      const timeframeData = extractTimeframe(userMessage);
      
      // If we can extract both amount and timeframe, use hardcoded logic
      // Otherwise, this shouldn't happen as OpenAI should handle it, but provide a fallback
      if (targetAmount && timeframeData) {
        let timeframe: number;
        let timeframeUnit: 'weeks' | 'months' | 'days' = 'months';
        let timeframeDisplay: string;
        
        if (timeframeData.unit === 'weeks') {
          timeframe = timeframeData.value;
          timeframeUnit = 'weeks';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'week' : 'weeks'}`;
        } else if (timeframeData.unit === 'days') {
          timeframe = timeframeData.value;
          timeframeUnit = 'days';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'day' : 'days'}`;
        } else {
          timeframe = timeframeData.value;
          timeframeUnit = 'months';
          timeframeDisplay = `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
        }
        
        let content = `Based on your goal to schedule payouts totaling ₦${targetAmount.toLocaleString()} over ${timeframeDisplay}, here are some flexible payout schedules you can set up:`;
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
            timeframeUnit,
            plans: getPlanOptions(targetAmount, timeframe, userMessage, timeframeUnit)
          }
        };
      } else {
        // If extraction fails, provide a helpful message asking for clarification
        aiMessage = {
          id: Date.now().toString(),
          content: "I'd be happy to help you create a payout plan! To give you the best options, could you please specify:\n\n• The amount you'd like to plan (e.g., 5k, 50k, 100k)\n• The timeframe (e.g., 1 week, 2 weeks, 1 month, 3 months)\n\nFor example: \"Help me plan 5k for 1 week\" or \"Create a payout plan for 50k over 2 months\"",
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        };
      }
    }
    if (aiMessage) setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  // Handle user response to clarifying question
  const handleClarificationResponse = (response: string, clarificationContext: { targetAmount: number; timeframe: number; timeframeUnit: 'weeks' | 'months' | 'days'; options: Array<{ frequency: string; amount: number; description: string }> }) => {
    const normalized = response.toLowerCase().trim();
    
    // Try to match option number (1, 2, 3, etc.)
    const optionMatch = normalized.match(/^(option\s*)?(\d+)/);
    if (optionMatch) {
      const optionIndex = parseInt(optionMatch[2]) - 1;
      if (optionIndex >= 0 && optionIndex < clarificationContext.options.length) {
        const selectedOption = clarificationContext.options[optionIndex];
        generatePlanFromClarification(clarificationContext, selectedOption);
        setAwaitingClarification(null);
        return;
      }
    }
    
    // Try to match frequency keywords
    if (normalized.includes('daily') || normalized.includes('day')) {
      const dailyOption = clarificationContext.options.find(opt => opt.frequency === 'daily');
      if (dailyOption) {
        generatePlanFromClarification(clarificationContext, dailyOption);
        setAwaitingClarification(null);
        return;
      }
    }
    
    if (normalized.includes('weekly') || normalized.includes('week')) {
      const weeklyOption = clarificationContext.options.find(opt => opt.frequency === 'weekly');
      if (weeklyOption) {
        generatePlanFromClarification(clarificationContext, weeklyOption);
        setAwaitingClarification(null);
        return;
      }
    }
    
    if (normalized.includes('monthly') || normalized.includes('month')) {
      const monthlyOption = clarificationContext.options.find(opt => opt.frequency === 'monthly');
      if (monthlyOption) {
        generatePlanFromClarification(clarificationContext, monthlyOption);
        setAwaitingClarification(null);
        return;
      }
    }
    
    if (normalized.includes('single') || normalized.includes('one time') || normalized.includes('once')) {
      const singleOption = clarificationContext.options.find(opt => opt.frequency === 'single');
      if (singleOption) {
        generatePlanFromClarification(clarificationContext, singleOption);
        setAwaitingClarification(null);
        return;
      }
    }
    
    // If no match found, ask for clarification again or use OpenAI
    const userMessage: Message = {
      id: Date.now().toString(),
      content: response,
      sender: 'user',
      type: 'text',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // If no clear match, ask for clarification again
    const clarificationMessage: Message = {
      id: `clarification-needed-${Date.now()}`,
      content: `I'm not sure which option you meant. Please choose one:\n\n${clarificationContext.options.map((opt, i) => `${i + 1}. ${opt.description}`).join('\n')}\n\nYou can reply with the number (like "1" or "2") or describe it (like "daily" or "weekly").`,
      sender: 'ai',
      type: 'text',
      timestamp: new Date(),
      metadata: { step: 'clarifying' }
    };
    setMessages(prev => [...prev, clarificationMessage]);
    setIsTyping(false);
  };

  // Generate plan from clarification response
  const generatePlanFromClarification = (context: { targetAmount: number; timeframe: number; timeframeUnit: 'weeks' | 'months' | 'days' }, selectedOption: { frequency: string; amount: number; description: string }) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: selectedOption.description,
      sender: 'user',
      type: 'text',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Generate plan based on selected option
    const plans = [];
    const timeframeDisplay = context.timeframeUnit === 'weeks' 
      ? `${context.timeframe} ${context.timeframe === 1 ? 'week' : 'weeks'}`
      : context.timeframeUnit === 'days'
      ? `${context.timeframe} ${context.timeframe === 1 ? 'day' : 'days'}`
      : `${context.timeframe} ${context.timeframe === 1 ? 'month' : 'months'}`;
    
    if (selectedOption.frequency === 'daily') {
      const daysInTimeframe = context.timeframeUnit === 'weeks' ? context.timeframe * 7 : context.timeframeUnit === 'days' ? context.timeframe : context.timeframe * 30;
      plans.push({
        title: `Daily Payout (${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'})`,
        amount: selectedOption.amount,
        frequency: 'daily',
        duration: daysInTimeframe,
        description: `Schedule a payout of ₦${selectedOption.amount.toLocaleString()} every day for ${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'}.`
      });
    } else if (selectedOption.frequency === 'weekly') {
      const weeks = context.timeframeUnit === 'weeks' ? context.timeframe : context.timeframeUnit === 'days' ? Math.ceil(context.timeframe / 7) : context.timeframe * 4.33;
      plans.push({
        title: "Weekly Payout",
        amount: selectedOption.amount,
        frequency: 'weekly',
        duration: context.timeframeUnit === 'weeks' ? context.timeframe : undefined,
        description: `Schedule a payout of ₦${selectedOption.amount.toLocaleString()} every week for ${timeframeDisplay}.`
      });
    } else if (selectedOption.frequency === 'monthly') {
      plans.push({
        title: "Monthly Payout",
        amount: selectedOption.amount,
        frequency: 'monthly',
        description: `Schedule a payout of ₦${selectedOption.amount.toLocaleString()} every month for ${timeframeDisplay}.`
      });
    } else if (selectedOption.frequency === 'single') {
      plans.push({
        title: "Single Payout",
        amount: selectedOption.amount,
        frequency: 'monthly', // Use monthly as default, but duration will be 1
        description: `Schedule a single payout of ₦${selectedOption.amount.toLocaleString()}.`
      });
    }
    
    const aiMessage: Message = {
      id: Date.now().toString(),
      content: `Perfect! Based on your choice, here's your payout plan:`,
      sender: 'ai',
      type: 'plan',
      timestamp: new Date(),
      metadata: {
        targetAmount: context.targetAmount,
        timeframe: context.timeframe,
        timeframeUnit: context.timeframeUnit,
        plans: plans
      }
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);
  };

  // Helper to generate clarifying options when frequency is ambiguous
  const generateClarifyingOptions = (targetAmount: number, timeframe: number, timeframeUnit: 'weeks' | 'months' | 'days') => {
    const options = [];
    
    if (timeframeUnit === 'weeks') {
      const daysInTimeframe = timeframe * 7;
      // Option 1: Weekly payout (one payout per week)
      options.push({
        frequency: 'weekly',
        amount: targetAmount,
        description: `A weekly payout of ₦${targetAmount.toLocaleString()} (one payout per week)`
      });
      // Option 2: Daily payout (distributed over the week)
      const dailyAmount = Math.ceil(targetAmount / daysInTimeframe);
      options.push({
        frequency: 'daily',
        amount: dailyAmount,
        description: `A daily payout of ₦${dailyAmount.toLocaleString()} per day for ${daysInTimeframe} days (totaling ₦${targetAmount.toLocaleString()})`
      });
    } else if (timeframeUnit === 'days') {
      // Option 1: One payout for the full amount
      options.push({
        frequency: 'single',
        amount: targetAmount,
        description: `A single payout of ₦${targetAmount.toLocaleString()}`
      });
      // Option 2: Daily payout
      const dailyAmount = Math.ceil(targetAmount / timeframe);
      options.push({
        frequency: 'daily',
        amount: dailyAmount,
        description: `A daily payout of ₦${dailyAmount.toLocaleString()} per day for ${timeframe} days (totaling ₦${targetAmount.toLocaleString()})`
      });
      // Option 3: Weekly payout if timeframe is 7+ days
      if (timeframe >= 7) {
        const weeklyAmount = Math.ceil(targetAmount / Math.ceil(timeframe / 7));
        options.push({
          frequency: 'weekly',
          amount: weeklyAmount,
          description: `A weekly payout of ₦${weeklyAmount.toLocaleString()} (one payout per week for ${Math.ceil(timeframe / 7)} ${Math.ceil(timeframe / 7) === 1 ? 'week' : 'weeks'})`
        });
      }
    } else {
      // For months, show monthly vs weekly vs daily options
      const monthlyAmount = Math.ceil(targetAmount / timeframe);
      options.push({
        frequency: 'monthly',
        amount: monthlyAmount,
        description: `A monthly payout of ₦${monthlyAmount.toLocaleString()} per month for ${timeframe} ${timeframe === 1 ? 'month' : 'months'} (totaling ₦${targetAmount.toLocaleString()})`
      });
      
      const weeksInTimeframe = Math.ceil(timeframe * 4.33);
      const weeklyAmount = Math.ceil(targetAmount / weeksInTimeframe);
      options.push({
        frequency: 'weekly',
        amount: weeklyAmount,
        description: `A weekly payout of ₦${weeklyAmount.toLocaleString()} per week for ${weeksInTimeframe} weeks (totaling ₦${targetAmount.toLocaleString()})`
      });
    }
    
    return options;
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

  // Helper to filter plans based on timeframe appropriateness
  const isPlanAppropriateForTimeframe = (plan: any, timeframe: number, timeframeUnit: 'weeks' | 'months' | 'days'): boolean => {
    // Convert timeframe to days for easier comparison
    let timeframeInDays: number;
    if (timeframeUnit === 'weeks') {
      timeframeInDays = timeframe * 7;
    } else if (timeframeUnit === 'days') {
      timeframeInDays = timeframe;
    } else {
      timeframeInDays = timeframe * 30; // Approximate
    }
    
    // For very short timeframes (less than 14 days), only show daily and weekly options
    if (timeframeInDays < 14) {
      return plan.frequency === 'daily' || plan.frequency === 'weekly';
    }
    
    // For 14-30 days, show daily, weekly, bi-weekly (but not monthly)
    if (timeframeInDays >= 14 && timeframeInDays < 30) {
      return plan.frequency === 'daily' || plan.frequency === 'weekly' || plan.frequency === 'biweekly';
    }
    
    // For 30+ days (1 month+), show all options except first_of_month (handled separately)
    // Monthly options are only shown if timeframe is at least 1 month equivalent
    if (timeframeInDays >= 30) {
      // Monthly, end_of_month are fine for 30+ days
      // first_of_month is handled separately based on user request
      return true;
    }
    
    return false;
  };

  // Helper to generate plan options
  const getPlanOptions = (targetAmount: number, timeframe: number, userMessage?: string, timeframeUnit: 'weeks' | 'months' | 'days' = 'months') => {
    // Calculate amounts based on timeframe unit
    let monthlyAmount: number;
    let weeklyAmount: number;
    let biweeklyAmount: number;
    let endOfMonthAmount: number;
    let firstOfMonthAmount: number;
    
    if (timeframeUnit === 'weeks') {
      // Convert weeks to approximate months for calculations (1 month ≈ 4.33 weeks)
      const monthsEquivalent = timeframe / 4.33;
      monthlyAmount = Math.ceil(targetAmount / monthsEquivalent);
      weeklyAmount = Math.ceil(targetAmount / timeframe);
      biweeklyAmount = Math.ceil(targetAmount / Math.ceil(timeframe / 2));
      endOfMonthAmount = Math.ceil(targetAmount / monthsEquivalent);
      firstOfMonthAmount = Math.ceil(targetAmount / monthsEquivalent);
    } else if (timeframeUnit === 'days') {
      // For days, calculate daily amounts
      const dailyAmount = Math.ceil(targetAmount / timeframe);
      monthlyAmount = Math.ceil(targetAmount / (timeframe / 30));
      weeklyAmount = Math.ceil(targetAmount / Math.ceil(timeframe / 7));
      biweeklyAmount = Math.ceil(targetAmount / Math.ceil(timeframe / 14));
      endOfMonthAmount = monthlyAmount;
      firstOfMonthAmount = monthlyAmount;
    } else {
      // Default: months
      monthlyAmount = Math.ceil(targetAmount / timeframe);
      weeklyAmount = Math.ceil(monthlyAmount / 4.33);
      biweeklyAmount = Math.ceil(monthlyAmount / 2);
      endOfMonthAmount = Math.ceil(targetAmount / timeframe);
      firstOfMonthAmount = Math.ceil(targetAmount / timeframe);
    }
    
    const freq = userMessage ? extractFrequency(userMessage) : null;
    
    // Check if user explicitly requested first of month
    const wantsFirstOfMonth = userMessage?.toLowerCase().includes('first of month') || 
                              userMessage?.toLowerCase().includes('first-of-month') ||
                              userMessage?.toLowerCase().includes('first day');
    
    // Calculate daily amounts for different durations
    let dailyAmount7: number;
    let dailyAmount30: number;
    let dailyAmount90: number;
    
    if (timeframeUnit === 'weeks') {
      // For weeks, use the actual timeframe or default options
      const daysInTimeframe = timeframe * 7;
      dailyAmount7 = Math.ceil(targetAmount / 7);
      dailyAmount30 = daysInTimeframe <= 30 ? Math.ceil(targetAmount / daysInTimeframe) : Math.ceil(targetAmount / 30);
      dailyAmount90 = Math.ceil(targetAmount / 90);
    } else if (timeframeUnit === 'days') {
      // For days, use the actual timeframe
      dailyAmount7 = timeframe <= 7 ? Math.ceil(targetAmount / timeframe) : Math.ceil(targetAmount / 7);
      dailyAmount30 = timeframe <= 30 ? Math.ceil(targetAmount / timeframe) : Math.ceil(targetAmount / 30);
      dailyAmount90 = timeframe <= 90 ? Math.ceil(targetAmount / timeframe) : Math.ceil(targetAmount / 90);
    } else {
      // Default: months
      dailyAmount7 = Math.ceil(targetAmount / 7);
      dailyAmount30 = Math.ceil(targetAmount / 30);
      dailyAmount90 = Math.ceil(targetAmount / 90);
    }
    
    if (freq === 'daily') {
      // Provide daily options based on timeframe
      const options = [];
      
      if (timeframeUnit === 'weeks') {
        const daysInTimeframe = timeframe * 7;
        options.push({
          title: `Daily Payout (${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'})`,
          amount: Math.ceil(targetAmount / daysInTimeframe),
          frequency: "daily",
          duration: daysInTimeframe,
          description: `Schedule a payout of ₦${Math.ceil(targetAmount / daysInTimeframe).toLocaleString()} every day for ${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'}.`
        });
      } else if (timeframeUnit === 'days') {
        options.push({
          title: `Daily Payout (${timeframe} ${timeframe === 1 ? 'day' : 'days'})`,
          amount: Math.ceil(targetAmount / timeframe),
          frequency: "daily",
          duration: timeframe,
          description: `Schedule a payout of ₦${Math.ceil(targetAmount / timeframe).toLocaleString()} every day for ${timeframe} ${timeframe === 1 ? 'day' : 'days'}.`
        });
      } else {
        // Default options for months
        options.push(
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
        );
      }
      
      return options;
    } else if (freq === 'weekly') {
      const durationText = timeframeUnit === 'weeks' 
        ? `${timeframe} ${timeframe === 1 ? 'week' : 'weeks'}`
        : timeframeUnit === 'days'
        ? `${Math.ceil(timeframe / 7)} ${Math.ceil(timeframe / 7) === 1 ? 'week' : 'weeks'}`
        : `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
      return [
        {
          title: "Weekly Payout",
          amount: weeklyAmount,
          frequency: "weekly",
          duration: timeframeUnit === 'weeks' ? timeframe : timeframeUnit === 'days' ? Math.ceil(timeframe / 7) : undefined,
          description: `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${durationText}.`
        }
      ];
    } else if (freq === 'biweekly') {
      const durationText = timeframeUnit === 'weeks' 
        ? `${Math.ceil(timeframe / 2)} ${Math.ceil(timeframe / 2) === 1 ? 'bi-weekly period' : 'bi-weekly periods'}`
        : timeframeUnit === 'days'
        ? `${Math.ceil(timeframe / 14)} ${Math.ceil(timeframe / 14) === 1 ? 'bi-weekly period' : 'bi-weekly periods'}`
        : `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
      return [
        {
          title: "Bi-weekly Payout",
          amount: biweeklyAmount,
          frequency: "biweekly",
          description: `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${durationText}.`
        }
      ];
    } else if (freq === 'monthly') {
      const durationText = timeframeUnit === 'weeks' 
        ? `${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}`
        : timeframeUnit === 'days'
        ? `${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}`
        : `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
      return [
        {
          title: "Monthly Payout",
          amount: monthlyAmount,
          frequency: "monthly",
          description: `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${durationText}.`
        }
      ];
    } else if (freq === 'end_of_month') {
      const durationText = timeframeUnit === 'weeks' 
        ? `${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}`
        : timeframeUnit === 'days'
        ? `${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}`
        : `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
      return [
        {
          title: "End-of-Month Payout",
          amount: endOfMonthAmount,
          frequency: "end_of_month",
          description: `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${durationText}.`
        }
      ];
    } else if (freq === 'first_of_month' && wantsFirstOfMonth) {
      // Only show first of month if explicitly requested
      const durationText = timeframeUnit === 'weeks' 
        ? `${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}`
        : timeframeUnit === 'days'
        ? `${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}`
        : `${timeframe} ${timeframe === 1 ? 'month' : 'months'}`;
      return [
        {
          title: "First-of-Month Payout",
          amount: firstOfMonthAmount,
          frequency: "first_of_month",
          description: `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${durationText}.`
        }
      ];
    }
    // Default: show all options including daily
    const defaultOptions = [];
    
    // Add daily options based on timeframe unit
    if (timeframeUnit === 'weeks') {
      const daysInTimeframe = timeframe * 7;
      defaultOptions.push({
        title: `Daily Payout (${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'})`,
        amount: Math.ceil(targetAmount / daysInTimeframe),
        frequency: "daily",
        duration: daysInTimeframe,
        description: `Schedule a payout of ₦${Math.ceil(targetAmount / daysInTimeframe).toLocaleString()} every day for ${daysInTimeframe} ${daysInTimeframe === 1 ? 'day' : 'days'}.`
      });
    } else if (timeframeUnit === 'days') {
      defaultOptions.push({
        title: `Daily Payout (${timeframe} ${timeframe === 1 ? 'day' : 'days'})`,
        amount: Math.ceil(targetAmount / timeframe),
        frequency: "daily",
        duration: timeframe,
        description: `Schedule a payout of ₦${Math.ceil(targetAmount / timeframe).toLocaleString()} every day for ${timeframe} ${timeframe === 1 ? 'day' : 'days'}.`
      });
    } else {
      defaultOptions.push(
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
        }
      );
    }
    
    // Build all possible options
    const allOptions = [
      ...defaultOptions,
      {
        title: "Weekly Payout",
        amount: weeklyAmount,
        frequency: "weekly",
        duration: timeframeUnit === 'weeks' ? timeframe : timeframeUnit === 'days' ? Math.ceil(timeframe / 7) : undefined,
        description: timeframeUnit === 'weeks' 
          ? `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${timeframe} ${timeframe === 1 ? 'week' : 'weeks'}.`
          : timeframeUnit === 'days'
          ? `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${Math.ceil(timeframe / 7)} ${Math.ceil(timeframe / 7) === 1 ? 'week' : 'weeks'}.`
          : `Schedule a payout of ₦${weeklyAmount.toLocaleString()} every week for ${timeframe} ${timeframe === 1 ? 'month' : 'months'}.`
      },
      {
        title: "Bi-weekly Payout",
        amount: biweeklyAmount,
        frequency: "biweekly",
        description: timeframeUnit === 'weeks' 
          ? `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${Math.ceil(timeframe / 2)} ${Math.ceil(timeframe / 2) === 1 ? 'bi-weekly period' : 'bi-weekly periods'}.`
          : timeframeUnit === 'days'
          ? `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${Math.ceil(timeframe / 14)} ${Math.ceil(timeframe / 14) === 1 ? 'bi-weekly period' : 'bi-weekly periods'}.`
          : `Schedule a payout of ₦${biweeklyAmount.toLocaleString()} every two weeks for ${timeframe} ${timeframe === 1 ? 'month' : 'months'}.`
      }
    ];
    
    // Only add monthly options if timeframe is long enough (at least 1 month equivalent)
    const monthsEquivalent = timeframeUnit === 'weeks' ? timeframe / 4.33 : timeframeUnit === 'days' ? timeframe / 30 : timeframe;
    if (monthsEquivalent >= 1) {
      allOptions.push({
        title: "Monthly Payout",
        amount: monthlyAmount,
        frequency: "monthly",
        description: timeframeUnit === 'weeks' 
          ? `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}.`
          : timeframeUnit === 'days'
          ? `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}.`
          : `Schedule a payout of ₦${monthlyAmount.toLocaleString()} every month for ${timeframe} ${timeframe === 1 ? 'month' : 'months'}.`
      });
      
      allOptions.push({
        title: "End-of-Month Payout",
        amount: endOfMonthAmount,
        frequency: "end_of_month",
        description: timeframeUnit === 'weeks' 
          ? `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}.`
          : timeframeUnit === 'days'
          ? `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}.`
          : `Schedule a payout of ₦${endOfMonthAmount.toLocaleString()} at the end of each month for ${timeframe} ${timeframe === 1 ? 'month' : 'months'}.`
      });
      
      // Only add first of month if explicitly requested
      if (wantsFirstOfMonth) {
        allOptions.push({
          title: "First-of-Month Payout",
          amount: firstOfMonthAmount,
          frequency: "first_of_month",
          description: timeframeUnit === 'weeks' 
            ? `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${Math.ceil(timeframe / 4.33)} ${Math.ceil(timeframe / 4.33) === 1 ? 'month' : 'months'}.`
            : timeframeUnit === 'days'
            ? `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${Math.ceil(timeframe / 30)} ${Math.ceil(timeframe / 30) === 1 ? 'month' : 'months'}.`
            : `Schedule a payout of ₦${firstOfMonthAmount.toLocaleString()} on the first of each month for ${timeframe} ${timeframe === 1 ? 'month' : 'months'}.`
        });
      }
    }
    
    // Filter options based on timeframe appropriateness
    return allOptions.filter(plan => isPlanAppropriateForTimeframe(plan, timeframe, timeframeUnit));
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
      const jsonStart = openaiResponse.indexOf('{');
      const jsonEnd = openaiResponse.lastIndexOf('}');
      let parsed: any = null;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          parsed = JSON.parse(openaiResponse.substring(jsonStart, jsonEnd + 1));
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
          aiResponse: openaiResponse.substring(0, 200),
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

  const extractTimeframe = (message: string): { value: number; unit: 'weeks' | 'months' | 'days' } | null => {
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
    
    // Look for weeks first (more specific)
    const weekRegex = /(\d+)\s*(week|weeks)/i;
    const weekMatch = normalized.match(weekRegex);
    if (weekMatch) {
      return { value: parseInt(weekMatch[1]), unit: 'weeks' };
    }
    
    // Look for days
    const dayRegex = /(\d+)\s*(day|days)/i;
    const dayMatch = normalized.match(dayRegex);
    if (dayMatch) {
      return { value: parseInt(dayMatch[1]), unit: 'days' };
    }
    
    // Look for time periods like "6 months", "1 year", etc.
    const monthRegex = /(\d+)\s*(month|months)/i;
    const yearRegex = /(\d+)\s*(year|years)/i;
    const monthMatch = normalized.match(monthRegex);
    if (monthMatch) {
      return { value: parseInt(monthMatch[1]), unit: 'months' };
    }
    const yearMatch = normalized.match(yearRegex);
    if (yearMatch) {
      return { value: parseInt(yearMatch[1]) * 12, unit: 'months' };
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
        return { value: monthsDiff, unit: 'months' };
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
          content: 'Emergency Withdrawal Rules:\n- Instant withdrawal: 12% processing fee\n- 24-hour withdrawal: 10% processing fee\n- 72-hour withdrawal: 6% processing fee',
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
      // Check authentication first
      if (!isAuthenticated) {
        setMessages(prev => [
          ...prev,
          {
            id: `plan-auth-error-${Date.now()}`,
            content: 'Please login to create a payout plan.',
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: { step: 'error' }
          }
        ]);
        requireAuth(() => {}, '/(tabs)/ai-assistant');
        return;
      }
      
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
        
        // Validate minimum amount
        if (targetAmount < 5000) {
          setMessages(prev => [
            ...prev,
            {
              id: `plan-error-${Date.now()}`,
              content: 'The minimum amount for creating a payout plan is ₦5,000. Please adjust your plan amount.',
              sender: 'ai',
              type: 'text',
              timestamp: new Date(),
              metadata: { step: 'error' }
            }
          ]);
          return;
        }
        
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
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: getScaledFontSize(20, textSizeMultiplier) }}>Add Funds</Text>
              </TouchableOpacity>
              <View style={styles.aiBadgeContainer}>
                <Sparkles size={getScaledFontSize(14, textSizeMultiplier)} color={colors.primary} />
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
                    {plan.frequency === 'daily' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                    {plan.frequency === 'weekly' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                    {plan.frequency === 'biweekly' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                    {plan.frequency === 'monthly' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                    {plan.frequency === 'end_of_month' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                    {plan.frequency === 'first_of_month' && <Clock size={getScaledFontSize(20, textSizeMultiplier)} color={colors.primary} />}
                  </View>
                  
                  <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                    {plan.description}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.planButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleCreatePlan({...plan, metadata: message.metadata})}
                  >
                    <Text style={styles.planButtonText}>Create Plan</Text>
                    <ArrowRight size={getScaledFontSize(16, textSizeMultiplier)} color="#FFFFFF" />
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

  // Add this function to handle navigation to Add Funds
  const handleAddFunds = () => {
    // Replace with your navigation logic
    if (router) router.push('/add-funds');
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={Platform.OS === 'ios' ? ['top'] : ['top', 'bottom']}>
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
              <X size={getScaledFontSize(20, textSizeMultiplier)} color={colors.text} />
            </TouchableOpacity>
          )}
          {/* Login button - only show when not authenticated */}
          {!isAuthenticated && (
            <Pressable 
              onPress={() => requireAuth(() => {}, '/(tabs)/ai-assistant')} 
              style={[styles.loginButton, { borderColor: isDark ? '#fff' : colors.primary }]}
            >
              <Text style={[styles.loginButtonText, { color: isDark ? '#fff' : colors.primary }]}>Login</Text>
            </Pressable>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={{ 
            paddingBottom: keyboardVisible ? (planCreationStep !== 'idle' ? 300 : 200) : 16,
            flexGrow: 1
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={true}
        >
        {!isAuthenticated && messages.length === 0 && (
          <View style={styles.unauthenticatedContainer}>
            <View style={styles.featureHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Sparkles size={48} color={colors.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Welcome to Planmoni AI
              </Text>
              <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                Your intelligent financial assistant powered by AI
              </Text>
            </View>

            <View style={styles.featuresList}>
              <View style={styles.featureCard}>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureCardTitle, { color: colors.text }]}>
                    Smart Payout Planning
                  </Text>
                  <View style={styles.bulletPoints}>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Create personalized payout schedules in natural language
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Get AI-powered suggestions based on your balance and goals
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Flexible scheduling: daily, weekly, bi-weekly, or monthly
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureCardTitle, { color: colors.text }]}>
                    Conversational Interface
                  </Text>
                  <View style={styles.bulletPoints}>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Chat naturally - no complex forms or confusing menus
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Ask questions like "Help me plan 50k for 2 months"
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        AI guides you through plan creation step-by-step
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureCardTitle, { color: colors.text }]}>
                    Intelligent Insights
                  </Text>
                  <View style={styles.bulletPoints}>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Analyze your spending patterns and payout history
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Get personalized recommendations for better money management
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Track your progress and stay on top of your financial goals
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureCardTitle, { color: colors.text }]}>
                    Automated Execution
                  </Text>
                  <View style={styles.bulletPoints}>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Set it and forget it - plans execute automatically
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Emergency withdrawal options for unexpected needs
                      </Text>
                    </View>
                    <View style={styles.bulletPoint}>
                      <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        Real-time notifications for all payout activities
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.ctaContainer}>
              <Pressable
                style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                onPress={() => requireAuth(() => {}, '/(tabs)/ai-assistant')}
              >
                <Text style={styles.ctaButtonText}>Get Started with Planmoni AI</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Already have an account? Login
                </Text>
              </Pressable>
            </View>
          </View>
        )}
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
            <AlertTriangle size={getScaledFontSize(16, textSizeMultiplier)} color="#E57373" />
            <Text style={styles.errorText}>{createPayoutError}</Text>
          </Animated.View>
        )}
        {/* Plan creation destination selection UI */}
        {planCreationStep === 'awaiting_destination' && !payoutAccountsLoading && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontSize: getScaledFontSize(16, textSizeMultiplier), fontWeight: '600', marginBottom: 8, color: colors.text }}>Your payout accounts:</Text>
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
                        <Text style={{ color: '#fff', fontSize: getScaledFontSize(12, textSizeMultiplier), fontWeight: '600' }}>
                          {account.bank_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Account Details */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: getScaledFontSize(16, textSizeMultiplier), fontWeight: '500' }}>
                      {account.bank_name} ••••{account.account_number.slice(-4)}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: getScaledFontSize(16, textSizeMultiplier), marginTop: 2 }}>
                      {account.account_name}
                    </Text>
                    {account.is_default && (
                      <Text style={{ color: colors.primary, fontSize: getScaledFontSize(14, textSizeMultiplier), fontWeight: '600', marginTop: 2 }}>
                        Default
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => setShowAddAccountModal(true)}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Add New Account
              </Text>
            </Pressable>
          </View>
        )}
        {/* Day of week selection UI */}
        {planCreationStep === 'awaiting_day_of_week' && (
          <View style={{ marginVertical: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: getScaledFontSize(16, textSizeMultiplier), fontWeight: '600', marginBottom: 8, color: colors.text}}>Choose a day of the week:</Text>
            <TextInput
              ref={dayOfWeekInputRef}
              style={{ 
                borderWidth: 1, 
                borderColor: colors.border, 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 8, 
                color: colors.text,
                backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
                fontSize: getScaledFontSize(16, textSizeMultiplier)
              }}
              placeholder="Sunday, Monday, Tuesday, etc."
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              onFocus={() => scrollToInput(dayOfWeekInputRef)}
              returnKeyType="done"
            />
          </View>
        )}
        
        {/* Emergency withdrawal input UI */}
        {planCreationStep === 'awaiting_emergency' && (
          <View style={{ marginVertical: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: getScaledFontSize(16, textSizeMultiplier), fontWeight: '600', marginBottom: 8, color: colors.text}}>Reply "yes" or "no" below:</Text>
            <TextInput
              ref={emergencyInputRef}
              style={{ 
                borderWidth: 1, 
                borderColor: colors.border, 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 10, 
                color: colors.text, 
                fontSize: getScaledFontSize(16, textSizeMultiplier),
                backgroundColor: isDark ? colors.backgroundSecondary : colors.card
              }}
              placeholder="yes or no"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              onFocus={() => scrollToInput(emergencyInputRef)}
              returnKeyType="done"
            />
          </View>
        )}
        {/* Plan confirmation input UI */}
        {planCreationStep === 'confirming' && (
          <View style={{ marginVertical: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: getScaledFontSize(16, textSizeMultiplier), fontWeight: '600', marginBottom: 8, color: colors.text,}}>Type "confirm" to create the plan or "cancel" to abort:</Text>
            <TextInput
              ref={confirmInputRef}
              style={{ 
                borderWidth: 1, 
                borderColor: colors.border, 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 10, 
                color: colors.text, 
                fontSize: getScaledFontSize(16, textSizeMultiplier),
                backgroundColor: isDark ? colors.backgroundSecondary : colors.card
              }}
              placeholder="confirm or cancel"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={e => handlePlanStepInput(e.nativeEvent.text)}
              onFocus={() => scrollToInput(confirmInputRef)}
              returnKeyType="done"
            />
          </View>
        )}
        </ScrollView>

        {showSuggestions && !inputText.trim() && !keyboardVisible && isAuthenticated && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Try asking about:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {generateSuggestedPrompts(availableBalance).map((prompt, index) => (
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

        {planCreationStep === 'idle' && isAuthenticated && (
          <View style={styles.inputContainer}>
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
                  <Send size={getScaledFontSize(20, textSizeMultiplier)} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
        )}
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(14, textSizeMultiplier),
    paddingVertical: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(14, textSizeMultiplier),
    backgroundColor: colors.background,
    borderBottomWidth: getScaledFontSize(0.4, textSizeMultiplier),
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 25 : 20, textSizeMultiplier),
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
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.textSecondary,
  },
  aiIconContainer: {
    width: getScaledFontSize(40, textSizeMultiplier),
    height: getScaledFontSize(40, textSizeMultiplier),
    borderRadius: getScaledFontSize(20, textSizeMultiplier),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
  },
  messageRow: {
    marginBottom: getScaledFontSize(16, textSizeMultiplier),
    maxWidth: '80%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
  },
  aiMessageRow: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: getScaledFontSize(20, textSizeMultiplier),
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: getScaledFontSize(4, textSizeMultiplier),
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: getScaledFontSize(4, textSizeMultiplier),
  },
  planBubble: {
    width: '95%',
  },
  insightBubble: {
    width: '95%',
  },
  messageText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    lineHeight: getScaledFontSize(24, textSizeMultiplier),
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
    marginBottom: getScaledFontSize(16, textSizeMultiplier),
    backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
    borderRadius: getScaledFontSize(20, textSizeMultiplier),
    padding: Platform.OS === 'ios' ? getScaledFontSize(12, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
  },
  typingDot: {
    width: getScaledFontSize(8, textSizeMultiplier),
    height: getScaledFontSize(8, textSizeMultiplier),
    borderRadius: getScaledFontSize(4, textSizeMultiplier),
    backgroundColor: colors.primary,
    marginRight: getScaledFontSize(4, textSizeMultiplier),
  },
  typingText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.textSecondary,
    marginLeft: getScaledFontSize(8, textSizeMultiplier),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(12, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    paddingTop: Platform.OS === 'ios' ? getScaledFontSize(8, textSizeMultiplier) : getScaledFontSize(6, textSizeMultiplier),
    paddingBottom: Platform.OS === 'ios' ? getScaledFontSize(8, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    backgroundColor: colors.surface,
    borderTopWidth: getScaledFontSize(1, textSizeMultiplier),
    borderTopColor: colors.border,
    ...(Platform.OS === 'android' && {
      position: 'relative',
      zIndex: 1000,
    }),
  },
  input: {
    flex: 1,
    backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    paddingVertical: Platform.OS === 'ios' ? getScaledFontSize(12, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.text,
    marginRight: getScaledFontSize(8, textSizeMultiplier),
    maxHeight: getScaledFontSize(120, textSizeMultiplier),
  },
  sendButton: {
    width: getScaledFontSize(48, textSizeMultiplier),
    height: getScaledFontSize(48, textSizeMultiplier),
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  suggestionsContainer: {
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    paddingBottom: Platform.OS === 'ios' ? getScaledFontSize(8, textSizeMultiplier) : getScaledFontSize(6, textSizeMultiplier),
    backgroundColor: colors.surface,
  },
  suggestionsTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: getScaledFontSize(12, textSizeMultiplier),
  },
  suggestionsScroll: {
    flexDirection: 'row',
  },
  suggestionBubble: {
    backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
    borderRadius: getScaledFontSize(16, textSizeMultiplier),
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    paddingVertical: Platform.OS === 'ios' ? getScaledFontSize(12, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    marginRight: getScaledFontSize(8, textSizeMultiplier),
    borderWidth: getScaledFontSize(1, textSizeMultiplier),
    borderColor: colors.border,
  },
  suggestionText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.text,
  },
  planOptions: {
    marginTop: getScaledFontSize(16, textSizeMultiplier),
    gap: getScaledFontSize(12, textSizeMultiplier),
  },
  planOption: {
    backgroundColor: colors.card,
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    borderWidth: getScaledFontSize(1, textSizeMultiplier),
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
  },
  planTitleContainer: {
    flex: 1,
    marginRight: getScaledFontSize(8, textSizeMultiplier),
  },
  planTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    marginBottom: getScaledFontSize(4, textSizeMultiplier),
    flexWrap: 'wrap',
  },
  planAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  planDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    marginBottom: getScaledFontSize(16, textSizeMultiplier),
    flexWrap: 'wrap',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: getScaledFontSize(15, textSizeMultiplier),
    paddingVertical: Platform.OS === 'ios' ? getScaledFontSize(10, textSizeMultiplier) : getScaledFontSize(8, textSizeMultiplier),
    paddingHorizontal: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    gap: getScaledFontSize(8, textSizeMultiplier),
  },
  planButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
  },
  insightsContainer: {
    marginTop: getScaledFontSize(16, textSizeMultiplier),
    gap: getScaledFontSize(12, textSizeMultiplier),
  },
  insightCard: {
    backgroundColor: colors.card,
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    borderWidth: getScaledFontSize(1, textSizeMultiplier),
    borderColor: colors.border,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
  },
  insightTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    flex: 1,
    marginRight: getScaledFontSize(8, textSizeMultiplier),
  },
  insightValue: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  insightDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    flexWrap: 'wrap',
  },
  recommendationsContainer: {
    marginTop: getScaledFontSize(16, textSizeMultiplier),
    backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    padding: Platform.OS === 'ios' ? getScaledFontSize(16, textSizeMultiplier) : getScaledFontSize(10, textSizeMultiplier),
    borderWidth: getScaledFontSize(1, textSizeMultiplier),
    borderColor: colors.border,
  },
  recommendationsTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    marginBottom: getScaledFontSize(12, textSizeMultiplier),
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
  },
  recommendationBullet: {
    width: getScaledFontSize(8, textSizeMultiplier),
    height: getScaledFontSize(8, textSizeMultiplier),
    borderRadius: getScaledFontSize(4, textSizeMultiplier),
    marginTop: getScaledFontSize(6, textSizeMultiplier),
    marginRight: getScaledFontSize(8, textSizeMultiplier),
  },
  recommendationText: {
    flex: 1,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    lineHeight: getScaledFontSize(20, textSizeMultiplier),
    flexWrap: 'wrap',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: getScaledFontSize(24, textSizeMultiplier),
  },
  emptyImage: {
    width: getScaledFontSize(120, textSizeMultiplier),
    height: getScaledFontSize(120, textSizeMultiplier),
    marginBottom: getScaledFontSize(24, textSizeMultiplier),
  },
  emptyTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
    textAlign: 'center',
  },
  emptyText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: getScaledFontSize(24, textSizeMultiplier),
    lineHeight: getScaledFontSize(24, textSizeMultiplier),
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: getScaledFontSize(32, textSizeMultiplier),
    minHeight: 300,
  },
  emptyStateTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 24 : 22, textSizeMultiplier),
    fontWeight: '700',
    marginBottom: getScaledFontSize(12, textSizeMultiplier),
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    textAlign: 'center',
    marginBottom: getScaledFontSize(24, textSizeMultiplier),
    lineHeight: getScaledFontSize(22, textSizeMultiplier),
  },
  loginPromptButton: {
    paddingHorizontal: getScaledFontSize(24, textSizeMultiplier),
    paddingVertical: getScaledFontSize(12, textSizeMultiplier),
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
  },
  loginPromptButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  unauthenticatedContainer: {
    flex: 1,
    paddingHorizontal: getScaledFontSize(20, textSizeMultiplier),
    paddingTop: getScaledFontSize(20, textSizeMultiplier),
    paddingBottom: getScaledFontSize(40, textSizeMultiplier),
  },
  featureHeader: {
    alignItems: 'center',
    marginBottom: getScaledFontSize(32, textSizeMultiplier),
  },
  iconContainer: {
    width: getScaledFontSize(96, textSizeMultiplier),
    height: getScaledFontSize(96, textSizeMultiplier),
    borderRadius: getScaledFontSize(48, textSizeMultiplier),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: getScaledFontSize(16, textSizeMultiplier),
  },
  featureTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 28 : 26, textSizeMultiplier),
    fontWeight: '700',
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    textAlign: 'center',
    lineHeight: getScaledFontSize(22, textSizeMultiplier),
  },
  featuresList: {
    gap: getScaledFontSize(16, textSizeMultiplier),
    marginBottom: getScaledFontSize(32, textSizeMultiplier),
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: getScaledFontSize(16, textSizeMultiplier),
    padding: getScaledFontSize(16, textSizeMultiplier),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  featureIconWrapper: {
    width: getScaledFontSize(48, textSizeMultiplier),
    height: getScaledFontSize(48, textSizeMultiplier),
    borderRadius: getScaledFontSize(24, textSizeMultiplier),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: getScaledFontSize(16, textSizeMultiplier),
  },
  featureContent: {
    flex: 1,
  },
  featureCardTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    marginBottom: getScaledFontSize(12, textSizeMultiplier),
  },
  bulletPoints: {
    gap: getScaledFontSize(8, textSizeMultiplier),
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getScaledFontSize(4, textSizeMultiplier),
  },
  bullet: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '700',
    marginRight: getScaledFontSize(8, textSizeMultiplier),
    lineHeight: getScaledFontSize(22, textSizeMultiplier),
  },
  bulletText: {
    flex: 1,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 13, textSizeMultiplier),
    lineHeight: getScaledFontSize(20, textSizeMultiplier),
  },
  ctaContainer: {
    marginTop: getScaledFontSize(24, textSizeMultiplier),
    gap: getScaledFontSize(12, textSizeMultiplier),
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    height: 55,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: getScaledFontSize(12, textSizeMultiplier),
    borderRadius: 20,
    borderWidth: 1,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '500',
  },
  aiBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: getScaledFontSize(8, textSizeMultiplier),
    gap: getScaledFontSize(4, textSizeMultiplier),
  },
  aiBadgeText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    color: '#888',
    marginLeft: getScaledFontSize(4, textSizeMultiplier),
  },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F3',
    borderRadius: getScaledFontSize(16, textSizeMultiplier),
    padding: getScaledFontSize(12, textSizeMultiplier),
    marginTop: getScaledFontSize(8, textSizeMultiplier),
    marginBottom: getScaledFontSize(8, textSizeMultiplier),
    borderWidth: getScaledFontSize(1, textSizeMultiplier),
    borderColor: '#E57373',
    gap: getScaledFontSize(8, textSizeMultiplier),
  },
  errorText: {
    color: '#E57373',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    flex: 1,
  },
  retryButton: {
    marginLeft: getScaledFontSize(8, textSizeMultiplier),
    paddingHorizontal: getScaledFontSize(10, textSizeMultiplier),
    paddingVertical: getScaledFontSize(4, textSizeMultiplier),
    backgroundColor: '#E57373',
    borderRadius: 20,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
  },
  debugButton: {
    paddingHorizontal: getScaledFontSize(12, textSizeMultiplier),
    paddingVertical: getScaledFontSize(6, textSizeMultiplier),
    borderRadius: 20,
    marginLeft: getScaledFontSize(8, textSizeMultiplier),
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '600',
  },
  closeButton: {
    width: getScaledFontSize(40, textSizeMultiplier),
    height: getScaledFontSize(40, textSizeMultiplier),
    borderRadius: getScaledFontSize(20, textSizeMultiplier),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: getScaledFontSize(8, textSizeMultiplier),
    marginBottom: getScaledFontSize(-10, textSizeMultiplier),
  },
  loginButton: {
    paddingHorizontal: getScaledFontSize(20, textSizeMultiplier),
    paddingVertical: getScaledFontSize(10, textSizeMultiplier),
    borderRadius: getScaledFontSize(20, textSizeMultiplier),
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: getScaledFontSize(8, textSizeMultiplier),
  },
  promptCounter: {
    paddingHorizontal: getScaledFontSize(8, textSizeMultiplier),
    paddingVertical: getScaledFontSize(4, textSizeMultiplier),
    borderRadius: getScaledFontSize(12, textSizeMultiplier),
    minWidth: getScaledFontSize(50, textSizeMultiplier),
    alignItems: 'center',
  },
  promptCounterText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '600',
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    gap: getScaledFontSize(8, textSizeMultiplier),
    marginLeft: getScaledFontSize(8, textSizeMultiplier),
  },
});