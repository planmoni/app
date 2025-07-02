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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { Send, Sparkles, ArrowRight, Wallet, TrendingUp, Calendar, Clock, X, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { router } from 'expo-router';
import { getOpenAIChatCompletion } from '../../lib/openai';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

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
  "How can I improve my money habits?",
  "Analyze my money patterns",
];

export default function AIAssistantScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { balance, lockedBalance } = useBalance();
  const availableBalance = balance - (lockedBalance || 0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const windowHeight = Dimensions.get('window').height;
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastType, setLastType] = useState<'plan' | 'insight' | 'text' | null>(null);

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

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

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

    setTimeout(() => {
      generateAIResponse(userMessage.content, { availableBalance, balance, lockedBalance });
    }, 500);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
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
    if (
      lowerCaseMessage.includes('save') || 
      lowerCaseMessage.includes('plan') || 
      lowerCaseMessage.includes('budget') ||
      lowerCaseMessage.includes('pay myself') ||
      lowerCaseMessage.includes('earn') && (lowerCaseMessage.includes('monthly') || lowerCaseMessage.includes('weekly'))
    ) {
      setLastType('plan');
      await generatePlanResponse(userMessage, balances);
    } 
    else if (
      lowerCaseMessage.includes('analyze') || 
      lowerCaseMessage.includes('pattern') || 
      lowerCaseMessage.includes('spending') ||
      lowerCaseMessage.includes('habits') ||
      lowerCaseMessage.includes('improve')
    ) {
      setLastType('insight');
      await generateInsightResponse(userMessage, balances);
    } 
    else {
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
    } catch (err) {
      setError('Sorry, I couldn\'t process your request right now. Please try again.');
      response = "Sorry, I couldn't process your request right now. Please try again.";
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

  const generatePlanResponse = async (userMessage: string, balances: { availableBalance: number, balance: number, lockedBalance: number }) => {
    const { availableBalance, balance, lockedBalance } = balances;
    let aiMessage: Message | null = null;
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
      const jsonStart = openaiResponse.indexOf('{');
      const jsonEnd = openaiResponse.lastIndexOf('}');
      let parsed: any = null;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          parsed = JSON.parse(openaiResponse.substring(jsonStart, jsonEnd + 1));
        } catch (e) {}
      }
      if (parsed && parsed.type === 'plan' && parsed.metadata && Array.isArray(parsed.metadata.plans)) {
        aiMessage = {
          id: Date.now().toString(),
          content: parsed.content || 'Here is a personalized payout schedule for you:',
          sender: 'ai',
          type: 'plan',
          timestamp: new Date(),
          metadata: parsed.metadata
        };
      } else {
        throw new Error('Invalid AI response');
      }
    } catch (err) {
      setError('Sorry, I couldn\'t process your plan request right now. Please try again.');
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
    const dailyAmount = Math.ceil(targetAmount / (timeframe * 30));
    const endOfMonthAmount = Math.ceil(targetAmount / timeframe);
    const firstOfMonthAmount = Math.ceil(targetAmount / timeframe);
    const freq = userMessage ? extractFrequency(userMessage) : null;
    if (freq === 'daily') {
      return [
        {
          title: "Daily Payout",
          amount: dailyAmount,
          frequency: "daily",
          description: `Schedule a payout of ₦${dailyAmount.toLocaleString()} every day for ${timeframe * 30} days.`
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
    // Default: show all 5 options
    return [
      {
        title: "Daily Payout",
        amount: dailyAmount,
        frequency: "daily",
        description: `Schedule a payout of ₦${dailyAmount.toLocaleString()} every day for ${timeframe * 30} days.`
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
        throw new Error('Invalid AI response');
      }
    } catch (err) {
      setError('Sorry, I couldn\'t process your insights request right now. Please try again.');
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
    const amountRegex = /₦?(\d{1,3}(,\d{3})*|\d+)(k|K|m|M)?/;
    const match = message.match(amountRegex);
    
    if (!match) return null;
    
    let amount = parseFloat(match[1].replace(/,/g, ''));
    
    // Handle k/K (thousands) and m/M (millions)
    if (match[3]) {
      if (match[3].toLowerCase() === 'k') {
        amount *= 1000;
      } else if (match[3].toLowerCase() === 'm') {
        amount *= 1000000;
      }
    }
    
    return amount;
  };

  const extractTimeframe = (message: string): number | null => {
    // Look for time periods like "6 months", "1 year", "by September", etc.
    const monthRegex = /(\d+)\s*(month|months)/i;
    const yearRegex = /(\d+)\s*(year|years)/i;
    
    const monthMatch = message.match(monthRegex);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }
    
    const yearMatch = message.match(yearRegex);
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 12;
    }
    
    // Check for month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < months.length; i++) {
      if (message.toLowerCase().includes(months[i])) {
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

  const handleCreatePlan = (plan: any) => {
    router.push({
      pathname: '/create-payout/amount',
      params: {
        amount: plan.metadata.targetAmount.toString(),
        frequency: plan.frequency,
        duration: (plan.metadata.timeframe * 4).toString() // Convert months to weeks
      }
    });
  };

  const getUserName = () => session?.user?.user_metadata?.first_name || 'User';

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.sender === 'user';
    
    // Render different message types
    switch (message.type) {
      case 'text':
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
                <Sparkles size={14} color={colors.primary} />
                <Text style={styles.aiBadgeText}>PlanmoniAI</Text>
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
                    {plan.frequency === 'weekly' && <Calendar size={20} color={colors.primary} />}
                    {plan.frequency === 'biweekly' && <Calendar size={20} color={colors.primary} />}
                    {plan.frequency === 'monthly' && <Calendar size={20} color={colors.primary} />}
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
              <Text style={styles.aiBadgeText}>PlanmoniAI</Text>
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
              <Text style={styles.aiBadgeText}>PlanmoniAI</Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 25,
      fontWeight: '700',
      color: 'black',
      textAlign: 'left',
    },
    headerTitleGradientWrapper: {
      alignSelf: 'flex-start',
    },
    headerTitleGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    headerSubtitle: {
      fontSize: 16,
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
      padding: 16,
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
      padding: 16,
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
      fontSize: 16,
      lineHeight: 22,
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
      padding: 12,
      paddingHorizontal: 16,
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 4,
    },
    typingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginRight: 8,
      maxHeight: 120,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.border,
    },
    suggestionsContainer: {
      padding: 16,
      backgroundColor: colors.surface,
    },
    suggestionsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    suggestionsScroll: {
      flexDirection: 'row',
    },
    suggestionBubble: {
      backgroundColor: isDark ? colors.backgroundTertiary : colors.backgroundSecondary,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionText: {
      fontSize: 16,
      color: colors.text,
    },
    planOptions: {
      marginTop: 16,
      gap: 12,
    },
    planOption: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
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
    },
    planTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    planAmount: {
      fontSize: 18,
      fontWeight: '700',
    },
    planDescription: {
      fontSize: 16,
      marginBottom: 16,
    },
    planButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 8,
    },
    planButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    insightsContainer: {
      marginTop: 16,
      gap: 12,
    },
    insightCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
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
      fontSize: 16,
      fontWeight: '600',
    },
    insightValue: {
      fontSize: 16,
      fontWeight: '700',
    },
    insightDescription: {
      fontSize: 16,
    },
    recommendationsContainer: {
      marginTop: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recommendationsTitle: {
      fontSize: 16,
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
      fontSize: 16,
      lineHeight: 20,
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
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 16,
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
      fontSize: 12,
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
      fontSize: 16,
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
      fontSize: 13,
    },
  });

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
          <Text style={styles.headerSubtitle}>Let's plan some payouts</Text>
        </View>
        <View style={styles.aiIconContainer}>
          <Sparkles size={20} color="#FFFFFF" />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
          {error && (
            <View style={styles.errorBubble}>
              <AlertTriangle size={18} color={colors.error || '#E57373'} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={retryLastRequest} style={styles.retryButton}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {showSuggestions && messages.length === 1 && !keyboardVisible && (
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

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask me anything about your finances..."
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onFocus={() => setShowSuggestions(false)}
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}