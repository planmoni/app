/**
 * Mono SDK Integration Utilities
 * 
 * Helper functions for Mono bank account linking
 * 
 * Note: These are now client-side utilities. For production use,
 * consider moving sensitive operations to server-side for better security.
 */

// Re-export types from hooks for backward compatibility
export type { MonoAccountData } from '@/hooks/useMonoAccountLinking';