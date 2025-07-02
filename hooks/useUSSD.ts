import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack API configuration
const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!;
const PAYSTACK_API_URL = 'https://api.paystack.co';

// Supported USSD types according to Paystack documentation
const USSD_TYPES = {
  '058': '737', // Guaranty Trust Bank
  '033': '919', // United Bank of Africa
  '232': '822', // Sterling Bank
  '057': '966', // Zenith Bank
};

interface USSDResponse {
  status: string;
  message: string;
  data: {
    reference: string;
    ussd_code: string;
    bank_name: string;
    amount: string;
    phone: string;
    expires_at: string | null;
  };
}

interface VerificationResponse {
  status: string;
  message: string;
  data: {
    id: number;
    status: string;
    amount: number;
    reference: string;
    paid_at: string;
  };
}

interface BankAvailability {
  bankCode: string;
  bankName: string;
  ussdType: string;
  isAvailable: boolean;
  error?: string;
}

// Generate unique reference
function generateReference() {
  return `ussd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get bank name
function getBankName(bankCode: string): string {
  const bankNames: { [key: string]: string } = {
    '058': 'Guaranty Trust Bank',
    '033': 'United Bank of Africa',
    '232': 'Sterling Bank',
    '057': 'Zenith Bank'
  };
  return bankNames[bankCode] || 'Unknown Bank';
}

export const useUSSD = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [bankAvailability, setBankAvailability] = useState<BankAvailability[]>([]);
  const { session } = useAuth();
  const { showToast } = useToast();

  const checkUSSDAvailability = async (): Promise<BankAvailability[]> => {
    if (!session?.user) {
      showToast('Please log in to continue', 'error');
      return [];
    }

    setIsCheckingAvailability(true);

    try {
      // Check if Paystack secret key is available
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Payment service not properly configured');
      }

      const availabilityResults: BankAvailability[] = [];

      // Test each bank's availability
      for (const [bankCode, ussdType] of Object.entries(USSD_TYPES)) {
        const bankName = getBankName(bankCode);
        
        try {
          const testData = {
            email: session.user.email,
            amount: '100000', // 1000 Naira in kobo
            ussd: {
              type: ussdType
            },
            metadata: {
              user_id: session.user.id,
              payment_type: 'ussd',
              bank_code: bankCode,
              reference: `availability_test_${Date.now()}_${ussdType}`
            }
          };

          const response = await fetch(`${PAYSTACK_API_URL}/charge`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
          });

          const data = await response.json();
          
          if (response.ok && data.status === true) {
            availabilityResults.push({
              bankCode,
              bankName,
              ussdType,
              isAvailable: true
            });
          } else if (data.code === 'unprocessed_transaction' && data.data?.status === 'failed') {
            availabilityResults.push({
              bankCode,
              bankName,
              ussdType,
              isAvailable: false,
              error: data.data.message
            });
          } else {
            availabilityResults.push({
              bankCode,
              bankName,
              ussdType,
              isAvailable: false,
              error: data.message || 'Service unavailable'
            });
          }
          
        } catch (error) {
          availabilityResults.push({
            bankCode,
            bankName,
            ussdType,
            isAvailable: false,
            error: 'Network error'
          });
        }
      }

      setBankAvailability(availabilityResults);
      return availabilityResults;

    } catch (error) {
      console.error('Error checking USSD availability:', error);
      showToast('Failed to check bank availability', 'error');
      return [];
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const initializeUSSD = async (amount: string, bankCode: string, phone: string = ''): Promise<USSDResponse | null> => {
    if (!session?.user) {
      showToast('Please log in to continue', 'error');
      return null;
    }

    setIsLoading(true);

    try {
      // Check if Paystack secret key is available
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Payment service not properly configured');
      }

      // Validate amount (minimum 100 Naira)
      const amountInKobo = parseInt(amount) * 100;
      if (amountInKobo < 10000) {
        throw new Error('Minimum amount is ₦100');
      }

      // Check if bank supports USSD
      const ussdType = USSD_TYPES[bankCode as keyof typeof USSD_TYPES];
      if (!ussdType) {
        throw new Error('This bank does not support USSD payments. Supported banks: GTBank, UBA, Sterling Bank, Zenith Bank');
      }

      // Generate unique reference
      const reference = generateReference();

      // Initialize Paystack USSD charge according to official documentation
      const chargeData = {
        email: session.user.email,
        amount: amountInKobo.toString(),
        ussd: {
          type: ussdType
        },
        metadata: {
          user_id: session.user.id,
          payment_type: 'ussd',
          bank_code: bankCode,
          phone: phone || '',
          reference: reference
        }
      };

      // Make request to Paystack Charge API
      const response = await fetch(`${PAYSTACK_API_URL}/charge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chargeData)
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific Paystack service availability errors
        if (data.code === 'unprocessed_transaction' && data.data?.status === 'failed') {
          const bankName = getBankName(bankCode);
          if (bankCode === '058') {
            throw new Error(`${bankName} USSD service is temporarily unavailable. Please try again later.`);
          } else {
            throw new Error(`${bankName} USSD service is temporarily unavailable. Please try GTBank instead.`);
          }
        }
        
        throw new Error(data.message || 'Failed to initialize USSD payment');
      }

      // Create transaction record in database
      const { error: dbError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          type: 'deposit',
          amount: parseInt(amount),
          status: 'pending',
          source: 'USSD Payment',
          destination: 'Wallet',
          reference: data.data.reference,
          metadata: {
            paystack_transaction_id: data.data.id,
            paystack_reference: data.data.reference,
            bank_code: bankCode,
            ussd_type: ussdType,
            phone: phone || '',
            payment_method: 'ussd'
          }
        });

      if (dbError) {
        console.error('Error creating transaction record:', dbError);
      }

      // Return USSD payment details
      return {
        status: 'success',
        message: 'USSD payment initialized successfully',
        data: {
          reference: data.data.reference,
          ussd_code: data.data.ussd_code,
          bank_name: getBankName(bankCode),
          amount: amount,
          phone: phone || '',
          expires_at: data.data.expires_at || null
        }
      };

    } catch (error) {
      console.error('Error initializing USSD payment:', error);
      showToast(error instanceof Error ? error.message : 'Failed to initialize USSD payment', 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const checkPaymentStatus = async (reference: string): Promise<boolean> => {
    if (!session?.user) {
      showToast('Please log in to continue', 'error');
      return false;
    }

    setIsVerifying(true);

    try {
      // Check if Paystack secret key is available
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Payment service not properly configured');
      }

      // Verify payment with Paystack using the charge verification endpoint
      const response = await fetch(`${PAYSTACK_API_URL}/charge/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const data: VerificationResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify payment');
      }

      const transaction = data.data;

      // Check if payment was successful
      if (transaction.status === 'success') {
        // Update transaction status in database
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference)
          .eq('user_id', session.user.id);

        if (updateError) {
          console.error('Error updating transaction:', updateError);
        }

        // Add funds to user's wallet
        const amountInNaira = transaction.amount / 100;
        const { data: walletResult, error: walletError } = await supabase.rpc('add_funds', {
          arg_user_id: session.user.id,
          arg_amount: amountInNaira
        });

        if (walletError) {
          console.error('Error adding funds to wallet:', walletError);
        }

        // Create notification
        await supabase
          .from('events')
          .insert({
            user_id: session.user.id,
            type: 'deposit_successful',
            title: 'USSD Payment Successful',
            description: `₦${amountInNaira.toLocaleString()} has been added to your wallet via USSD`,
            status: 'unread'
          });

        showToast(`Payment successful! ₦${amountInNaira.toLocaleString()} added to your wallet`, 'success');
        return true;
      } else {
        showToast('Payment is still pending. Please complete the USSD transaction and try again.', 'info');
        return false;
      }

    } catch (error) {
      console.error('Error checking payment status:', error);
      showToast(error instanceof Error ? error.message : 'Failed to check payment status', 'error');
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    initializeUSSD,
    checkPaymentStatus,
    checkUSSDAvailability,
    bankAvailability,
    isLoading,
    isVerifying,
    isCheckingAvailability,
  };
}; 