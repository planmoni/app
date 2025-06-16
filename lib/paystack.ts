const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY!

export interface PaystackTitanAccount {
  email: string
  first_name: string
  last_name: string
  phone: string
  preferred_bank: string
  country: string
}

export interface PaystackPlan {
  name: string
  amount: number
  interval: "weekly" | "monthly" | "annually"
  description?: string
}

export const createTitanAccount = async (accountData: PaystackTitanAccount) => {
  try {
    const response = await fetch("https://api.paystack.co/dedicated_account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accountData),
    })
    return await response.json()
  } catch (error) {
    throw new Error("Failed to create Paystack Titan account")
  }
}

const fetchAccounts = async () => {
  try {
    const res = await axios.get('https://api.paystack.co/dedicated_account', {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });
    setAccounts(res.data.data);
  } catch (error) {
    console.error(error?.response?.data || error);
    Alert.alert('Error', 'Failed to fetch accounts');
  }
};



export const createPaymentPlan = async (planData: PaystackPlan) => {
  try {
    const response = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...planData,
        amount: planData.amount * 100, // Convert to kobo
      }),
    })
    return await response.json()
  } catch (error) {
    throw new Error("Failed to create payment plan")
  }
}

export const initializePayment = (paymentData: any) => {
  return {
    ...paymentData,
    publicKey: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY!,
    currency: "NGN",
    channels: ["card", "bank", "ussd", "qr"],
  }
}

export const generateReference = () => {
  return `savings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
