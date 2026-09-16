/**
 * @deprecated Use fetchWallet / refreshWalletOnce from `@/lib/queries/walletQueries`.
 * Kept as a thin re-export so any stale imports keep compiling.
 */
export {
  fetchWallet as refreshWalletOnce,
  isWalletFetchInFlight as isWalletRefreshInFlight,
  type WalletData,
} from '@/lib/queries/walletQueries';
