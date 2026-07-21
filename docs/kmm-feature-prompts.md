# Planmoni KMM + Compose — Feature Prompts

Copy-paste prompts for building the KMM + Compose revamp. Use the **Base prompt** with every feature prompt, or paste a feature prompt alone when scoping work to one module.

**Architecture reference:** [kmm-revamp-architecture.md](./kmm-revamp-architecture.md)

---

## How to use

1. Start a Cursor/AI session for a feature (e.g. Wallet).
2. Paste the **Base prompt** first.
3. Paste the relevant **Feature prompt** (e.g. Wallet prompt).
4. Optionally attach backend docs: `VAULTS.md`, `PLANS_IMPLEMENTATION.md`, etc.

For full app scaffolding, use the **Full app revamp prompt** at the end.

---

## Base prompt

```markdown
Build this feature for a Kotlin Multiplatform + Jetpack Compose fintech app (Planmoni) using a performance-first architecture.

Global rules:
- Separate `sessionExists` from `tokenReadyForApi`. All financial queries require `tokenReadyForApi && userId`.
- Never block post-login navigation on profile fetch, push init, device checks, analytics, or other side effects.
- Never use one loading flag for app init, login, and logout. Use `isInitializing`, `isSigningIn`, `isSigningOut` separately.
- Always prefer: disk cache → in-memory StateFlow → network refresh.
- Use shared repositories and shared cache keys so multiple screens do not refetch the same data independently.
- Use one RealtimeManager for the authenticated session — not per-screen subscriptions.
- Wallet is special: always fresh (staleTime=0), realtime-aware, 15s foreground polling allowed.
- Plans and Vaults are separate domains but share invalidation infrastructure.
- Notifications list must be lazy and paginated; unread badge count must be lightweight COUNT + deduped sync.
- Insights must be derived from cached financial data, not fetched independently.
- Show soft degraded states (cached data + banner) instead of blocking full-screen spinners.
- Logout: clear local session and financial caches first; preserve per-user PIN/biometric preferences; brief splash to avoid white flash.
- Do not prompt for notification permission on app startup.
- Compose screens are dumb; ViewModels expose `StateFlow<UiState>` and one-off events via `SharedFlow` or sealed actions.
- Avoid duplicate refreshes on tab changes, navigation changes, and recomposition.

Terminology:
- "Vault" = budget-based expense plan (`budget_plans` backend)
- "Plan" = payout plan (`payout_plans` backend)
- "Wallet" = user main wallet (`wallets` backend)

Deliver for this feature:
1. Domain models
2. Repository interface + implementation sketch
3. Local cache strategy (keys, hydration, invalidation)
4. Remote fetch strategy
5. ViewModel: UiState, events, enabled gates
6. Compose screen integration notes
7. Realtime / lifecycle integration points
8. Edge cases and anti-patterns to avoid
```

---

## Auth prompt

```markdown
Implement the Auth module for Planmoni (KMM + Compose fintech app).

Requirements:
- Separate `sessionExists` and `tokenReadyForApi`.
- Support cold-start session restore, login, signup, logout, and expired-session recovery (WelcomeBack with prefilled email).
- On login/signup success: navigate to Home immediately. Run profile snapshot, device checks, push init, and analytics in background coroutines — do not await before navigation.
- Never show splash on successful login transition.
- Use `isInitializing` (cold start only), `isSigningIn`, `isSigningOut` — never set init loading during sign-in/out.
- During password login, keep `tokenReadyForApi = true` so splash does not re-cover the password screen.
- Do not flip `tokenReadyForApi` to false during same-user token refresh mid-login.
- On logout: optimistic local clear → mark token ready appropriately → clear financial caches → background server signOut(scope=local).
- Preserve per-user PIN/biometric preferences on logout.

Reference behavior from RN app:
- Session blob in secure storage (single JSON key).
- `authStartupComplete = !isInitializing && (!session || tokenReady)`.
- Expired session routes to welcome-back, not generic error.

Deliver:
- AuthRepository interface + implementation outline
- AuthViewModel with sealed AuthState
- Session persistence (expect/actual secure storage)
- Cold start restore flow
- Login / signup / logout flows
- Integration with financial cache clear on logout
- Anti-patterns to avoid (single isLoading, await profile on SIGNED_IN, splash on login success)
```

---

## Home prompt

```markdown
Implement the Home module for Planmoni (KMM + Compose fintech app).

Requirements:
- Home must feel instant on cold start — render from cached snapshots before network returns.
- Display: wallet summary, plan summary (bounded), vault summary (bounded), quick actions, profile greeting.
- Do NOT make Home trigger every app query at startup (no eager notifications, no full transaction history, no full insights fetch).
- Pull-to-refresh orchestration:
  1. Prioritize wallet refresh with 4s timeout
  2. Then refresh plans + vaults + transactions in parallel
- Support guest and authenticated states; guest sees marketing/onboarding CTAs, auth-gated actions use requireAuth(returnTo).
- Guest welcome modal: at most once per signed-out session (process-surviving gate, not Compose remember{} alone).
- Use shared repositories only — no direct Supabase calls from Home Composable.

Deliver:
- HomeUiState (wallet, planCount, vaultCount, greeting, guest vs auth flags)
- Data sources for instant render (profile snapshot, cached summaries)
- HomeViewModel refresh orchestration
- Guest welcome gate integration
- List of what Home must NOT fetch eagerly
- Anti-patterns to avoid
```

---

## Wallet prompt

```markdown
Implement the Wallet module for Planmoni (KMM + Compose fintech app).

Requirements:
- Wallet balance is always fresh-sensitive — treat differently from plans/vaults/transactions.
- staleTime equivalent = 0; refetch every 15 seconds while app is foreground and user is authenticated.
- Online-only for fresh balance fetch (not offlineFirst).
- Use previous balance as placeholder during refresh to avoid UI jumps.
- Integrate with RealtimeManager for immediate updates after deposits/payouts.
- After funding success (Paystack/Mono/USSD): invalidate wallet + transactions; do not block navigation waiting for refresh.
- Home pull-to-refresh races wallet fetch with 4s timeout.

Backend: `wallets` table, user-scoped by auth user id.

Deliver:
- WalletRepository
- WalletCache (user-scoped key, hydration on launch)
- Realtime patch or invalidation strategy
- WalletViewModel / balance StateFlow
- Funding success refresh hook
- Foreground polling lifecycle integration
- Anti-patterns (5min stale, offlineFirst for wallet, blocking UI on fund success)
```

---

## Transactions prompt

```markdown
Implement the Transactions module for Planmoni (KMM + Compose fintech app).

Requirements:
- Paginated transaction history with cursor or page-based infinite scroll.
- Cache first page locally for instant screen open.
- Preserve visible items during background refresh (merge, don't replace with empty).
- Support filters (type, date range) and detail navigation without reloading full history.
- On network failure: show cached transactions + soft error banner; pull-to-refresh — no full-screen Retry wall.
- Do NOT fetch full transaction history on screen open.
- Gate queries: `tokenReadyForApi && userId`.
- Invalidate on wallet fund, payout complete, vault spend — targeted, not global storm.

Backend: `transactions` / ledger entries, user-scoped.

Deliver:
- TransactionsRepository
- Paging strategy (Paging 3 on Android wrapping shared repo, or manual cursor in shared)
- First-page cache keys and hydration
- TransactionsViewModel UiState (items, loading, error, hasNextPage)
- Filter + detail navigation without full reload
- Invalidation rules
- Anti-patterns to avoid
```

---

## Plans prompt (payout plans)

```markdown
Implement the Plans module for Planmoni (KMM + Compose fintech app).

"PPlan" = payout plan — scheduled/future money movement. Backend: `payout_plans` and related tables. NOT the same as Vaults (budget_plans).

Requirements:
- Shared PlansRepository consumed by Home (summary), Calendar, Insights, and PlanList (full).
- Summary query: bounded limit (e.g. 20) for dashboard surfaces.
- Full list: infinite pagination for All Plans / All Payouts screen.
- Support: list, detail, create, progress, due dates, calendar integration.
- After plan mutations (create, edit, fund): invalidate affected plan + shared summaries — not entire app.
- staleTime ~5min for list data; offline-first OK.
- Do NOT duplicate plan fetches across Home, Calendar, and Insights tabs.

Deliver:
- PlansRepository interface
- Summary vs full-list query methods
- Cache shape and shared keys
- PlanDetailViewModel
- PlanCreate flow invalidation
- Calendar integration (read shared cache)
- Anti-patterns (per-tab independent fetches, blocking list on enrichments)
```

---

## Vaults prompt (budget / expense plans)

```markdown
Implement the Vaults module for Planmoni (KMM + Compose fintech app).

"Vault" = user-facing name for budget-based expense plan. Backend: `budget_plans`, `plan_wallets`, `plan_transactions`, `expense_plan_topups`. See VAULTS.md for schema.

Requirements:
- Vaults is a DISTINCT domain from payout Plans — separate repository, separate cache keys.
- Support: vault list, vault detail, create vault, fund vault, spend from vault, funding method, auto-topup state.
- Summary query (bounded ~20) for Home and Insights; full list for VaultList screen.
- Cache vault summaries for instant Home/Insights render.
- Cheap access to metrics: vault exists, last created time, funding method (for CRM/Bunce attribute sync).
- Invalidate vault cache + wallet (if debited) on fund/spend — not unrelated plans or payouts.
- staleTime ~5min; offline-first OK for list data.

Deliver:
- VaultsRepository
- Vault summary vs detail cache strategy
- VaultListViewModel + VaultDetailViewModel
- Create / fund / spend flows with targeted invalidation
- Integration with wallet when user main wallet is debited
- Anti-patterns (mixing vault logic into payout plans repo, global invalidation on every vault update)
```

---

## Insights prompt

```markdown
Implement the Insights module for Planmoni (KMM + Compose fintech app).

Requirements:
- Insights makes ZERO independent network requests for data available in wallet, plans, vaults, or transactions caches.
- Compute all metrics via pure functions from shared repository flows:
  - PlansRepository (bounded ~20)
  - VaultsRepository (bounded ~20)
  - TransactionsRepository (bounded ~20)
  - WalletRepository (balance)
- Persist computed metrics to disk for instant tab reopen.
- Recompute only when source datasets change (observe shared flows).
- No useFocusEffect / tab-focus refetch pattern.
- Smooth instant tab switch: show cached metrics immediately, update when sources refresh.

Example metrics: total funded, available to spend, plan health %, vault summaries, funding trends, counts.

Deliver:
- InsightsMetric model
- Pure computation functions (domain/usecase)
- InsightsCacheRepository (persist computed snapshot)
- InsightsViewModel observing shared repos
- Source dependency graph
- Anti-patterns (separate insights API, refetch on tab focus, duplicate plan/vault queries)
```

---

## Notifications prompt

```markdown
Implement the Notifications module for Planmoni (KMM + Compose fintech app).

Requirements:
- Notifications LIST: lazy-loaded ONLY when Notifications/Activities screen is visible — never on app launch or tab bar mount.
- Pagination: page size ~10, infinite scroll with hasNextPage / isFetchingNextPage guard.
- Cache first page for instant open.
- UNREAD BADGE: lightweight COUNT query (head only, no row payload) — NOT a full list fetch.
- BadgeSyncCoordinator: debounce 2.5s, coalesce in-flight requests (Mutex + shared Job).
- Do NOT refetch full notification list on tab focus — badge sync only on focus if needed.
- Mark-as-read: optimistic local patch → then sync badge count.
- Push permission: NEVER prompt at app launch. Initialize FCM ~800ms after login; skip if user still on login/welcome-back routes.
- Push token registration: insert-only with duplicate-key tolerance — no client upsert against RLS.
- On list error: show cached items + soft banner; pull-to-refresh — no Retry wall.

Backend: `events` or equivalent notification store.

Deliver:
- NotificationsRepository
- BadgeSyncCoordinator
- Paginated list strategy
- NotificationsViewModel
- Optimistic mark-read flow
- Push init timing integration with Auth module
- Anti-patterns (eager fetch, full list for badge, permission at startup)
```

---

## Payouts prompt

```markdown
Implement the Payouts module for Planmoni (KMM + Compose fintech app).

Requirements:
- Support: due payouts list, payout history/detail, retry states, payout account linkage.
- Use targeted invalidation — wallet + plans + transactions after payout complete — not app-wide refresh storm.
- Optimistic status updates only where backend behavior is deterministic.
- Reuse shared RealtimeManager and foreground refresh infrastructure.
- Payout screens must not cause heavy global loading overlays.

Deliver:
- PayoutsRepository
- List + detail loading strategy
- Retry / status update flow
- Invalidation map (payout complete → wallet, plans, transactions)
- PayoutsViewModel
- Anti-patterns (global invalidate on every payout screen open)
```

---

## KYC prompt

```markdown
Implement the KYC module for Planmoni (KMM + Compose fintech app).

Requirements:
- Expose: current tier, requirements, deposit/transfer limits, upgrade progress.
- KYC state is lightweight and cacheable — must NOT slow login or home rendering.
- Refresh KYC only after explicit success actions (tier submission approved), not on every navigation.
- Central KycRepository consumed by deposit, payout, and transfer flows for limit checks.
- Tier state available to wallet funding and vault creation gates.

Deliver:
- KycRepository + KycViewModel
- Cached tier state with invalidation on KYC success
- Integration points: Wallet fund, Vault create, Payout withdraw
- Upgrade flow navigation
- Anti-patterns (KYC fetch blocking auth ready, refetch on every route)
```

---

## Settings / Profile / Security prompt

```markdown
Implement Settings, Profile, and Security modules for Planmoni (KMM + Compose fintech app).

Requirements:
- Settings and profile render instantly from local profile snapshot — no await remote profile before showing UI.
- Support: profile details, security center, PIN setup, biometric prefs, app lock, logout.
- PIN and biometric preferences are per-user and PERSIST across logout — do not clear on signOut.
- Financial caches (wallet, plans, vaults, transactions) DO clear on logout.
- Logout UX: Settings → LogoutScreen (animated ~2s) → guest home. Root detects session→null and shows brief splash (~1.2s) to avoid white flash.
- Guest welcome modal must not reopen multiple times after logout (process-surviving gate).

Deliver:
- ProfileSnapshotRepository
- SettingsViewModel + SecurityViewModel
- Logout flow integration with AuthRepository
- App lock / biometric expect/actual platform bridges
- Cache clear vs preserve matrix
- Anti-patterns (full profile fetch before settings, wipe PIN on logout, white flash on logout)
```

---

## Cards / Funding prompt

```markdown
Implement Cards and Funding flows for Planmoni (KMM + Compose fintech app).

Requirements:
- Support: Paystack card add, Mono direct debit, USSD, bank transfer deposit flows.
- Navigate fast on success — do not block on wallet refresh before navigation.
- After success: invalidate wallet + transactions; race wallet refresh with 4s timeout on return to home.
- Funding flows are stack overlays — do not remount main tabs unnecessarily.
- Handle Mono processing / failure / success screens with clear back navigation to home or wallet.

Deliver:
- FundingRepository or per-provider repositories
- Success/failure navigation events
- Post-funding invalidation hooks (wallet, transactions, vault if applicable)
- ViewModel state for each flow step
- Anti-patterns (await wallet refresh before navigate, global refresh after fund)
```

---

## Realtime & lifecycle prompt

```markdown
Implement shared Realtime and Foreground Refresh infrastructure for Planmoni (KMM + Compose fintech app).

Requirements:
- One RealtimeManager for authenticated session — subscribe when tokenReady, teardown on logout.
- Channels / subscriptions:
  - Wallet → patch wallet cache
  - Payout plans → invalidate plans cache
  - Budget plans (vaults) → invalidate vaults cache
  - Transactions → invalidate transactions cache
- ForegroundRefreshCoordinator on app resume:
  1. ensureSupabaseConnection(skipProbe=true)
  2. invalidateFinancialCaches()
  3. Stagger: wallet 0ms, plans+vaults 750ms, badge 1500ms
- Coalesce rapid ON_RESUME events (debounce).
- Network-return refresh only after at least one prior resume (avoid double-fetch on cold start).
- Expose as injectable singleton used by all financial repositories.

Deliver:
- RealtimeManager design (subscribe, patch, invalidate, teardown)
- AppLifecycleObserver / ProcessLifecycleOwner integration
- Staggered refresh coroutine scope
- Cache invalidation map (event → keys)
- Integration points for Wallet, Plans, Vaults, Transactions, Notifications badge
- Anti-patterns (per-screen channels, refresh storm on resume, invalidate notifications full list on resume)
```

---

## App shell prompt

```markdown
Implement the App Shell for Planmoni (KMM + Compose fintech app).

Requirements:
- SplashGate: show splash during cold start (fonts + auth restore) and logout transition (~1.2s) ONLY — not on login success.
- MainScaffold: bottom tabs always visible (Home, AI, Calendar, Insights, Settings) for guest and authenticated users.
- Deep link handling (plan share codes, etc.) without blocking auth restore.
- App lock overlay when enabled — clear navigation_in_progress flags on route change.
- Theme (Material 3), text size, toast/snackbar host.
- Provider/graph order: ErrorBoundary → DI → Theme → Auth → Realtime → Balance/Wallet observation → Notifications host.
- No artificial delays in tab layout or navigation transitions.

Deliver:
- Root NavHost structure
- SplashGate logic tied to isInitializing + authStartupComplete
- MainScaffold with bottom bar
- Deep link router
- App lock integration point
- Anti-patterns (splash on login, tab delay, single isLoading for everything)
```

---

## Full app revamp prompt

```markdown
Design and scaffold the full Planmoni fintech app revamp in Kotlin Multiplatform + Jetpack Compose.

Modules to include:
- App Shell (splash, tabs, deep links, app lock)
- Auth
- Home
- Wallet
- Transactions
- Plans (payout plans — payout_plans)
- Vaults (budget plans — budget_plans)
- Notifications
- Insights
- Payouts
- KYC
- Cards / Funding (Paystack, Mono, USSD)
- Settings / Profile / Security
- Realtime + Foreground Lifecycle

Cross-cutting requirements:
- Fast cold start with disk-first hydration
- Immediate post-login navigation (no splash on success)
- Brief smooth logout transition (no white flash)
- Two-phase auth: sessionExists vs tokenReadyForApi
- Shared repositories — no duplicate fetches across tabs
- One RealtimeManager
- Wallet always fresh (0 stale, 15s poll, realtime)
- Plans and Vaults as separate domains with shared invalidation infra
- Notifications lazy + paginated; badge deduped
- Insights derived from cached data only
- Soft error handling with cached fallback
- Guest-friendly tabs with action-level auth gating
- Preserve PIN/biometrics per user on logout

For EACH module provide:
1. Responsibility boundary
2. UiState / event model
3. Repository interface
4. Local cache plan (keys, hydration, TTL)
5. Remote fetch plan
6. Realtime / lifecycle integration
7. Loading, empty, and error state behavior
8. Anti-patterns to avoid

Reference architecture doc: docs/kmm-revamp-architecture.md
Reference backend: docs/VAULTS.md, docs/PLANS_IMPLEMENTATION.md

Success criteria:
- Cold start to usable home with cached wallet/plans: <500ms perceived
- Login: password → home <300ms perceived
- Logout: no white flash, welcome modal once only
- Insights tab: instant from cache
- Notifications: first 10 fast; badge accurate without spam
- Wallet: reflects deposit within 15s or via realtime
```

---

## Quick reference: which prompt when?

| Task | Prompt(s) |
|------|-----------|
| New feature from scratch | Base + Feature |
| Auth/login/logout bugs | Base + Auth + App shell |
| Slow home / cold start | Base + Home + Wallet + Realtime |
| Stale balance | Base + Wallet + Realtime |
| Slow insights tab | Base + Insights + Plans + Vaults |
| Notification spam / badge | Base + Notifications + Realtime |
| Vault vs plan confusion | Vaults + Plans (both) |
| Full greenfield scaffold | Full app revamp |
| Post-funding wallet wrong | Wallet + Cards/Funding + Transactions |

---

*Last updated: July 2026*
