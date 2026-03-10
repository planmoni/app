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
import { router, useLocalSearchParams } from 'expo-router';
import { getOpenAIChatCompletion, testOpenAIConnection, type OpenAIMessage, type ToolCall, type FunctionDefinition } from '../../lib/openai';
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
import { supabase } from '@/lib/supabase';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';

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
  const [planCreationStep, setPlanCreationStep] = useState<'idle' | 'awaiting_destination' | 'awaiting_frequency' | 'awaiting_day_of_week' | 'confirming' | 'success'>('idle');
  const [planDraft, setPlanDraft] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const { payoutAccounts, isLoading: payoutAccountsLoading, fetchPayoutAccounts } = usePayoutAccounts();
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const { createPayout, isLoading: isCreatingPayout, error: createPayoutError } = useCreatePayout();
  const { banks } = useBanks();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const isInitialMount = useRef(true);
  const { payoutPlans, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { transactions } = useRealtimeTransactions();
  const { query: queryParam } = useLocalSearchParams<{ query?: string }>();
  
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

  // Build comprehensive system prompt
  const buildSystemPrompt = (): string => {
    const userName = session?.user?.user_metadata?.first_name || 'User';
    const today = new Date().toISOString().split('T')[0];
    
    // Summarize payout plans for context
    const plansSummary = payoutPlans?.length > 0 
      ? payoutPlans.map(p => `${p.name}: ₦${p.payout_amount.toLocaleString()} ${p.frequency} (Status: ${p.status})`).join('; ')
      : 'No active payout plans';
    
    // Summarize payout accounts for context
    const accountsSummary = payoutAccounts?.length > 0
      ? payoutAccounts.map(a => `${a.bank_name} ••••${a.account_number.slice(-4)}`).join('; ')
      : 'No payout accounts added';
    
    return `You are Planmoni AI, an expert financial planning assistant specializing in automated payout scheduling and financial discipline for Nigerian users. You combine deep financial expertise with a warm, professional, and supportive communication style.

═══════════════════════════════════════════════════════════════
ABOUT PLANMONI - YOUR EXPERTISE DOMAIN
═══════════════════════════════════════════════════════════════

Planmoni is a sophisticated financial planning and automated payout scheduling platform designed to help Nigerians build financial discipline through automated money management. As Planmoni AI, you are the expert guide helping users navigate this platform.

CORE FUNCTIONALITY:
• Automated Payout Plans: Users create schedules to automatically disburse money to their bank accounts over time
• Fund Locking: When a plan is created, funds are locked to ensure commitment and discipline
• Real-time Balance Tracking: Users see available, locked, and total balances in real-time
• Multi-Account Management: Users can add multiple payout destination accounts

PAYOUT PLAN SPECIFICATIONS:
• Minimum Amount: ₦5,000 per plan
• Frequencies Available:
  - Daily: Every day at a specified time
  - Weekly: Every week on a specific day
  - Bi-weekly: Every two weeks
  - Monthly: Once per month
  - End-of-Month: Last day of each month
  - Bi-annually: Twice per year
  - Annually: Once per year
  - Custom Dates: User-specified dates
• Funds are automatically deducted from available balance when plan is created

FUNDING OPTIONS:
• Bank Transfer: Direct transfer to user's virtual account
• Paystack Card Payment: Credit/debit card payments
• USSD: Mobile money transfers

═══════════════════════════════════════════════════════════════
CURRENT USER CONTEXT
═══════════════════════════════════════════════════════════════

User Name: ${userName}
Date: ${today} (YYYY-MM-DD format)

Financial Position:
• Available Balance: ₦${availableBalance.toLocaleString()} (funds ready for use)
• Locked Balance: ₦${(lockedBalance || 0).toLocaleString()} (committed to payout plans)
• Total Balance: ₦${balance.toLocaleString()} (available + locked)

Active Payout Plans (${payoutPlans?.length || 0}):
${plansSummary}

Payout Accounts (${payoutAccounts?.length || 0}):
${accountsSummary}

═══════════════════════════════════════════════════════════════
YOUR ROLE AS EXPERT FINANCIAL PLANNER
═══════════════════════════════════════════════════════════════

As Planmoni AI, you are an expert financial planner with deep knowledge of:
1. Financial Planning Principles: Budgeting, goal-setting, disciplined saving, automated money management
2. Nigerian Financial Context: Understanding of local economic conditions, banking practices, and financial behaviors
3. Payout Plan Optimization: Helping users choose the right frequency, amount, and duration for their goals
4. Financial Discipline: Strategies for building and maintaining financial habits
5. Planmoni Platform: Complete mastery of all features, limitations, and best practices

YOUR RESPONSIBILITIES:
1. Answer all questions about Planmoni features, functionality, and best practices with expert knowledge
2. Create accurate, optimized payout plans based on user goals, financial situation, and preferences
3. Provide professional financial planning advice tailored to Nigerian users
4. Explain financial concepts, strategies, and calculations clearly and professionally
5. Analyze user's financial situation and provide actionable insights
6. Guide users through payout plan creation with attention to detail
7. Suggest strategies for better money management and financial discipline
8. Help users understand their balance, plans, and financial position

═══════════════════════════════════════════════════════════════
COMMUNICATION STYLE & PROFESSIONAL STANDARDS
═══════════════════════════════════════════════════════════════

TONE & APPROACH:
• Professional: Speak as an expert financial planner with authority and knowledge
• Warm & Supportive: Be encouraging and understanding, especially when users face financial challenges
• Clear & Precise: Use clear language, avoid jargon unless explaining it, provide specific numbers
• Proactive: Anticipate user needs and provide comprehensive guidance
• Educational: Help users understand financial concepts and make informed decisions

RESPONSE FORMATTING:
• Use Nigerian Naira (₦) for all monetary amounts
• Format large numbers with commas (e.g., ₦1,500,000)
• Provide specific calculations when relevant
• Break down complex information into digestible points
• Use examples to illustrate concepts when helpful

═══════════════════════════════════════════════════════════════
PAYOUT PLAN CREATION - EXPERT GUIDELINES
═══════════════════════════════════════════════════════════════

When helping users create payout plans, follow these expert practices:

1. REQUIREMENT VERIFICATION (MANDATORY - DO NOT SKIP):
   • **MUST** call get_user_balance FIRST before suggesting or creating any plan
   • **MUST** verify availableBalance >= totalAmount before calling create_payout_plan
   • **MUST** call get_payout_accounts to verify at least one account exists
   • If balance is insufficient: Inform user clearly, show shortfall, suggest adding funds. DO NOT create plan.
   • If no accounts: Guide user to add accounts first. DO NOT create plan.
   • Ensure plan amount meets minimum (₦5,000)
   • Calculate if user has sufficient funds for the entire plan duration
   • **NEVER** call create_payout_plan without first checking balance - this causes errors

2. PLAN OPTIMIZATION:
   • Recommend appropriate frequency based on user's goals and timeframe
   • Calculate optimal payout amounts considering fees and user's financial capacity
   • Suggest realistic durations that align with user's financial goals
   • Consider user's income pattern when recommending frequencies
   • For large amounts, suggest longer durations to build discipline
   • For smaller amounts, suggest shorter durations for flexibility

3. ACCURACY REQUIREMENTS:
   • Total amount must match user's goal
   • Payout amount must be calculated correctly based on frequency and duration
   • Duration must be specified in appropriate units (days for daily, weeks for weekly, months for monthly)
   • Start date should be realistic (not in the past)
   • For weekly_specific frequency, dayOfWeek must be provided (0=Sunday, 1=Monday, etc.)
   • For custom dates, provide array of dates in YYYY-MM-DD format

4. USER EDUCATION:
   • Explain how the plan will work (when funds will be locked, when payouts occur)
   • Set realistic expectations about the commitment involved
   • Suggest adding funds if current balance is insufficient

5. ERROR PREVENTION:
   • Never create plans without user's explicit confirmation
   • Always verify sufficient balance before plan creation
   • Always verify payout account exists before plan creation
   • Double-check all calculations before presenting to user
   • Warn users if plan amount exceeds available balance

═══════════════════════════════════════════════════════════════
FINANCIAL PLANNING EXPERTISE
═══════════════════════════════════════════════════════════════

When providing financial advice, demonstrate expertise in:

1. GOAL-BASED PLANNING:
   • Help users identify and prioritize financial goals
   • Create payout plans that align with specific objectives (savings, bill payments, investments)
   • Suggest appropriate timeframes for different types of goals

2. BUDGETING & CASH FLOW:
   • Analyze user's balance and spending patterns
   • Suggest payout frequencies that match income cycles
   • Help users balance available and locked funds effectively

3. FINANCIAL DISCIPLINE:
   • Explain benefits of automated payouts for building discipline
   • Suggest strategies for maintaining financial commitments
   • Provide encouragement and motivation for financial goals

4. NIGERIAN FINANCIAL CONTEXT:
   • Consider local economic conditions and inflation
   • Understand Nigerian banking practices and transfer times
   • Account for common financial challenges in Nigeria
   • Suggest realistic financial goals for Nigerian context

5. RISK MANAGEMENT:
   • Help users balance locked funds with available funds
   • Suggest maintaining emergency reserves outside of payout plans

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════

FUNCTION CALLING REQUIREMENTS:
• ALWAYS use function calls to get real-time data (get_user_balance, get_user_plans, get_payout_accounts)
• NEVER assume user's balance, plans, or accounts without checking
• ALWAYS use create_payout_plan function when user wants to create a plan
• Verify all data before making recommendations

PLAN CREATION WORKFLOW (MANDATORY STEPS):
1. User expresses desire to create a payout plan
2. **MUST FIRST** call get_user_balance to check available funds - NEVER skip this step
3. **MUST** call get_payout_accounts to verify accounts exist - NEVER skip this step
4. **VERIFY** that availableBalance >= totalAmount before proceeding
5. If insufficient balance: Inform user of current balance, required amount, and shortfall. Suggest adding funds. DO NOT call create_payout_plan.
6. If no accounts: Guide user to add payout accounts first. DO NOT call create_payout_plan.
7. Only if balance is sufficient AND accounts exist: Extract or clarify amount, frequency, duration, start date, account
8. Calculate payout amount accurately
9. Use create_payout_plan function with all required parameters
10. Confirm success and explain what happens next

CRITICAL: You MUST check balance BEFORE calling create_payout_plan. Never call create_payout_plan without first verifying sufficient balance via get_user_balance. This prevents errors and provides a better user experience.

RESPONSE ACCURACY:
• Provide specific numbers, not ranges or approximations
• Calculate fees, amounts, and durations precisely
• Verify all calculations before presenting to user
• Use function calls to ensure data accuracy
• Never make up or assume financial information

PROFESSIONAL BOUNDARIES:
• Never create plans without explicit user request
• Never access or modify user data without permission
• Always explain actions before executing them
• Handle errors gracefully with clear explanations
• Maintain user privacy and data security
• Do NOT support emergency withdrawal requests via AI - if users ask to withdraw early from a plan, politely direct them to use the app's payout plan or wallet screens for such actions

═══════════════════════════════════════════════════════════════
EXAMPLE INTERACTIONS
═══════════════════════════════════════════════════════════════

Example 1 - Plan Creation (with sufficient balance):
User: "I want to save 500k over 6 months"
You: "I'll help you create a payout plan for ₦500,000 over 6 months. Let me check your current balance and payout accounts first." [Call get_user_balance and get_payout_accounts]
"Great! You have ₦[amount] available, which is sufficient for this plan. I recommend a monthly payout plan of ₦83,333 per month. Would you like me to create this plan?" [If yes, call create_payout_plan]

Example 1b - Plan Creation (insufficient balance):
User: "I want to save 500k over 6 months"
You: "I'll help you create a payout plan for ₦500,000 over 6 months. Let me check your current balance first." [Call get_user_balance]
"I see you currently have ₦[amount] available, but you need ₦500,000 for this plan. You'll need to add ₦[shortfall] more. Would you like me to help you add funds, or would you prefer to adjust the plan amount?"

Example 2 - Financial Advice:
User: "How can I better manage my money?"
You: "Based on your current balance of ₦[amount] and [X] active payout plans, here are some strategies: 1) Consider creating a monthly payout plan for regular expenses to build discipline, 2) Maintain 20-30% of your balance as available funds for emergencies, 3) Use automated payouts to separate savings from spending money. Would you like me to help you set up a specific plan?"

Example 3 - Balance Inquiry:
User: "How much do I have?"
You: [Use get_user_balance function] "You currently have ₦[available] available, ₦[locked] locked in payout plans, for a total balance of ₦[total]. You have [X] active payout plans scheduled."

═══════════════════════════════════════════════════════════════

Remember: You are Planmoni AI, an expert financial planner. Your role is to provide professional, accurate, and helpful guidance that empowers users to achieve their financial goals through disciplined, automated money management. Always prioritize accuracy, user education, and financial well-being.`;
  };

  // Function definitions for OpenAI
  const getFunctionDefinitions = (): FunctionDefinition[] => {
    return [
      {
        type: 'function',
        function: {
          name: 'get_user_balance',
          description: 'Get the user\'s current balance information including available, total, and locked balances.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_plans',
          description: 'Get all active payout plans for the user. Returns plan details including name, amount, frequency, status, and next payout date.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_payout_accounts',
          description: 'Get all payout accounts (bank accounts) where the user can receive payouts.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_payout_plan',
          description: 'Create a new payout plan for the user. IMPORTANT: You MUST call get_user_balance FIRST to verify the user has sufficient available balance (availableBalance >= totalAmount) before calling this function. If balance is insufficient, inform the user and do NOT call this function. Requires all plan details including name, total amount, payout amount, frequency, duration, start date, and payout account ID.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the payout plan' },
              totalAmount: { type: 'number', description: 'Total amount to be paid out over the plan duration' },
              payoutAmount: { type: 'number', description: 'Amount per payout' },
              frequency: { 
                type: 'string', 
                enum: ['daily', 'weekly', 'biweekly', 'monthly', 'end_of_month', 'biannual', 'annually', 'weekly_specific', 'custom'],
                description: 'Frequency of payouts'
              },
              duration: { type: 'number', description: 'Duration in days (for daily) or number of payouts (for other frequencies)' },
              startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
              payoutAccountId: { type: 'string', description: 'ID of the payout account to receive funds' },
              dayOfWeek: { type: 'number', description: 'Day of week (0=Sunday, 6=Saturday) for weekly_specific frequency' },
              payoutHour: { type: 'number', description: 'Hour of day for payout (0-23)', default: 9 },
              payoutMinute: { type: 'number', description: 'Minute of hour for payout (0-59)', default: 0 },
              customDates: { type: 'array', items: { type: 'string' }, description: 'Array of custom dates in YYYY-MM-DD format for custom frequency' },
            },
            required: ['name', 'totalAmount', 'payoutAmount', 'frequency', 'duration', 'startDate', 'payoutAccountId'],
          },
        },
      },
    ];
  };

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

  // Execute function calls from OpenAI
  const executeFunctionCall = async (functionName: string, args: any): Promise<any> => {
    try {
      switch (functionName) {
        case 'get_user_balance':
          return {
            availableBalance,
            totalBalance: balance,
            lockedBalance: lockedBalance || 0,
          };
        
        case 'get_user_plans':
          await fetchPayoutPlans();
          return {
            payoutPlans: payoutPlans.map(p => ({
              id: p.id,
              name: p.name,
              status: p.status,
              totalAmount: p.total_amount,
              payoutAmount: p.payout_amount,
              frequency: p.frequency,
              nextPayoutDate: p.next_payout_date,
            })),
          };
        
        case 'get_payout_accounts':
          await fetchPayoutAccounts();
          return {
            accounts: payoutAccounts.map(a => ({
              id: a.id,
              bankName: a.bank_name,
              accountNumber: a.account_number,
              accountName: a.account_name,
              isDefault: a.is_default,
            })),
          };
        
        case 'create_payout_plan':
          // Check balance before creating plan
          if (args.totalAmount > availableBalance) {
            const shortfall = args.totalAmount - availableBalance;
            throw new Error(`Insufficient available balance. You have ₦${availableBalance.toLocaleString()} available, but need ₦${args.totalAmount.toLocaleString()} for this plan. You need to add ₦${shortfall.toLocaleString()} more. Please add funds first.`);
          }
          
          await createPayout({
            name: args.name,
            totalAmount: args.totalAmount,
            payoutAmount: args.payoutAmount,
            frequency: args.frequency,
            duration: args.duration,
            startDate: args.startDate,
            payoutAccountId: args.payoutAccountId,
            emergencyWithdrawalEnabled: false,
            dayOfWeek: args.dayOfWeek,
            payoutHour: args.payoutHour || 9,
            payoutMinute: args.payoutMinute || 0,
            customDates: args.customDates || [],
          });
          await fetchPayoutPlans();
          return { success: true, message: 'Payout plan created successfully' };
        
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error: any) {
      console.error(`Error executing function ${functionName}:`, error);
      throw error;
    }
  };

  // Simplified handleSendMessage - all responses go through OpenAI. Pass optional text to send (e.g. from FAQ deep link).
  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend) return;

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

    // Check rate limiting
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.canProceed) {
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

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      sender: 'user',
      type: 'text',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideText) setInputText('');
    setShowSuggestions(false);
    setIsTyping(true);
    setError(null);
    setLastUserMessage(textToSend);

    // Update rate limiting counters
    const now = Date.now();
    const newCount = dailyPromptCount + 1;
    setLastPromptTime(now);
    setDailyPromptCount(newCount);

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

    // Call OpenAI with function calling
    try {
      await generateAIResponseWithFunctions(textToSend);
    } catch (error: any) {
      console.error('AI Response Error:', error);
      setError(error.message || 'Failed to get AI response. Please try again.');
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: error.message || 'I apologize, but I encountered an error processing your request. Please try again.',
      sender: 'ai',
      type: 'text',
      timestamp: new Date(),
    };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
    setIsTyping(false);
    }
  };

  // Consume query param from FAQ deep link: pre-fill and auto-send (once per param)
  const consumedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const q = typeof queryParam === 'string' ? queryParam : undefined;
    if (!q?.trim() || consumedQueryRef.current === q) return;
    consumedQueryRef.current = q;
    const timer = setTimeout(() => {
      handleSendMessage(q);
      router.setParams({ query: undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [queryParam]);

  // Generate AI response with function calling
  const generateAIResponseWithFunctions = async (userMessage: string) => {
    // Build conversation history
    const conversationHistory: OpenAIMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages
        .filter(m => m.sender === 'user' || m.sender === 'ai')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        })),
      { role: 'user', content: userMessage },
    ];

    let maxIterations = 5;
    let currentMessages = conversationHistory;

    while (maxIterations > 0) {
      maxIterations--;

      // Call OpenAI
      const response = await getOpenAIChatCompletion({
        messages: currentMessages,
        model: 'gpt-4-turbo-preview',
        temperature: 0.7,
        max_tokens: 2000,
        tools: getFunctionDefinitions(),
      });

      // If there are tool calls, execute them
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.tool_calls,
        });

        // Execute all tool calls
        for (const toolCall of response.tool_calls) {
          try {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResult = await executeFunctionCall(functionName, functionArgs);

            // Add tool result message
            currentMessages.push({
              role: 'tool',
              content: JSON.stringify(functionResult),
              tool_call_id: toolCall.id,
              name: functionName,
            });
          } catch (error: any) {
            console.error(`Error executing function ${toolCall.function.name}:`, error);
            currentMessages.push({
              role: 'tool',
              content: JSON.stringify({ error: error.message }),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }

        // Continue loop to get final response
        continue;
      }

      // No tool calls - this is the final response
      if (response.content) {
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: response.content,
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
      break;
    }
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
    generateAIResponseWithFunctions(lastUserMessage);
  };

  // All manual response functions removed - using OpenAI function calling only
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



  // Render formatted text with support for headers (###, ##, #), bold (**text**), and bullet points (-)
  const renderFormattedText = (text: string, isUser: boolean) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      // Check for markdown headers: ###, ##, #
      const headerMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);
      if (headerMatch) {
        const level = headerMatch[1].length as 1 | 2 | 3;
        const headerText = headerMatch[2];
        const headerStyle = level === 1 ? styles.header1 : level === 2 ? styles.header2 : styles.header3;
        elements.push(
          <Text
            key={`header-${lineIndex}`}
            style={[
              headerStyle,
              isUser ? styles.userText : [styles.aiText, { color: colors.text }],
              lineIndex > 0 ? { marginTop: getScaledFontSize(12, textSizeMultiplier) } : {},
            ]}
          >
            {headerText}
          </Text>
        );
        return;
      }
      // Check if line is a bullet point
      const isBulletPoint = trimmedLine.startsWith('-');
      const bulletText = isBulletPoint ? trimmedLine.substring(1).trim() : trimmedLine;
      
      // Parse bold text (**text**)
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      const boldRegex = /\*\*(.+?)\*\*/g;
      let match;
      let lastIndex = 0;
      
      while ((match = boldRegex.exec(bulletText)) !== null) {
        // Add text before bold
        if (match.index > lastIndex) {
          parts.push(
            <Text key={`text-${lineIndex}-${lastIndex}`} style={[
              styles.messageText,
              isUser ? styles.userText : [styles.aiText, { color: colors.text }]
            ]}>
              {bulletText.substring(lastIndex, match.index)}
            </Text>
          );
        }
        
        // Add bold text
        parts.push(
          <Text key={`bold-${lineIndex}-${match.index}`} style={[
            styles.messageText,
            isUser ? styles.userText : [styles.aiText, { color: colors.text }],
            { fontWeight: '700' }
          ]}>
            {match[1]}
          </Text>
        );
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text after last bold
      if (lastIndex < bulletText.length) {
        parts.push(
          <Text key={`text-${lineIndex}-${lastIndex}`} style={[
            styles.messageText,
            isUser ? styles.userText : [styles.aiText, { color: colors.text }]
          ]}>
            {bulletText.substring(lastIndex)}
          </Text>
        );
      }
      
      // If no bold markers found, use the whole line
      if (parts.length === 0) {
        parts.push(
          <Text key={`text-${lineIndex}`} style={[
            styles.messageText,
            isUser ? styles.userText : [styles.aiText, { color: colors.text }]
          ]}>
            {bulletText}
          </Text>
        );
      }
      
      // Render as bullet point or regular line
      if (isBulletPoint) {
        elements.push(
          <View key={`line-${lineIndex}`} style={styles.bulletPointContainer}>
            <Text style={[
              styles.bulletPointMarker,
              isUser ? styles.userText : [styles.aiText, { color: colors.text }]
            ]}>•</Text>
            <View style={styles.bulletPointTextContainer}>
              {parts}
            </View>
          </View>
        );
      } else {
        elements.push(
          <View key={`line-${lineIndex}`} style={lineIndex > 0 ? { marginTop: getScaledFontSize(4, textSizeMultiplier) } : {}}>
            {parts}
          </View>
        );
      }
    });
    
    return <View>{elements}</View>;
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
              {renderFormattedText(message.content, false)}
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
            {renderFormattedText(message.content, isUser)}
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
            {renderFormattedText(message.content, false)}
            
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
                    onPress={() => {
                      // AI will handle plan creation through function calling
                      const planMessage = `Create a ${plan.frequency} payout plan for ₦${plan.amount.toLocaleString()}${plan.duration ? ` for ${plan.duration} ${plan.frequency === 'daily' ? 'days' : plan.frequency === 'weekly' ? 'weeks' : 'months'}` : ''}`;
                      setInputText(planMessage);
                      handleSendMessage();
                    }}
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
            {renderFormattedText(message.content, false)}
            
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
            </View>

            

            <View style={styles.ctaContainer}>
              <Pressable
                style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                onPress={() => requireAuth(() => {}, '/(tabs)/ai-assistant')}
              >
                <Text style={styles.ctaButtonText}>Get Started</Text>
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
                  onPress={() => {
                    // AI will handle account selection through function calling
                    const accountMessage = `Use ${account.bank_name} account ending in ${account.account_number.slice(-4)}`;
                    setInputText(accountMessage);
                    handleSendMessage();
                  }}
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
              onSubmitEditing={e => {
                // AI will handle input through function calling
                setInputText(e.nativeEvent.text);
                handleSendMessage();
              }}
              onFocus={() => scrollToInput(dayOfWeekInputRef)}
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
              onSubmitEditing={e => {
                // AI will handle input through function calling
                setInputText(e.nativeEvent.text);
                handleSendMessage();
              }}
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
                onPress={() => handleSendMessage()}
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
            // AI will handle account selection through function calling
            const accountMessage = `Use ${newAccount.bank_name} account ending in ${newAccount.account_number.slice(-4)}`;
            setInputText(accountMessage);
            handleSendMessage();
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
  header1: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 22 : 20, textSizeMultiplier),
    fontWeight: '700',
    lineHeight: getScaledFontSize(28, textSizeMultiplier),
  },
  header2: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 20 : 18, textSizeMultiplier),
    fontWeight: '700',
    lineHeight: getScaledFontSize(26, textSizeMultiplier),
  },
  header3: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    lineHeight: getScaledFontSize(24, textSizeMultiplier),
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
  bulletPointContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: getScaledFontSize(4, textSizeMultiplier),
  },
  bulletPointMarker: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '700',
    marginRight: getScaledFontSize(8, textSizeMultiplier),
    lineHeight: getScaledFontSize(24, textSizeMultiplier),
  },
  bulletPointTextContainer: {
    flex: 1,
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