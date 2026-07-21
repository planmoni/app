# Planmoni KMM + Compose Revamp Architecture

This document defines the target architecture for revamping Planmoni in **Kotlin Multiplatform (KMM) + Jetpack Compose**, based on performance patterns that made the current React Native app feel smooth (login, signup, wallet, insights, notifications, vaults, plans, transactions, etc.).

Use this as the **source of truth** for module layout, data-flow rules, and anti-patterns to avoid.

---

## Table of contents

1. [Goals](#goals)
2. [Module structure](#module-structure)
3. [Product domains](#product-domains)
4. [Cross-cutting infrastructure](#cross-cutting-infrastructure)
5. [Navigation structure](#navigation-structure)
6. [Data & cache rules](#data--cache-rules)
7. [Feature ownership](#feature-ownership)
8. [RN → KMM mapping](#rn--kmm-mapping)
9. [Do / Don't checklist](#do--dont-checklist)

---

## Goals

| Goal | Target |
|------|--------|
| Cold start to usable home | < 500ms perceived (cached data visible) |
| Login → home | < 300ms perceived; background work continues silently |
| Logout | No white flash; guest welcome once only |
| Wallet after deposit | ≤ 15s poll or immediate via realtime |
| Insights tab switch | Instant from cached metrics |
| Notifications | First 10 fast; badge accurate without API spam |

---

## Module structure

```
planmoni/
├── shared/                          # KMM — all business logic
│   ├── core/
│   │   ├── auth/                    # Session, token readiness, sign-in/out
│   │   ├── network/                 # Supabase/Ktor client, connection health
│   │   ├── cache/                   # DataStore/SQLDelight, hydration, keys
│   │   ├── realtime/                # ONE subscription manager
│   │   ├── notifications/           # Push token, badge sync coordinator
│   │   ├── lifecycle/               # Foreground refresh coordinator
│   │   ├── analytics/               # Event tracking (non-blocking)
│   │   └── util/                    # Dates, money formatting, guards
│   │
│   ├── domain/
│   │   ├── model/                   # Wallet, Plan, Vault, Transaction, Notification
│   │   ├── repository/              # Interfaces per domain
│   │   └── usecase/                 # Login, Logout, ComputeInsights, SyncBadge
│   │
│   ├── data/
│   │   ├── remote/                  # Supabase/PostgREST/Edge function clients
│   │   ├── local/                   # DataStore, SQLDelight, secure storage
│   │   ├── mapper/                  # DTO ↔ domain model
│   │   └── repository/              # Repository implementations
│   │
│   └── presentation/
│       ├── auth/
│       ├── home/
│       ├── wallet/
│       ├── transactions/
│       ├── plans/
│       ├── vaults/
│       ├── insights/
│       ├── notifications/
│       ├── payouts/
│       ├── kyc/
│       ├── settings/
│       └── shared/                  # UiState helpers, base ViewModel
│
├── androidApp/                      # Compose UI only
│   ├── navigation/                  # NavHost, bottom bar, deep links
│   ├── screens/                     # Composables per route
│   ├── theme/                       # Material 3, typography
│   └── platform/                    # FCM, biometrics, secure storage bridges
│
└── iosApp/                          # SwiftUI shell or Compose Multiplatform iOS
    └── (thin — delegates to shared ViewModels)
```

### Layer rules

| Layer | Owns | Must NOT own |
|-------|------|--------------|
| **Compose screens** | Layout, gestures, pull-to-refresh triggers | Supabase calls, cache keys, retry logic |
| **ViewModels** | `StateFlow<UiState>`, navigation events, `enabled` gates | Raw SQL, channel subscriptions |
| **Repositories** | Fetch, cache read/write, pagination cursors | Composable state |
| **Cache** | Disk hydration, user-scoped keys, profile snapshots | UI formatting |
| **RealtimeManager** | One channel set, patch shared cache | Per-screen subscriptions |
| **AuthRepository** | Session blob, `tokenReady`, optimistic logout | Splash UI logic |

**Golden rule:** UI never talks to Supabase directly. Screens → ViewModel → UseCase → Repository → (Cache + Network).

---

## Product domains

Planmoni is a fintech app with these first-class product areas. Each domain gets its own repository, cache keys, and ViewModel — but shares cross-cutting infrastructure.

| Domain | User-facing | Backend (current RN app) | Notes |
|--------|-------------|--------------------------|-------|
| **Auth** | Login, signup, welcome-back, logout | Supabase Auth + session persistence | Two-phase auth state |
| **Home** | Dashboard, quick actions, summaries | Aggregates from shared caches | Never eager-fetch everything |
| **Wallet** | Main balance, fund wallet | `wallets` table | Always fresh; special cache rules |
| **Transactions** | Activity history, filters, detail | `transactions` / ledger | Paginated; cache first page |
| **Plans** | Payout plans, scheduled payouts, calendar | `payout_plans` and related | Shared cache: Home + Calendar + Insights |
| **Vaults** | Budget-based expense plans (user calls them "Vaults") | `budget_plans`, `plan_wallets`, `plan_transactions` | Distinct domain from payout plans |
| **Insights** | Savings metrics, trends, plan health | Derived from plans + vaults + transactions | Zero independent network fetch |
| **Notifications** | Activity feed, unread badge | `events` / notification tables | Lazy list; deduped badge |
| **Payouts** | Due payouts, retry, payout detail | Payout execution tables + webhooks | Targeted invalidation only |
| **KYC** | Verification tiers, limits, upgrade | KYC progress + audit trail | Lightweight; no login blocking |
| **Cards / Funding** | Add card, bank transfer, Mono/Paystack | Paystack + Mono integrations | Navigate fast; refresh wallet after success |
| **Settings / Profile** | Profile, security, PIN, biometrics, logout | `profiles` + local prefs | Snapshot-first render |
| **App shell** | Splash, tabs, deep links, app lock, theme | N/A | No artificial delays |

### Terminology (align with existing backend)

| User-facing | Backend table(s) |
|-------------|------------------|
| Vault | `budget_plans` (+ `plan_wallets`, `plan_transactions`, `expense_plan_topups`) |
| Plan (payout) | `payout_plans` (+ related payout execution) |
| Wallet | `wallets` |
| Transaction | `transactions` / ledger entries |
| Notification | `events` (or equivalent notification store) |

See also: [VAULTS.md](./VAULTS.md), [PLANS_IMPLEMENTATION.md](./PLANS_IMPLEMENTATION.md).

---

## Cross-cutting infrastructure

### 1. Two-phase auth (critical)

Never merge session existence and API token readiness into one boolean.

```kotlin
sealed class AuthState {
    data object Initializing : AuthState()
    data class Guest(val tokenReady: Boolean = false) : AuthState()
    data class Authenticated(
        val userId: String,
        val sessionExists: Boolean,
        val tokenReady: Boolean,  // ← gate ALL money queries on this
    ) : AuthState()
}
```

| State | Meaning | Gates |
|-------|---------|-------|
| `sessionExists` | User / refresh token in secure storage | Splash dismissal |
| `tokenReady` | Valid non-expired access token | Wallet, plans, vaults, transactions, notifications |

**Separate flags:** `isInitializing` (cold start only), `isSigningIn`, `isSigningOut`. Never one global `isLoading`.

### 2. Optimistic navigation

| Flow | Pattern |
|------|---------|
| Login / signup success | Navigate to Home immediately → background: device check, push init, cache reset, profile snapshot |
| Logout | Clear local session + financial caches → `signOut(scope=local)` in background → brief splash (~1.2s) → guest home |
| Funding success | Navigate back fast → invalidate wallet + relevant plan/vault |

### 3. Cache hydration order

```
Cold start → read DataStore/SQLDelight
          → emit to StateFlow (placeholder)
          → fetch network if tokenReady
          → merge + persist
```

Hydrate on launch:
- Wallet balance
- Profile snapshot
- First page of plans (bounded, e.g. 20)
- First page of vaults (bounded, e.g. 20)
- First page of transactions (20)
- First page of notifications (10)
- Precomputed insights metrics

### 4. Single RealtimeManager

One manager per authenticated session. Subscribe when `tokenReady`.

| Channel | Action |
|---------|--------|
| Wallet changes | Patch wallet cache directly |
| Plan changes | Invalidate plans cache |
| Vault / budget plan changes | Invalidate vaults cache |
| Transaction inserts | Invalidate transactions cache |

Do **not** create per-screen Supabase channels.

### 5. Foreground refresh coordinator

On app resume (`ProcessLifecycleObserver`):

```
1. ensureSupabaseConnection(skipProbe = true)
2. invalidateFinancialCaches()   // wallet, plans, vaults, transactions
3. stagger refreshes:
   - 0ms:    wallet
   - 750ms:  plans + vaults
   - 1500ms: notifications badge only (not full list)
```

Coalesce rapid resume events. Do not refetch everything on tab switch.

### 6. Guest-first navigation

Bottom tabs always visible (Home, AI, Calendar, Insights, Settings). Protected actions call `requireAuth(returnTo)` → login → return.

Guest welcome modal: process-surviving gate (opens once per signed-out stretch; reset on login).

### 7. Secure storage boundaries

| Store | Content | Cleared on logout? |
|-------|---------|-------------------|
| Encrypted / Keychain | Session blob | Yes |
| DataStore per user | Wallet, plans, vaults, transactions, profile snapshot | Yes |
| DataStore per user | PIN, biometrics prefs | **No** — per-user, survives logout |

---

## Navigation structure

```
AppRoot
├── SplashGate                    # Cold start + logout transition only
├── MainScaffold                  # Bottom tabs always visible
│   ├── Home
│   ├── AI
│   ├── Calendar                  # Uses shared plans cache
│   ├── Insights                  # Derived from shared caches
│   └── Settings
│
├── AuthGraph
│   ├── Login
│   ├── Signup / Onboarding
│   ├── WelcomeBack               # Expired session recovery
│   └── ForgotPassword
│
├── WalletGraph
│   ├── FundWallet
│   ├── WalletHistory
│   └── LinkedAccounts
│
├── PlansGraph                    # Payout plans
│   ├── PlanList                  # Infinite list
│   ├── PlanDetail
│   ├── PlanCreate
│   └── AllPayouts
│
├── VaultsGraph                   # Budget / expense plans
│   ├── VaultList
│   ├── VaultDetail
│   ├── VaultCreate
│   └── VaultFund / Spend
│
├── TransactionsGraph
│   ├── TransactionList           # Paginated
│   └── TransactionDetail
│
├── NotificationsGraph
│   └── NotificationsList         # Lazy-loaded, paginated
│
├── PayoutsGraph
│   ├── PayoutList
│   └── PayoutDetail
│
├── KycGraph
│   ├── Tier1 / Tier2 / Tier3
│   └── KycSuccess
│
├── FundingGraph
│   ├── DepositFlow
│   ├── AddCard
│   ├── AddUssd
│   └── MonoProcessing
│
└── SettingsGraph
    ├── Profile
    ├── SecurityCenter
    ├── AppLock
    ├── PinSetup
    └── LogoutScreen              # Animated → guest home
```

---

## Data & cache rules

| Data | Stale time | Poll | Network mode | Fetch trigger |
|------|------------|------|--------------|---------------|
| **Wallet** | 0 (always fresh) | 15s foreground | Online only | App resume, pull-refresh, realtime |
| **Plans (summary)** | 5 min | No | Offline-first OK | Shared: Home, Calendar, Insights |
| **Plans (full list)** | 5 min | No | Offline-first OK | PlanList screen only |
| **Vaults (summary)** | 5 min | No | Offline-first OK | Home, Insights |
| **Vaults (full list)** | 5 min | No | Offline-first OK | VaultList screen only |
| **Transactions** | 5 min | No | Offline-first OK | Paginated; first page cached |
| **Notifications list** | 2 min | No | Lazy | Screen mounted only; page size 10 |
| **Unread badge** | 2 min | No | Lightweight COUNT | Debounced 2.5s; no refetch on tab focus |
| **Insights** | Derived | No | N/A | Recompute when source caches change |
| **KYC state** | 5 min | No | Offline-first OK | After explicit KYC success only |
| **Profile snapshot** | Until invalidated | No | Disk-first | Background after auth |

### Invalidation map

| Event | Invalidate |
|-------|------------|
| Login / signup | All financial caches (then hydrate) |
| Logout | All financial caches; keep PIN/biometrics |
| Wallet fund success | Wallet, transactions |
| Plan create/edit | Plans (summary + list if open) |
| Vault create/fund/spend | Vaults (summary + detail), wallet if debited |
| Payout completed | Plans, transactions, wallet |
| Mark notification read | Local patch + badge sync only |
| App resume | Financial caches (staggered refresh) |

---

## Feature ownership

### Auth

- Session restore, token readiness, login/signup/logout, welcome-back
- Device/session checks, profile snapshot trigger (background)
- **Don't:** block navigation on profile/push/device; splash on login success

### Home

- Dashboard cards, wallet/plan/vault summaries, quick actions
- **Don't:** trigger every app query at startup; refetch all tabs on open

### Wallet

- Balance, funding state, recent activity, realtime
- **Don't:** use 5min stale time; wait for plans before showing balance

### Transactions

- Paginated feed, filters, detail
- **Don't:** fetch full history on open; clear list during background refresh

### Plans (payout plans)

- List, detail, create, progress, calendar integration
- Bounded query (20) for summary surfaces; infinite for full list
- **Don't:** duplicate fetches across Home/Calendar/Insights

### Vaults (budget plans)

- List, detail, create, fund, spend, funding method, auto-topup state
- Separate repository from payout plans
- Metrics: existence, last created, funding method (for Bunce / CRM sync)
- **Don't:** invalidate unrelated screens on every vault update

### Insights

- Derived metrics: savings behavior, funding patterns, plan/vault health
- Pure computation from cached wallet + plans + vaults + transactions
- **Don't:** independent network layer; refetch on tab focus

### Notifications

- Activity feed (lazy, paginated), unread badge, mark-as-read
- Push init delayed ~800ms after login; skip on auth screens
- **Don't:** fetch on app launch; full list fetch for badge count

### Payouts

- Due payouts, retry states, detail/timeline
- **Don't:** global refresh storms from payout screens

### KYC

- Tier, requirements, limits, upgrade flow
- **Don't:** slow login/home; refetch on every navigation

### Settings / Profile / Security

- Profile snapshot, PIN/biometrics, app lock, logout
- **Don't:** full remote profile before showing settings; wipe PIN on logout

### Cards / Funding

- Paystack, Mono, USSD deposit flows
- Navigate fast; refresh wallet after success with timeout race (4s)

---

## RN → KMM mapping

| Current React Native | KMM equivalent |
|---------------------|----------------|
| `hooks/useSupabaseAuth.ts` + `contexts/AuthContext.tsx` | `AuthRepository` + `AuthViewModel` |
| React Query + `lib/queries/*` | `Flow` + `Repository` + DataStore cache |
| `contexts/RealtimeSyncProvider.tsx` | `RealtimeManager` (singleton) |
| `hooks/useForegroundRefreshCoordinator.ts` | `AppLifecycleObserver` + coroutine stagger |
| `lib/profileSnapshot.ts` | `ProfileCacheRepository` |
| `lib/welcome-guest-gate.ts` | `GuestWelcomeGate` (object / SavedStateHandle) |
| `lib/badge-sync.ts` | `BadgeSyncCoordinator` (Mutex + debounce) |
| `hooks/useRequireAuth.ts` | `AuthNavigator.requireAuth(route)` |
| `app/logging-out.tsx` | `LogoutScreen` composable |
| `hooks/useInsightsData.ts` + `lib/insights/*` | `InsightsUseCase` (pure functions) |
| Expo Router `(tabs)` | `Scaffold` + `NavigationBar` always visible |
| `hooks/queries/useWalletQuery.ts` | `WalletRepository` with zero stale + poll |
| `hooks/queries/useNotificationsQuery.ts` | `NotificationsRepository` + Paging 3 |

### Key RN files (reference)

| Topic | Path |
|-------|------|
| Auth context | `contexts/AuthContext.tsx` |
| Auth hook | `hooks/useSupabaseAuth.ts` |
| Root layout / splash | `app/_layout.tsx` |
| Tab layout | `app/(tabs)/_layout.tsx` |
| Wallet query | `hooks/queries/useWalletQuery.ts` |
| Notifications | `hooks/queries/useNotificationsQuery.ts` |
| Query keys | `lib/queries/keys.ts` |
| Foreground refresh | `hooks/useForegroundRefreshCoordinator.ts` |
| Realtime sync | `contexts/RealtimeSyncProvider.tsx` |
| Insights | `hooks/useInsightsData.ts`, `lib/insights/planInsights.ts` |
| Badge sync | `lib/badge-sync.ts` |
| Guest welcome gate | `lib/welcome-guest-gate.ts` |
| Logout screen | `app/logging-out.tsx` |

---

## Do / Don't checklist

### Do

- [ ] Split `sessionExists` and `tokenReadyForApi`
- [ ] Navigate immediately on login/signup success
- [ ] Disk → memory → network hydration for all key surfaces
- [ ] One RealtimeManager patching shared cache
- [ ] Foreground coordinator with staggered refreshes
- [ ] Wallet: zero stale time, 15s poll, online-only, placeholder previous balance
- [ ] Shared plans repository for Home / Calendar / Insights
- [ ] Separate vaults repository (budget_plans domain)
- [ ] Insights as pure computation from cached data
- [ ] Notifications: lazy mount, page 10, deduped badge sync
- [ ] Guest-first tabs with action-level auth gate
- [ ] Profile snapshot for instant header/settings
- [ ] Loading guard cap (12s) — show stale + pull-refresh, not infinite spinner
- [ ] Brief splash on logout only; no splash on login success
- [ ] Preserve PIN/biometrics per user across logout
- [ ] Soft errors on lists (cached data + banner, not Retry wall)

### Don't

- [ ] Single `isLoading` for init + login + logout
- [ ] Await profile/device/push in auth state listener
- [ ] Fetch notifications on app launch or tab bar focus
- [ ] 5min stale time on wallet
- [ ] Per-screen Supabase realtime channels
- [ ] Splash during login success path
- [ ] Flip `tokenReady` false→true mid-login same user
- [ ] Push permission prompt at cold start
- [ ] Independent insights API fetch per tab visit
- [ ] Clear PIN/biometrics on logout
- [ ] Multi-layer splash handoff chains
- [ ] Tab layout artificial delays
- [ ] Home as eager-fetch hub for all domains
- [ ] Full transaction history on screen open
- [ ] Guest welcome modal on every home remount

---

## Tech stack recommendations

| Concern | Recommendation |
|---------|----------------|
| DI | Koin (shared) + Hilt (Android optional) |
| Async | Coroutines + Flow |
| Local cache | SQLDelight or DataStore + kotlinx.serialization |
| Remote | Supabase Kotlin SDK or Ktor + PostgREST |
| Pagination | Paging 3 (Android) wrapping shared repository |
| Navigation | Compose Navigation |
| Secure storage | EncryptedSharedPreferences / Keychain via expect/actual |
| Push | Firebase Messaging → badge sync coordinator |

---

## Related docs

- [kmm-feature-prompts.md](./kmm-feature-prompts.md) — Copy-paste prompts per feature
- [VAULTS.md](./VAULTS.md) — Vault backend model
- [PLANS_IMPLEMENTATION.md](./PLANS_IMPLEMENTATION.md) — Plans tab implementation
- [BULLET_PROOF_AUTH_PESISTENCE.md](./BULLET_PROOF_AUTH_PESISTENCE.md) — Current auth persistence

---

*Last updated: July 2026*
