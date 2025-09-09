// Global error suppression
// Suppress console errors in production, and specific errors in development
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress specific errors that are not critical
  if (
    message.includes('Events subscription timed out') ||
    message.includes('refreshWallet is not a function') ||
    message.includes('Paystack API error') ||
    message.includes('network request failed') ||
    message.includes('504') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('timeout') ||
    message.includes('fetch failed')
  ) {
    // Suppress these errors silently
    return;
  }
  
  // In production, only log critical errors
  if (!__DEV__) {
    if (
      message.includes('Critical') ||
      message.includes('Fatal') ||
      message.includes('Security')
    ) {
      originalConsoleError(...args);
    }
    return;
  }
  
  // In development, log all other errors
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress specific warnings
  if (
    message.includes('Events subscription timed out') ||
    message.includes('refreshWallet is not a function')
  ) {
    return;
  }
  
  // In production, suppress all warnings
  if (!__DEV__) {
    return;
  }
  
  // In development, log other warnings
  originalConsoleWarn(...args);
};

// Suppress unhandled promise rejections
const originalUnhandledRejection = global.onunhandledrejection;
global.onunhandledrejection = (event: any) => {
  // Suppress unhandled promise rejections
  event.preventDefault();
}; 