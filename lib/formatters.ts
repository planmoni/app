/**
 * Formats a payout frequency into a user-friendly string
 * 
 * @param frequency The frequency type from the database
 * @param dayOfWeek Optional day of week (0-6, where 0 is Sunday)
 * @returns A formatted string describing the frequency
 */
export function formatPayoutFrequency(frequency: string, dayOfWeek?: number | null): string {
  switch (frequency) {
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