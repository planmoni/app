/**
 * Formats a payout frequency into a user-friendly string
 * 
 * @param frequency The frequency type from the database
 * @param dayOfWeek Optional day of week (0-6, where 0 is Sunday)
 * @returns A formatted string describing the frequency
 */
export function formatPayoutFrequency(frequency: string, dayOfWeek?: number | null): string {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'weekly_specific':
      return `Every ${getDayOfWeekName(dayOfWeek)}`;
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'end_of_month':
      return 'Month End';
    case 'quarterly':
      return 'Quarterly';
    case 'biannual':
      return 'Bi-annual';
    case 'annually':
      return 'Annually';
    case 'custom':
      return 'Custom';
    default:
      return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  }
}

/**
 * Gets the name of a day of the week from its number
 * 
 * @param day Day number (0-6, where 0 is Sunday)
 * @returns The name of the day, or null if invalid
 */
export function getDayOfWeekName(day?: number | null): string {
  if (day === undefined || day === null) return 'Day';
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || 'Day';
}

/**
 * Formats a date for display (Month Day, Year)
 * 
 * @param dateString Date string in any valid format
 * @returns Formatted date string
 */
export function formatDisplayDate(dateString: string): string {
  // Check if the date is already in the format "Month Day, Year"
  if (/[A-Za-z]+ \d+, \d{4}/.test(dateString)) {
    return dateString;
  }
  
  // Otherwise, convert from ISO format (YYYY-MM-DD)
  const date = new Date(dateString);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Formats a currency amount
 * 
 * @param amount Numeric amount
 * @param showCurrency Whether to show the currency symbol
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, showCurrency: boolean = true): string {
  return showCurrency ? `₦${amount.toLocaleString()}` : amount.toLocaleString();
}

/**
 * Formats a payout date and time for display
 * 
 * @param dateString Date string in any valid format (ISO string, date, or timestamptz)
 * @returns Formatted date and time string (e.g., "Nov 22, 2020 at 6:00 AM")
 */
export function formatPayoutDateTime(dateString: string): string {
  // Handle both date strings and timestamptz strings
  let date: Date;
  
  // If the string is just a date (YYYY-MM-DD), it will default to midnight
  // Check if it's a full ISO timestamp string
  if (dateString.includes('T') || dateString.includes(' ')) {
    // It's a timestamp string with time
    date = new Date(dateString);
  } else {
    // It's just a date string, create date at midnight
    date = new Date(dateString + 'T00:00:00');
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Format date
  const dateFormatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Format time - always show time even if it's midnight
  const timeFormatted = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${dateFormatted} at ${timeFormatted}`;
}

/**
 * Formats a transaction type into a user-friendly string
 * 
 * @param type The transaction type from the database
 * @returns A formatted string describing the transaction type
 */
export function formatTransactionType(type: string): string {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'payout':
      return 'Payout';
    case 'withdrawal':
      return 'Withdrawal';
    case 'expense_plan_topup':
      return 'Budget Top-Up';
    case 'referral_bonus':
      return 'Referral Bonus';
    default:
      // Fallback: capitalize first letter and replace underscores with spaces
      return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
}