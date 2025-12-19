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
import { getOpenAIChatCompletion, testOpenAIConnection, type Message as OpenAIMessage, type ToolCall } from '../../lib/openai';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useEmergencyWithdrawal } from '@/hooks/useEmergencyWithdrawal';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
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
import { CATEGORIES } from '@/lib/expenseCategories';
import { supabase } from '@/lib/supabase';

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
    "Create a travel budget",
    "Set up weekly payouts",
    "Show my plans",
    "Check my balance",
    "Financial advice",
  ];
};

// OpenAI Function Definitions
const getFunctionDefinitions = () => [
  {
    type: 'function' as const,
    function: {
      name: 'create_payout_plan',
      description: `Create a new payout plan that schedules automatic payouts from the user's wallet to their bank account. 
      
WORKFLOW:
1. ALWAYS call get_user_balance first to verify available balance >= totalAmount
2. ALWAYS call get_payout_accounts first to get valid payoutAccountId
3. Validate: minimum totalAmount is ₦5,000, startDate must be today or future
4. Calculate payoutAmount if not provided: totalAmount / duration
5. IMPORTANT: Funds are LOCKED immediately upon creation (deducted from available balance)
6. Duration interpretation: daily=days, weekly/biweekly=weeks, monthly=months, etc.

VALIDATION:
- Minimum totalAmount: ₦5,000
- Available balance must be >= totalAmount (enforced by database)
- Duration must be > 0
- Start date must be today or future (YYYY-MM-DD format)
- For 'weekly_specific': dayOfWeek is REQUIRED (0-6, Sunday=0, Monday=1, etc.)
- For 'custom': customDates array is REQUIRED with at least one date
- payoutAccountId must be a valid account ID from get_payout_accounts

EXAMPLES:
- "Create weekly payout plan for ₦50,000 over 3 months" → totalAmount=50000, frequency=weekly, duration=12 (weeks), calculate payoutAmount=4167
- "Daily payout of ₦5,000 for 30 days" → totalAmount=150000, frequency=daily, duration=30, payoutAmount=5000
- "Monthly payout of ₦100,000 for 6 months" → totalAmount=600000, frequency=monthly, duration=6, payoutAmount=100000

IMPORTANT NOTES:
- Funds are LOCKED immediately - user cannot use locked funds for other purposes
- If user has insufficient balance, inform them before calling this function
- If user has no payout accounts, ask them to add one first using get_payout_accounts`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the payout plan (e.g., "Weekly Savings Plan", "Monthly Salary Payout")' },
          totalAmount: { type: 'number', description: 'Total amount to payout over the duration (minimum ₦5,000). This amount will be locked from wallet.' },
          payoutAmount: { type: 'number', description: 'Amount per individual payout. If not provided, calculate as totalAmount / duration.' },
          frequency: { 
            type: 'string', 
            enum: ['daily', 'weekly', 'biweekly', 'monthly', 'custom', 'weekly_specific', 'end_of_month', 'quarterly', 'biannual', 'annually'],
            description: 'Frequency of payouts. Duration units: daily=days, weekly/biweekly=weeks, monthly=months, quarterly=quarters, biannual=6-month periods, annually=years'
          },
          duration: { type: 'number', description: 'Duration in cycles. For daily: number of days. For weekly: number of weeks. For monthly: number of months. Must be > 0.' },
          startDate: { type: 'string', format: 'date', description: 'Start date in YYYY-MM-DD format. Must be today or a future date.' },
          payoutAccountId: { type: 'string', description: 'Payout account ID from get_payout_accounts. This is where funds will be sent. REQUIRED - call get_payout_accounts first if not provided.' },
          emergencyWithdrawalEnabled: { type: 'boolean', description: 'Whether to enable emergency withdrawals. If true, user can withdraw early with fees: 12% (instant), 10% (24hrs), 6% (72hrs). Default: false' },
          dayOfWeek: { type: 'number', description: 'Day of week (0-6, Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6). REQUIRED for weekly_specific frequency.' },
          payoutHour: { type: 'number', description: 'Hour of day (0-23) for payout time. Default: 9 (9 AM).' },
          payoutMinute: { type: 'number', description: 'Minute (0-59) for payout time. Default: 0.' },
          customDates: { type: 'array', items: { type: 'string', format: 'date' }, description: 'Array of specific payout dates in YYYY-MM-DD format. REQUIRED for custom frequency. Must have at least one date.' },
        },
        required: ['name', 'totalAmount', 'payoutAmount', 'frequency', 'duration', 'startDate', 'payoutAccountId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_budget_plan',
      description: `Create a new budget plan to help users allocate funds for specific expenses or goals. 
      
WORKFLOW:
1. Call get_user_balance (informational - funds are NOT locked automatically)
2. Validate: minimum totalBudget is ₦1,000
3. REQUIRED: Always infer and provide categories and subcategories based on user's request
   - If user says "travel", use categories=["air_travel"] and appropriate subcategories
   - If user says "groceries" or "food", use categories=["food"] and subcategories
   - Always provide at least one category and one subcategory
4. Validate dates: Ensure dates are in YYYY-MM-DD format and valid
5. Convert categories/subcategories to buckets format (each subcategory becomes a bucket)
6. IMPORTANT: Funds are NOT locked - user must add funds manually using add_funds_to_budget
7. After creation, suggest adding funds to the plan

VALIDATION:
- Minimum totalBudget: ₦1,000
- Start date can be null (for ongoing plans)
- End date can be null (for ongoing plans)
- If both dates are null, plan is ongoing
- Categories/subcategories are optional but recommended
- Funding method defaults to 'manual' if not specified

CATEGORY HANDLING (REQUIRED):
- ALWAYS provide both categories AND subcategories arrays when creating a budget
- Categories are stored as array of category IDs: ["air_travel", "car_maintenance"]
- Subcategories MUST be provided as array of objects with category_id and subcategory_id
- Each subcategory becomes a bucket with target_amount distributed evenly
- Suggest categories based on user's description: travel→air_travel, car→car_maintenance, food→food, etc.
- If user doesn't specify categories, infer from the budget name/description
- Common mappings: travel→air_travel, car→car_maintenance, food→food, education→education, shopping→shopping, etc.

EXAMPLES:
- "Create budget for ₦100,000 for travel" → totalBudget=100000, categories=["air_travel"], subcategories=[{category_id:"air_travel", subcategory_id:"flight_tickets"}]
- "Budget ₦50,000 for car maintenance" → totalBudget=50000, categories=["car_maintenance"], subcategories=[{category_id:"car_maintenance", subcategory_id:"car_repair"}]
- "Create ₦200,000 budget for education expenses" → totalBudget=200000, categories=["education"], subcategories=[{category_id:"education", subcategory_id:"tuition"}]

DATE HANDLING (CRITICAL - ALWAYS CONFIRM IF UNCLEAR):
- Dates MUST be in YYYY-MM-DD format (e.g., "2025-01-15" for January 15, 2025)
- CRITICAL: Check the USER CONTEXT section for TODAY'S DATE - ALWAYS use that exact date as the reference point
- "tomorrow" = TODAY'S DATE (from USER CONTEXT) + 1 day
- ALWAYS calculate relative dates from TODAY's date shown in USER CONTEXT
- If user's date intent is unclear or ambiguous, ASK FOR CONFIRMATION before proceeding

RELATIVE DATE EXAMPLES:
- "next week" or "in 1 week" → Calculate: today + 7 days
- "next 3 days" or "in 3 days" → Calculate: today + 3 days
- "next month" → Calculate: first day of next month (e.g., if today is Jan 15, 2025 → "2025-02-01")
- "end of month" or "month end" → Calculate: last day of current month (e.g., "2025-01-31")
- "till month end" → Calculate: last day of current month
- "next 2 weeks" → Calculate: today + 14 days
- "for the next 1 week" → startDate: today, endDate: today + 6 days (7 days total)
- "upcoming expense in the next 3 days and would last till month end" → startDate: today + 3 days, endDate: last day of current month
- "January" or "Jan" → Use current year and first day: "2025-01-01" (if in past, use next year)
- "this month" → Use first day of current month
- "next year" → Use first day of next year

DURATION EXAMPLES (CRITICAL FOR ACCURACY):
- "traveling tomorrow for 5 days" → startDate: tomorrow, endDate: tomorrow + 4 days (5 days: day 1=tomorrow, day 2, day 3, day 4, day 5)
- "starting Monday for 1 week" → startDate: Monday, endDate: Sunday (7 days: Mon-Sun)
- "period of stay is 5 days" starting "tomorrow" → startDate: tomorrow, endDate: tomorrow + 4 days
- "I want to spend for 5 days" starting "tomorrow" → startDate: tomorrow, endDate: tomorrow + 4 days
- ALWAYS: endDate = startDate + (duration - 1) for day-based durations

DATE CALCULATION RULES:
1. Always use TODAY as the reference point for relative dates
2. "next X days/weeks/months" means starting from today + X
3. "till month end" means the last day of the current month
4. "would last till month end" means end date is last day of current month
5. If user says "for the next 1 week" → duration is 7 days from today
6. If user says "upcoming expense in the next 3 days" → start date is today + 3 days

DURATION CALCULATION (CRITICAL):
- When user specifies a duration period (e.g., "5 days", "1 week", "2 months"):
  * If start date is given: endDate = startDate + (duration - 1) days
  * Example: "traveling tomorrow for 5 days" → startDate = tomorrow, endDate = tomorrow + 4 days (5 days total including start day)
  * Example: "starting January 1st for 1 week" → startDate = Jan 1, endDate = Jan 7 (7 days: Jan 1-7)
- "X days" means X calendar days INCLUDING the start date
- "My period of stay is 5 days" starting "tomorrow" → endDate = tomorrow + 4 days
- Always calculate: endDate = startDate + (duration - 1) for day-based durations

CONFIRMATION REQUIRED:
- If user says vague dates like "soon", "later", "eventually" → ASK: "When would you like this to start? (e.g., next week, January 1st, etc.)"
- If user says "next week" but it's unclear which day → ASK: "Would you like it to start on [calculated date], or a specific day?"
- If user says "month end" but unclear which month → ASK: "Do you mean the end of this month ([date]) or next month ([date])?"
- If duration is unclear (e.g., "for a while") → ASK: "How long should this budget last? (e.g., 1 week, 1 month, 3 months)"
- If both start and end dates are unclear → ASK: "When should this budget start and end?"

VALIDATION:
- Always validate dates are in the future (or today) for start dates
- If calculated date is in the past, use today instead
- If date is invalid or in wrong format, set to null and inform user
- If unsure about date interpretation, ALWAYS confirm with user before creating the plan

IMPORTANT NOTES:
- Funds are NOT locked automatically - user adds funds separately using add_funds_to_budget
- User can create budget plan even with ₦0 balance (they add funds later)
- IMPORTANT: Dates are always saved if provided - unfunded budgets with dates will appear in "Your budget plans" section (not "Ongoing Budgets") until they have funds
- Budgets are only considered "started" when they have funds AND the start_date has passed
- After creating an unfunded budget, ALWAYS prompt the user about funding options:
  * "Would you like to add funds to this budget plan now?"
  * "You can fund it manually or set up automatic top-ups"
  * Offer to help them add funds using add_funds_to_budget function or set up auto top-ups`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the budget plan (e.g., "Travel Budget", "Car Maintenance Fund", "Education Savings")' },
          totalBudget: { type: 'number', description: 'Total budget amount (minimum ₦1,000). This is the target amount, not locked automatically.' },
          startDate: { type: 'string', format: 'date', description: 'Start date in YYYY-MM-DD format (e.g., "2025-01-15"). Calculate from relative dates: "next week" = today+7 days, "next 3 days" = today+3 days, "next month" = first day of next month. Can be null for ongoing plans. ALWAYS confirm with user if date intent is unclear.' },
          endDate: { type: 'string', format: 'date', description: 'End date in YYYY-MM-DD format (e.g., "2025-02-15"). Calculate from relative dates: "till month end" = last day of current month, "for 1 week" = startDate+7 days. Can be null for ongoing plans. If both start and end are null, plan is ongoing. ALWAYS confirm with user if date intent is unclear.' },
          fundingMethod: { type: 'string', enum: ['auto', 'manual'], description: 'Funding method: "auto" for automatic top-ups, "manual" for user-initiated. Default: "manual".' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Array of category IDs (e.g., ["air_travel", "car_maintenance", "education"]). Optional but recommended. Suggest based on user\'s needs.' },
          subcategories: { 
            type: 'array', 
            items: { 
              type: 'object',
              properties: {
                category_id: { type: 'string', description: 'Category ID (e.g., "air_travel")' },
                subcategory_id: { type: 'string', description: 'Subcategory ID (e.g., "flight_tickets")' },
                name: { type: 'string', description: 'Optional: Display name for the bucket. If not provided, will be generated from category/subcategory IDs.' }
              },
              required: ['category_id', 'subcategory_id']
            },
            description: 'Array of subcategory objects. Each becomes a bucket. If target_amount not specified, totalBudget is distributed evenly across buckets.'
          },
          autoTopupEnabled: { type: 'boolean', description: 'Whether to enable automatic top-up. If true, requires autoTopupFrequency and autoTopupAmount. Default: false' },
          autoTopupFrequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Auto top-up frequency if autoTopupEnabled is true. Required if autoTopupEnabled=true.' },
          autoTopupAmount: { type: 'number', description: 'Amount per auto top-up if autoTopupEnabled is true. Required if autoTopupEnabled=true.' },
        },
        required: ['name', 'totalBudget']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_user_plans',
      description: 'Get all of the user\'s payout plans and budget plans with their current status, amounts, and details. Use this to show user their existing plans or check plan status.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_user_balance',
      description: `Get the user's wallet balance information. ALWAYS call this BEFORE creating any plan to verify available funds.
      
BALANCE EXPLANATION:
- totalBalance: Total funds in wallet (available + locked)
- lockedBalance: Funds locked in active payout plans (cannot be used for other purposes)
- availableBalance: Funds available for use (totalBalance - lockedBalance)

IMPORTANT:
- For payout plans: availableBalance must be >= totalAmount (funds are locked immediately)
- For budget plans: availableBalance is informational only (funds are NOT locked automatically)
- Always check balance before creating payout plans to avoid errors`,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'process_emergency_withdrawal',
      description: `Process an emergency withdrawal from a payout plan. This allows early withdrawal before scheduled payout dates.
      
PREREQUISITES:
- Plan must have emergencyWithdrawalEnabled = true
- Withdrawal amount cannot exceed available locked funds in the plan
- User must have a payout account (use get_payout_accounts)

FEES:
- instant: 12% processing fee (fastest, highest fee)
- 24hrs: 10% processing fee (24-hour processing)
- 72hrs: 6% processing fee (72-hour processing, lowest fee)

WORKFLOW:
1. Verify plan has emergency withdrawals enabled (check plan details)
2. Verify withdrawal amount <= available locked funds
3. Call get_payout_accounts to get payoutAccountId
4. Calculate fee: withdrawalAmount * fee_percentage
5. User receives: withdrawalAmount - fee
6. Remaining locked funds stay in plan

IMPORTANT:
- Only available if plan was created with emergencyWithdrawalEnabled=true
- Fees are deducted from withdrawal amount
- User receives net amount (withdrawalAmount - fee)`,
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Payout plan ID (from get_user_plans). Plan must have emergencyWithdrawalEnabled=true.' },
          withdrawalAmount: { type: 'number', description: 'Amount to withdraw. Cannot exceed available locked funds in the plan. Fees are deducted from this amount.' },
          option: { type: 'string', enum: ['instant', '24hrs', '72hrs'], description: 'Withdrawal speed: "instant" (12% fee), "24hrs" (10% fee), "72hrs" (6% fee). Faster = higher fee.' },
          payoutAccountId: { type: 'string', description: 'Payout account ID from get_payout_accounts. This is where the withdrawal will be sent.' },
        },
        required: ['planId', 'withdrawalAmount', 'option', 'payoutAccountId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'rename_payout_plan',
      description: 'Rename a payout plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Payout plan ID' },
          name: { type: 'string', description: 'New name for the plan' },
        },
        required: ['planId', 'name']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'rename_budget_plan',
      description: 'Rename a budget plan.',
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Budget plan ID' },
          name: { type: 'string', description: 'New name for the plan' },
        },
        required: ['planId', 'name']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_funds_to_budget',
      description: `Add funds from the user's wallet to a budget plan. Budget plans do NOT lock funds automatically - users must add funds manually using this function.
      
WORKFLOW:
1. Call get_user_balance first to verify availableBalance >= amount
2. Verify planId exists (use get_user_plans if needed)
3. If insufficient balance: Inform user they need more funds
4. After adding funds: Confirm success and show updated budget balance

IMPORTANT:
- Funds are transferred from wallet to budget plan
- Available balance decreases, budget plan current_balance increases
- User can add funds multiple times to the same budget plan
- Always suggest this after creating a new budget plan`,
      parameters: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Budget plan ID (from get_user_plans or create_budget_plan result)' },
          amount: { type: 'number', description: 'Amount to add to the budget plan. Must be <= available balance.' },
        },
        required: ['planId', 'amount']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_payout_accounts',
      description: `Get all of the user's payout accounts (bank accounts for receiving payouts). 
      
CRITICAL: ALWAYS call this BEFORE creating a payout plan. Payout plans require a valid payoutAccountId.

WORKFLOW:
1. Call this function first when user wants to create a payout plan
2. If no accounts exist: Inform user they need to add a payout account first
3. If multiple accounts exist: Use the default account (isDefault=true) or ask user which one
4. Use the account ID (id field) as payoutAccountId in create_payout_plan

IF NO ACCOUNTS:
- Inform user: "You need to add a payout account first. This is the bank account where your payouts will be sent."
- Guide them to add an account through the app

RETURNS:
- Array of accounts with: id, bankName, accountNumber (last 4 digits), accountName, isDefault`,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_transactions',
      description: 'Get the user\'s transaction history including deposits, payouts, withdrawals, and budget top-ups.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum number of transactions to return (default: 50)' },
        },
        required: []
      }
    }
  },
];

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
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const { payoutAccounts, isLoading: payoutAccountsLoading, fetchPayoutAccounts } = usePayoutAccounts();
  const { createPayout, isLoading: isCreatingPayout, error: createPayoutError } = useCreatePayout();
  const { banks } = useBanks();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const isInitialMount = useRef(true);
  
  // Additional hooks for function calling
  const { expensePlans, fetchExpensePlans, createCompletePlan, updateExpensePlan, addFundsToPlan } = useExpensePlans();
  const { payoutPlans, fetchPayoutPlans, updatePlan: updatePayoutPlan } = useRealtimePayoutPlans();
  const { processEmergencyWithdrawal } = useEmergencyWithdrawal();
  const { transactions, fetchTransactions } = useRealtimeTransactions();

  // Build comprehensive system prompt with database schema and user context
  const buildSystemPrompt = (): string => {
    const userName = session?.user?.user_metadata?.first_name || 'User';
    
    // Build category reference
    const categoryList = CATEGORIES.map(cat => {
      const subcats = cat.subCategories.map(sub => sub.id).join(', ');
      return `- ${cat.id} (${cat.name}): ${subcats}`;
    }).join('\n');
    
    return `You are Planmoni AI, a helpful financial assistant for Nigerian users.

DATABASE SCHEMA:

budget_plans table:
- id (uuid): Primary key
- user_id (uuid): References profiles(id)
- name (text): Plan name
- total_budget (numeric): Total budget amount
- current_balance (numeric): Current available balance in plan
- total_spent (numeric): Total amount spent
- start_date (date): Budget start date
- end_date (date): Budget end date
- status (text): 'active', 'completed', or 'archived'
- funding_method (text): 'auto' or 'manual'
- categories (jsonb): Array of category IDs like ["air_travel", "car_maintenance"]
- subcategories (jsonb): Array of objects with category_id and subcategory_id
- auto_topup_enabled (boolean): Whether auto top-up is enabled
- auto_topup_frequency (text): 'daily', 'weekly', or 'monthly'
- auto_topup_amount (numeric): Amount per auto top-up

payout_plans table:
- id (uuid): Primary key
- user_id (uuid): References profiles(id)
- name (text): Plan name
- total_amount (numeric): Total amount to payout
- payout_amount (numeric): Amount per payout
- frequency (text): 'daily', 'weekly', 'biweekly', 'monthly', 'custom', etc.
- duration (integer): Number of payout cycles
- start_date (date): Start date
- status (text): 'active', 'paused', 'completed', 'cancelled'
- completed_payouts (integer): Number of completed payouts
- next_payout_date (date): Next scheduled payout date
- emergency_withdrawal_enabled (boolean): Whether emergency withdrawals are enabled
- payout_account_id (uuid): References payout_accounts(id)

wallets table:
- user_id (uuid): References profiles(id)
- balance (numeric): Total wallet balance
- locked_balance (numeric): Locked balance (in payout plans)
- available_balance (numeric): Available balance (balance - locked_balance)

payout_accounts table:
- id (uuid): Primary key
- user_id (uuid): References profiles(id)
- account_name (text): Account holder name
- account_number (text): Account number
- bank_name (text): Bank name
- is_default (boolean): Whether this is the default account

transactions table:
- id (uuid): Primary key
- user_id (uuid): References profiles(id)
- type (text): 'deposit', 'payout', 'withdrawal', 'expense_plan_topup', 'referral_bonus'
- amount (numeric): Transaction amount
- status (text): 'pending', 'completed', 'failed'
- source (text): Source of transaction
- destination (text): Destination of transaction

AVAILABLE FREQUENCY OPTIONS:
- daily: Daily payouts
- weekly: Weekly payouts (requires dayOfWeek 0-6, Sunday=0)
- biweekly: Every two weeks
- monthly: Monthly payouts
- custom: Custom dates (requires customDates array)
- weekly_specific: Weekly on specific day (requires dayOfWeek)
- end_of_month: End of month payouts
- quarterly: Every 3 months
- biannual: Every 6 months
- annually: Once per year

EMERGENCY WITHDRAWAL FEES:
- instant: 12% fee
- 24hrs: 10% fee
- 72hrs: 6% fee

COMPLETE CATEGORY REFERENCE:
${categoryList}

PAYOUT PLAN CREATION WORKFLOW:
1. PREREQUISITES CHECK:
   - User must have at least one payout account (call get_payout_accounts first)
   - If no payout accounts exist, inform user they need to add one first
   - Check available balance (call get_user_balance)
   - Available balance must be >= total amount (funds are locked immediately)

2. VALIDATION STEPS:
   - Minimum total amount: ₦5,000
   - Duration must be > 0
   - Start date must be today or future (YYYY-MM-DD format)
   - For 'weekly_specific' frequency: dayOfWeek is required (0-6, Sunday=0)
   - For 'custom' frequency: customDates array is required
   - payoutAccountId must be a valid account ID from get_payout_accounts

3. CALCULATIONS:
   - If payoutAmount not provided: calculate as totalAmount / duration
   - Duration interpretation:
     * daily: duration = number of days
     * weekly/biweekly: duration = number of weeks
     * monthly: duration = number of months
     * quarterly: duration = number of quarters
     * biannual: duration = number of 6-month periods
     * annually: duration = number of years

4. EXECUTION:
   - Funds are LOCKED from wallet immediately upon creation
   - Plan status starts as 'active'
   - Next payout date is calculated based on frequency and start date

BUDGET PLAN CREATION WORKFLOW:
1. PREREQUISITES CHECK:
   - Check available balance (call get_user_balance) - note: funds are NOT locked automatically
   - User can create budget plan even with ₦0 balance (they add funds later)

2. VALIDATION STEPS:
   - Minimum total budget: ₦1,000
   - Start date can be null (for ongoing plans)
   - End date can be null (for ongoing plans)
   - Categories/subcategories are optional but recommended

3. CATEGORY HANDLING:
   - If user mentions categories (e.g., "travel expenses", "car maintenance"), suggest relevant categories
   - Convert categories/subcategories to buckets format:
     * Each subcategory becomes a bucket with category_id, subcategory_id, name, and target_amount
     * If target_amount not specified, distribute total_budget evenly across buckets
   - Categories are stored in both categories array and buckets table

4. EXECUTION:
   - Funds are NOT locked automatically - user must add funds manually using add_funds_to_budget
   - Plan status starts as 'active'
   - After creation, suggest adding funds to the plan

VALIDATION RULES:

PAYOUT PLANS:
- Minimum total amount: ₦5,000
- Available balance must be >= total amount (enforced by database)
- Duration must be > 0
- Start date must be today or future date
- For 'weekly_specific': dayOfWeek required (0-6, Sunday=0, Monday=1, etc.)
- For 'custom': customDates array required with at least one date
- payoutAccountId must exist and belong to user

BUDGET PLANS:
- Minimum total budget: ₦1,000
- Start date can be null (ongoing plans)
- End date can be null (ongoing plans)
- If both start_date and end_date are null, plan is ongoing
- Categories/subcategories are optional
- Funding method defaults to 'manual' if not specified

BUSINESS LOGIC:

FUND LOCKING:
- Payout Plans: Funds are LOCKED immediately upon creation. The total_amount is deducted from available_balance and added to locked_balance. This ensures funds are reserved for scheduled payouts.
- Budget Plans: Funds are NOT locked automatically. Users add funds manually using add_funds_to_budget function. This allows flexible funding.

FREQUENCY CALCULATIONS:
- Daily: duration represents number of days (e.g., duration=30 means 30 daily payouts)
- Weekly: duration represents number of weeks (e.g., duration=4 means 4 weekly payouts)
- Biweekly: duration represents number of bi-weekly periods (e.g., duration=6 means 6 bi-weekly payouts = 12 weeks)
- Monthly: duration represents number of months (e.g., duration=6 means 6 monthly payouts)
- Weekly_specific: duration represents number of weeks, dayOfWeek determines which day (0=Sunday, 1=Monday, etc.)
- End_of_month: duration represents number of months
- Quarterly: duration represents number of quarters (3-month periods)
- Biannual: duration represents number of 6-month periods
- Annually: duration represents number of years

EMERGENCY WITHDRAWALS:
- Only available if emergencyWithdrawalEnabled is true
- Fees: 12% for instant, 10% for 24hrs, 6% for 72hrs
- User must specify payoutAccountId to receive withdrawal
- Withdrawal amount cannot exceed available locked funds in the plan

WALLET BALANCE EXPLANATION:
- totalBalance: Total funds in wallet (available + locked)
- lockedBalance: Funds locked in active payout plans (cannot be used for other purposes)
- availableBalance: Funds available for use (totalBalance - lockedBalance)
- When creating payout plan: availableBalance decreases, lockedBalance increases
- When payout executes: lockedBalance decreases, funds are transferred to payout account

EXAMPLE CONVERSATIONS:

Example 1 - Creating Payout Plan:
User: "I want to create a weekly payout plan for ₦50,000 over 3 months"
AI Steps:
1. Call get_user_balance to check available balance
2. Call get_payout_accounts to get user's accounts
3. If balance < ₦50,000: Inform user they need more funds
4. If no accounts: Ask user to add a payout account first
5. Calculate: 3 months = ~12 weeks, so payoutAmount = ₦50,000 / 12 = ₦4,167 per week
6. Ask: "Which day of the week? (Sunday=0, Monday=1, etc.)" or use default
7. Ask: "Enable emergency withdrawals? (yes/no)"
8. Call create_payout_plan with calculated values
9. Explain: "I've created your plan. ₦50,000 has been locked from your wallet and will be paid out weekly."

Example 2 - Creating Budget Plan:
User: "Create a budget for ₦100,000 for travel expenses"
AI Steps:
1. Call get_user_balance (informational, not required)
2. Suggest categories: air_travel with subcategories like flight_tickets, visa_fees, hotel_bookings
3. Ask: "When does this budget start? (optional, can be ongoing)"
4. Call create_budget_plan with categories
5. Explain: "I've created your travel budget. You can add funds to it now using 'add funds to budget' or later."

Example 2b - Creating Budget with Relative Dates:
User: "I am planning a travel for the next 1 week"
AI Steps:
1. Calculate dates: startDate = today, endDate = today + 7 days
2. Confirm: "I'll create a travel budget starting today and ending on [calculated end date]. Is that correct?"
3. If confirmed, call create_budget_plan with calculated dates and categories=["air_travel"]
4. Suggest subcategories: flight_tickets, hotel_bookings, etc.

Example 2c - Creating Budget with Complex Relative Dates:
User: "upcoming expense in the next 3 days and would last till month end"
AI Steps:
1. Calculate: startDate = today + 3 days, endDate = last day of current month
2. Confirm: "I'll create a budget starting on [calculated start date] and ending on [calculated end date]. Is that correct?"
3. Ask: "What category is this expense for?" (if not mentioned)
4. If confirmed, call create_budget_plan with calculated dates

Example 2d - Creating Budget with Duration Period:
User: "Create a travel budget, I am traveling tomorrow and I want to spend a total of 1 million naira for the travel period, this will be used for Food, shopping, groceries, transportation and data, My period of stay is 5 days"
AI Steps:
1. Calculate: startDate = tomorrow, endDate = tomorrow + 4 days (5 days total: day 1=tomorrow, days 2-5)
2. Categories: food, shopping, transportation (infer appropriate subcategories)
3. Confirm: "I'll create a travel budget starting [tomorrow date] and ending [tomorrow + 4 days date] for 5 days. Total budget: ₦1,000,000. Is that correct?"
4. If confirmed, call create_budget_plan with: startDate=tomorrow, endDate=tomorrow+4, totalBudget=1000000, categories and subcategories

Example 3 - Insufficient Balance:
User: "Create a payout plan for ₦200,000"
AI Response: "I'd love to help! However, your available balance is ₦${availableBalance.toLocaleString()}, which is less than ₦200,000. You need to add ₦${(200000 - availableBalance).toLocaleString()} more to your wallet first. Would you like me to help you add funds?"

Example 4 - Missing Payout Account:
User: "Create a weekly payout for ₦20,000"
AI Steps:
1. Call get_payout_accounts
2. If empty: "You need to add a payout account first. This is the bank account where your payouts will be sent. Would you like me to guide you through adding one?"

NATURAL LANGUAGE PATTERNS:

Common user phrases and how to interpret:
- "Plan ₦X for Y months/weeks" → Create payout plan
- "Budget for X" or "Budget plan for X" → Create budget plan
- "Schedule payouts of ₦X weekly/monthly" → Create payout plan with frequency
- "Save ₦X for Y" → Could be either, ask clarifying question
- "Set aside ₦X for [category]" → Budget plan with category
- "Pay out ₦X every [day/week/month]" → Payout plan

When information is ambiguous:
- Ask clarifying questions: "Do you want a payout plan (money sent to your bank) or a budget plan (money set aside for expenses)?"
- If frequency unclear: "How often do you want the payouts? (daily, weekly, monthly, etc.)"
- If amount unclear: "What's the total amount you want to plan for?"
- If dates unclear or relative: "When should this start? (e.g., next week, January 1st, in 3 days)"
- If duration unclear: "How long should this last? (e.g., 1 week, 1 month, until month end)"
- ALWAYS confirm relative dates: "Just to confirm, by 'next week' do you mean [calculated date]?"

ERROR HANDLING:

Insufficient Balance:
- Check balance BEFORE attempting to create payout plan
- Explain clearly: "You have ₦X available, but need ₦Y. You need to add ₦Z more."
- Suggest: "Would you like to add funds to your wallet first?"

Missing Payout Account:
- Always check for payout accounts before creating payout plan
- If none exist: "You need to add a payout account first. This is where your money will be sent."

Invalid Dates:
- Start date must be today or future
- If user provides past date: "Start date must be today or a future date. Would you like to start today?"
- If relative date is unclear: "I want to make sure I understand correctly. When you say '[user phrase]', do you mean [calculated date]? Or did you have a different date in mind?"
- If user says something vague like "soon" or "later": "Could you be more specific? For example, 'next week', 'in 3 days', or 'January 1st'?"

Missing Required Fields:
- For weekly_specific: "Which day of the week? (Sunday, Monday, Tuesday, etc.)"
- For custom: "Please provide the specific dates for your custom payout schedule."

CONFIRMATION PATTERNS:

Always confirm before executing:
- "I'll create a payout plan that will lock ₦X from your wallet and pay out ₦Y every [frequency]. Proceed?"
- "This will create a budget plan for ₦X. You'll need to add funds to it separately. Continue?"

For high-value transactions (>₦100,000):
- Always ask for explicit confirmation
- Explain the impact: "This will lock ₦X from your available balance."

STEP-BY-STEP GUIDANCE:

Before creating ANY plan:
1. Always call get_user_balance first to understand user's financial situation
2. For payout plans: Always call get_payout_accounts first
3. Validate all inputs match the rules above
4. Calculate missing values (e.g., payoutAmount from totalAmount/duration)
5. Ask clarifying questions if information is missing or ambiguous
6. Explain what will happen (fund locking, etc.)
7. Confirm with user before executing
8. After creation, explain what happened and next steps

CATEGORY SUGGESTIONS:

When user mentions expense types, suggest relevant categories:
- Travel/vacation → air_travel (flight_tickets, hotel_bookings, visa_fees)
- Car expenses → car_maintenance (servicing, car_repair, insurance)
- Food → food (restaurants, cooking, takeout)
- Bills → utilities_bills (electricity, water, waste_disposal)
- Shopping → shopping (general_shopping, online_shopping)
- Health → healthcare (routine_checkups, medication_pharmacy)
- Education → education (tuition, textbooks, uniforms)
- Entertainment → entertainment_social (cinema, concerts_events, streaming)

USER CONTEXT:
- User Name: ${userName}
- TODAY'S DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format) - USE THIS as the reference point for all relative date calculations
- Available Balance: ₦${availableBalance.toLocaleString()}
- Total Balance: ₦${balance.toLocaleString()}
- Locked Balance: ₦${(lockedBalance || 0).toLocaleString()}
- Payout Plans: ${payoutPlans.length} active plan(s)
- Budget Plans: ${expensePlans.length} active plan(s)
- Payout Accounts: ${payoutAccounts.length} account(s)

CRITICAL DATE CALCULATION:
- "tomorrow" = TODAY'S DATE + 1 day
- "next week" = TODAY'S DATE + 7 days
- "in 3 days" = TODAY'S DATE + 3 days
- Always use TODAY'S DATE shown above as the starting point for all relative date calculations

CORE INSTRUCTIONS:
- Answer questions about finances, plans, and the app in a conversational, friendly manner
- Use functions to perform actions (create plans, withdrawals, etc.)
- Always check prerequisites (balance, accounts) before creating plans
- Ask clarifying questions when information is ambiguous or missing
- Explain what actions will be taken before executing (especially fund locking)
- Provide helpful suggestions when prerequisites aren't met
- For payout plans: Ensure user has payout account first (use get_payout_accounts)
- For budget plans: Suggest relevant categories based on user's needs
- After creating budget plan: Suggest adding funds using add_funds_to_budget
- Handle errors gracefully with helpful, actionable messages
- Use Nigerian Naira (₦) for all amounts
- Be positive, supportive, and empowering`;
  };

  // Execute function calls from OpenAI
  const executeFunctionCall = async (functionName: string, args: any): Promise<any> => {
    try {
      switch (functionName) {
        case 'create_payout_plan':
          await createPayout({
            name: args.name,
            totalAmount: args.totalAmount,
            payoutAmount: args.payoutAmount,
            frequency: args.frequency,
            duration: args.duration,
            startDate: args.startDate,
            payoutAccountId: args.payoutAccountId,
            emergencyWithdrawalEnabled: args.emergencyWithdrawalEnabled || false,
            dayOfWeek: args.dayOfWeek,
            payoutHour: args.payoutHour || 9,
            payoutMinute: args.payoutMinute || 0,
            customDates: args.customDates,
          });
          await fetchPayoutPlans();
          // Query database to get the newly created plan
          const { data: newPayoutPlan } = await supabase
            .from('payout_plans')
            .select('id')
            .eq('name', args.name)
            .eq('user_id', session?.user?.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          return { success: true, planId: newPayoutPlan?.id, planType: 'payout', message: 'Payout plan created successfully' };
        
        case 'create_budget_plan':
          // Validate and parse dates
          let parsedStartDate: string | null = null;
          let parsedEndDate: string | null = null;
          
          if (args.startDate) {
            try {
              // Validate date format (YYYY-MM-DD)
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!dateRegex.test(args.startDate)) {
                throw new Error(`Invalid start date format: ${args.startDate}. Expected YYYY-MM-DD`);
              }
              const startDateObj = new Date(args.startDate + 'T00:00:00');
              if (isNaN(startDateObj.getTime())) {
                throw new Error(`Invalid start date: ${args.startDate}`);
              }
              // Always save valid dates - they will be visible but budget won't be "started" until funded
              parsedStartDate = args.startDate;
            } catch (error: any) {
              console.error('Error parsing start date:', error);
              // If date is invalid, set to null
              parsedStartDate = null;
            }
          }
          
          if (args.endDate) {
            try {
              // Validate date format (YYYY-MM-DD)
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!dateRegex.test(args.endDate)) {
                throw new Error(`Invalid end date format: ${args.endDate}. Expected YYYY-MM-DD`);
              }
              const endDateObj = new Date(args.endDate + 'T00:00:00');
              if (isNaN(endDateObj.getTime())) {
                throw new Error(`Invalid end date: ${args.endDate}`);
              }
              parsedEndDate = args.endDate;
            } catch (error: any) {
              console.error('Error parsing end date:', error);
              // If date is invalid, set to null
              parsedEndDate = null;
            }
          }
          
          // Extract unique categories from subcategories or use provided categories array
          const uniqueCategories = args.categories && args.categories.length > 0 
            ? [...new Set(args.categories)]
            : args.subcategories 
              ? [...new Set(args.subcategories.map((sub: any) => sub.category_id).filter(Boolean))]
              : [];
          
          // Convert categories/subcategories to buckets format if provided
          const buckets = args.subcategories?.map((sub: any) => ({
            category_id: sub.category_id,
            subcategory_id: sub.subcategory_id,
            name: sub.name || `${sub.category_id}_${sub.subcategory_id}`,
            target_amount: args.totalBudget / (args.subcategories?.length || 1), // Distribute budget evenly
          })) || [];
          
          // Prepare subcategories array for direct storage
          const subcategoriesArray = args.subcategories?.map((sub: any) => ({
            category_id: sub.category_id,
            subcategory_id: sub.subcategory_id,
          })) || [];
          
          const budgetResult = await createCompletePlan({
            plan_name: args.name,
            name: args.name,
            total_budget: args.totalBudget,
            start_date: parsedStartDate,
            end_date: parsedEndDate,
            funding_method: args.fundingMethod || 'manual',
            metadata: {
              auto_topup_enabled: args.autoTopupEnabled || false,
              auto_topup_frequency: args.autoTopupFrequency,
              auto_topup_amount: args.autoTopupAmount,
              // Store categories and subcategories in metadata as backup
              categories: uniqueCategories,
              subcategories: subcategoriesArray,
            },
            buckets: buckets,
          });
          await fetchExpensePlans();
          
          // Check if budget is unfunded
          const isUnfunded = (budgetResult?.current_balance || 0) === 0;
          
          return { 
            success: true, 
            planId: budgetResult?.id, 
            planType: 'budget', 
            isUnfunded,
            message: 'Budget plan created successfully' 
          };
        
        case 'get_user_plans':
          await Promise.all([fetchPayoutPlans(), fetchExpensePlans()]);
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
            budgetPlans: expensePlans.map(p => ({
              id: p.id,
              name: p.name,
              status: p.status,
              totalBudget: p.total_budget,
              currentBalance: p.current_balance,
              totalSpent: p.total_spent,
            })),
          };
        
        case 'get_user_balance':
          return {
            availableBalance,
            totalBalance: balance,
            lockedBalance: lockedBalance || 0,
          };
        
        case 'process_emergency_withdrawal':
          const withdrawalResult = await processEmergencyWithdrawal({
            planId: args.planId,
            withdrawalAmount: args.withdrawalAmount,
            option: args.option,
            payoutAccountId: args.payoutAccountId,
            planName: payoutPlans.find(p => p.id === args.planId)?.name || 'Plan',
          });
          await fetchPayoutPlans();
          return { success: true, message: 'Emergency withdrawal processed successfully', result: withdrawalResult };
        
        case 'rename_payout_plan':
          await updatePayoutPlan(args.planId, { name: args.name });
          await fetchPayoutPlans();
          return { success: true, message: 'Payout plan renamed successfully' };
        
        case 'rename_budget_plan':
          await updateExpensePlan(args.planId, { name: args.name });
          await fetchExpensePlans();
          return { success: true, message: 'Budget plan renamed successfully' };
        
        case 'add_funds_to_budget':
          const fundResult = await addFundsToPlan(args.planId, args.amount);
          await fetchExpensePlans();
          return { success: true, message: 'Funds added to budget plan successfully', result: fundResult };
        
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
        
        case 'get_transactions':
          await fetchTransactions(args.limit || 50);
          return {
            transactions: transactions.slice(0, args.limit || 50).map(t => ({
              id: t.id,
              type: t.type,
              amount: t.amount,
              status: t.status,
              createdAt: t.created_at,
            })),
          };
        
        default:
          return { success: false, error: `Unknown function: ${functionName}` };
      }
    } catch (error: any) {
      console.error(`Error executing function ${functionName}:`, error);
      return { success: false, error: error.message || 'Function execution failed' };
    }
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

  // Removed plan creation step effect - no longer needed

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
      content: `Hi ${session?.user?.user_metadata?.first_name || 'there'}! I'm your financial assistant. I can help you **create payout plans**, **set up budgets**, **manage your plans**, and **get financial insights**.
How can I help you today? 😊`,
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

  // Preprocess user message to extract structured data and convert relative dates
  const preprocessUserMessage = async (userMessage: string): Promise<string | null> => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Helper to calculate dates
    const addDays = (date: Date, days: number): string => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };
    
    const getLastDayOfMonth = (date: Date): string => {
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return lastDay.toISOString().split('T')[0];
    };
    
    const getFirstDayOfNextMonth = (date: Date): string => {
      const firstDay = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return firstDay.toISOString().split('T')[0];
    };

    try {
      // Use AI to parse and format the message
      const parsePrompt = `You are a message preprocessor. Parse the user's message and convert relative dates to absolute dates in YYYY-MM-DD format.

TODAY'S DATE: ${todayStr} (YYYY-MM-DD)

INSTRUCTIONS:
1. Extract all relative date references and convert them to absolute dates
2. Convert "tomorrow" to ${addDays(today, 1)}
3. Convert "next week" to ${addDays(today, 7)}
4. Convert "in X days" to ${todayStr} + X days
5. For duration periods: if user says "for 5 days" starting "tomorrow", calculate endDate = tomorrow + 4 days (5 days total including start)
6. Convert "end of month" or "month end" to ${getLastDayOfMonth(today)}
7. Convert "next month" to ${getFirstDayOfNextMonth(today)}
8. Keep all other information intact
9. If dates are unclear, keep the original message but add a note about what needs clarification

USER MESSAGE: "${userMessage}"

Return the preprocessed message with all relative dates converted to absolute dates in YYYY-MM-DD format. If the message doesn't need preprocessing, return the original message. Return ONLY the preprocessed message, no explanations.`;

      const preprocessResponse = await getOpenAIChatCompletion({
        messages: [
          { role: 'system', content: 'You are a helpful message preprocessor that converts relative dates to absolute dates.' },
          { role: 'user', content: parsePrompt }
        ],
        model: 'gpt-4-turbo-preview',
        temperature: 0.3, // Lower temperature for more accurate date parsing
        max_tokens: 500,
      });

      if (preprocessResponse.content) {
        // Check if the preprocessed message is significantly different (contains dates)
        const hasDatePattern = /\d{4}-\d{2}-\d{2}/.test(preprocessResponse.content);
        if (hasDatePattern || preprocessResponse.content.length > userMessage.length * 0.8) {
          return preprocessResponse.content.trim();
        }
      }
      
      return null; // Return null to use original message
    } catch (error) {
      console.error('Error preprocessing message:', error);
      return null; // Fallback to original message
    }
  };

  // Update handleSendMessage to intercept input for plan creation steps
  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride || inputText.trim();
    if (!messageToSend) return;

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
      content: messageToSend,
      sender: 'user',
      type: 'text',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageOverride) {
      setInputText('');
    }
    setShowSuggestions(false);
    setIsTyping(true);
    setError(null);
    setLastUserMessage(messageToSend);

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

    try {
      // Preprocess user message with AI to extract and format structured data
      const preprocessedMessage = await preprocessUserMessage(messageToSend);
      
      // Build conversation history for OpenAI
      const conversationHistory: OpenAIMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
      ];

      // Add previous messages (last 10 for context)
      const recentMessages = messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.sender === 'user') {
          conversationHistory.push({ role: 'user', content: msg.content });
        } else {
          conversationHistory.push({ role: 'assistant', content: msg.content });
        }
      }

      // Add current user message (use preprocessed version if available, otherwise original)
      conversationHistory.push({ role: 'user', content: preprocessedMessage || messageToSend });

      // Call OpenAI with function definitions
      const response = await getOpenAIChatCompletion({
        messages: conversationHistory,
        model: 'gpt-4-turbo-preview', // Use correct model identifier
        temperature: 0.7,
        max_tokens: 2000,
        tools: getFunctionDefinitions(),
      });

      // Handle function calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Execute all function calls
        const functionResults: OpenAIMessage[] = [];
        let createdPlanId: string | undefined;
        let createdPlanType: 'payout' | 'budget' | undefined;
        let isUnfunded: boolean | undefined;
        
        for (const toolCall of response.tool_calls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          const result = await executeFunctionCall(functionName, args);
          
          // Capture plan creation info
          if ((functionName === 'create_payout_plan' || functionName === 'create_budget_plan') && result.planId) {
            createdPlanId = result.planId;
            createdPlanType = result.planType;
            isUnfunded = result.isUnfunded;
          }
          
          functionResults.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: functionName,
          });
        }

        // Send function results back to OpenAI for final response
        const finalMessages: OpenAIMessage[] = [
          ...conversationHistory,
          { role: 'assistant', content: null, tool_calls: response.tool_calls },
          ...functionResults,
        ];

        const finalResponse = await getOpenAIChatCompletion({
          messages: finalMessages,
          model: 'gpt-4-turbo-preview', // Use correct model identifier
          temperature: 0.7,
          max_tokens: 2000,
          tools: getFunctionDefinitions(),
        });

        // Display final response
        if (finalResponse.content) {
          const aiMessage: Message = {
            id: `ai-${Date.now()}`,
            content: finalResponse.content,
            sender: 'ai',
            type: 'text',
            timestamp: new Date(),
            metadata: createdPlanId ? { 
              planId: createdPlanId, 
              planType: createdPlanType,
              isUnfunded: isUnfunded 
            } : undefined,
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      } else if (response.content) {
        // No function calls, just display the response
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          content: response.content,
          sender: 'ai',
          type: 'text',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err: any) {
      console.error('AI Response Error:', err);
      setError(err.message || 'Failed to get AI response');
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: err.message?.includes('Network') || err.message?.includes('connection')
          ? "I'm having trouble connecting to the internet right now. Please check your connection and try again."
          : err.message?.includes('timeout')
          ? "The request is taking longer than expected. Please try asking your question again."
          : "I'm temporarily unable to process your request. Please try again in a moment.",
        sender: 'ai',
        type: 'text',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
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
    setInputText(lastUserMessage);
    // Trigger handleSendMessage by simulating user input
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

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

  const getUserName = () => session?.user?.user_metadata?.first_name || 'User';

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

  // Function to format markdown-like text (bold with ** and bullet points with -)
  const formatMarkdownText = (text: string, textColor: string, textSizeMultiplier: number) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, lineIndex) => {
      // Check if line is a bullet point (starts with - or - )
      const bulletMatch = line.match(/^[-•]\s+(.+)$/);
      
      if (bulletMatch) {
        // This is a bullet point
        const bulletContent = bulletMatch[1];
        const bulletElements = parseBoldText(bulletContent, textColor, textSizeMultiplier);
        
        elements.push(
          <View key={`bullet-${lineIndex}`} style={{ flexDirection: 'row', marginBottom: getScaledFontSize(4, textSizeMultiplier), paddingLeft: getScaledFontSize(8, textSizeMultiplier), alignItems: 'flex-start' }}>
            <Text style={{ fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier), color: textColor, marginRight: getScaledFontSize(8, textSizeMultiplier), marginTop: getScaledFontSize(2, textSizeMultiplier) }}>•</Text>
            <Text style={{ flex: 1, fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier), lineHeight: getScaledFontSize(24, textSizeMultiplier), color: textColor }}>
              {bulletElements}
            </Text>
          </View>
        );
      } else if (line.trim()) {
        // Regular line with potential bold text
        const lineElements = parseBoldText(line, textColor, textSizeMultiplier);
        elements.push(
          <Text key={`line-${lineIndex}`} style={{ fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier), lineHeight: getScaledFontSize(24, textSizeMultiplier), color: textColor }}>
            {lineElements}
          </Text>
        );
      } else {
        // Empty line for spacing
        elements.push(<View key={`empty-${lineIndex}`} style={{ height: getScaledFontSize(8, textSizeMultiplier) }} />);
      }
    });
    
    return <>{elements}</>;
  };

  // Helper function to parse bold text (**text**)
  const parseBoldText = (text: string, textColor: string, textSizeMultiplier: number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the bold
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add bold text
      parts.push(
        <Text key={`bold-${key++}`} style={{ fontWeight: 'bold' }}>
          {match[1]}
        </Text>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
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
              <View>
                {formatMarkdownText(message.content, colors.text, textSizeMultiplier)}
              </View>
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
            <View>
              {isUser ? (
                <Text style={[styles.messageText, styles.userText]}>
                  {message.content}
                </Text>
              ) : (
                formatMarkdownText(message.content, colors.text, textSizeMultiplier)
              )}
            </View>
            {!isUser && message.metadata?.planId && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {message.metadata.isUnfunded && message.metadata.planType === 'budget' && (
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onPress={() => {
                      router.push(`/expense-planner/${message.metadata.planId}`);
                    }}
                  >
                    <Wallet size={getScaledFontSize(16, textSizeMultiplier)} color="#FFFFFF" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: getScaledFontSize(16, textSizeMultiplier) }}>
                      Fund Budget
                    </Text>
                    <ArrowRight size={getScaledFontSize(16, textSizeMultiplier)} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ backgroundColor: message.metadata.isUnfunded && message.metadata.planType === 'budget' ? 'transparent' : colors.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: message.metadata.isUnfunded && message.metadata.planType === 'budget' ? 1 : 0, borderColor: message.metadata.isUnfunded && message.metadata.planType === 'budget' ? colors.primary : 'transparent' }}
                  onPress={() => {
                    if (message.metadata.planType === 'payout') {
                      router.push({
                        pathname: '/view-payout',
                        params: { id: message.metadata.planId }
                      });
                    } else if (message.metadata.planType === 'budget') {
                      router.push(`/expense-planner/${message.metadata.planId}`);
                    }
                  }}
                >
                  <Text style={{ color: message.metadata.isUnfunded && message.metadata.planType === 'budget' ? colors.primary : '#fff', fontWeight: '600', fontSize: getScaledFontSize(16, textSizeMultiplier) }}>
                    {message.metadata.planType === 'payout' ? 'View Payout Plan' : 'View Budget'}
                  </Text>
                  <ArrowRight size={getScaledFontSize(16, textSizeMultiplier)} color={message.metadata.isUnfunded && message.metadata.planType === 'budget' ? colors.primary : '#FFFFFF'} />
                </TouchableOpacity>
              </View>
            )}
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
            <View>
              {formatMarkdownText(message.content, colors.text, textSizeMultiplier)}
            </View>
            
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
                      const planDescription = `Create a ${plan.frequency} payout plan for ₦${plan.amount?.toLocaleString()}${plan.duration ? ` for ${plan.duration} ${plan.duration === 1 ? 'period' : 'periods'}` : ''}`;
                      handleSendMessage(planDescription);
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
            <View>
              {formatMarkdownText(message.content, colors.text, textSizeMultiplier)}
            </View>
            
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
            paddingBottom: keyboardVisible ? 200 : 16,
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

        {isAuthenticated && (
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