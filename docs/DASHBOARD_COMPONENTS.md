# Dashboard Components - Additional Templates

Additional component templates for the Planmoni Dashboard.

## 📦 Additional Components

### 1. `components/dashboard/Header.tsx`

```typescript
'use client'

import { Bell, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="hidden md:block">Partner Name</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
```

### 2. `components/dashboard/StatsGrid.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingUp, Clock, DollarSign } from 'lucide-react'

interface StatsGridProps {
  stats?: {
    total_wallets?: number
    total_disbursements?: number
    pending_approvals?: number
    total_volume?: number
  }
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statCards = [
    {
      title: 'Total Wallets',
      value: stats?.total_wallets || 0,
      icon: Wallet,
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'Disbursements',
      value: stats?.total_disbursements || 0,
      icon: TrendingUp,
      change: '+8%',
      changeType: 'positive' as const,
    },
    {
      title: 'Pending Approvals',
      value: stats?.pending_approvals || 0,
      icon: Clock,
      change: '-3%',
      changeType: 'negative' as const,
    },
    {
      title: 'Total Volume',
      value: `₦${((stats?.total_volume || 0) / 100).toLocaleString()}`,
      icon: DollarSign,
      change: '+15%',
      changeType: 'positive' as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p
                className={`text-xs mt-1 ${
                  stat.changeType === 'positive'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

### 3. `components/dashboard/RecentActivity.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'

interface Activity {
  id: string
  type: string
  amount: number
  status: 'completed' | 'pending' | 'failed'
  created_at: string
}

interface RecentActivityProps {
  activities?: Activity[]
}

export function RecentActivity({ activities = [] }: RecentActivityProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No recent activity
            </p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(activity.status)}
                  <div>
                    <p className="font-medium capitalize">{activity.type}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(activity.created_at), 'PPp')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    ₦{(activity.amount / 100).toLocaleString()}
                  </p>
                  <p
                    className={`text-xs capitalize ${
                      activity.status === 'completed'
                        ? 'text-green-600'
                        : activity.status === 'failed'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {activity.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 4. `hooks/useDashboardStats.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      // Get partner ID from session or context
      const partnerId = 'your-partner-id' // Replace with actual partner ID

      const [walletsRes, transactionsRes, approvalsRes] = await Promise.all([
        apiClient.get('/wallets', { params: { partner_id: partnerId } }),
        apiClient.get('/disbursements', { params: { partner_id: partnerId } }),
        apiClient.get('/approvals', { params: { partner_id: partnerId, status: 'pending' } }),
      ])

      // Calculate total volume
      const completedTransactions = transactionsRes.data.filter(
        (t: any) => t.status === 'completed'
      )
      const totalVolume = completedTransactions.reduce(
        (sum: number, t: any) => sum + (t.amount || 0),
        0
      )

      return {
        total_wallets: walletsRes.data.length || 0,
        total_disbursements: transactionsRes.data.length || 0,
        pending_approvals: approvalsRes.data.length || 0,
        total_volume: totalVolume,
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
```

### 5. `hooks/usePolicies.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const { data } = await apiClient.get('/policies')
      return data
    },
  })
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: ['policies', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/policies/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreatePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (policy: any) => {
      const { data } = await apiClient.post('/policies', policy)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
    },
  })
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...policy }: { id: string; [key: string]: any }) => {
      const { data } = await apiClient.put(`/policies/${id}`, policy)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
    },
  })
}

export function useDeletePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/policies/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
    },
  })
}
```

### 6. `hooks/useApprovals.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export function useApprovals(status?: string) {
  return useQuery({
    queryKey: ['approvals', status],
    queryFn: async () => {
      const params = status ? { status } : {}
      const { data } = await apiClient.get('/approvals', { params })
      return data
    },
  })
}

export function useApproval(id: string) {
  return useQuery({
    queryKey: ['approvals', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/approvals/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useApproveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data } = await apiClient.post(`/approvals/${id}/approve`, {
        comment,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })
}

export function useRejectRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post(`/approvals/${id}/reject`, {
        reason,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })
}
```

### 7. `lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}
```

### 8. `app/(dashboard)/wallets/page.tsx`

```typescript
'use client'

import { useWallets } from '@/hooks/useWallets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function WalletsPage() {
  const { data: wallets, isLoading } = useWallets()

  if (isLoading) {
    return <div>Loading wallets...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wallets</h1>
          <p className="text-gray-600 mt-1">Manage partner wallets</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Wallet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets?.map((wallet: any) => (
          <Card key={wallet.id}>
            <CardHeader>
              <CardTitle>Wallet {wallet.id.slice(0, 8)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Balance:</span>
                  <span className="font-semibold">
                    {formatCurrency(wallet.balance || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span
                    className={`text-sm ${
                      wallet.is_restricted ? 'text-yellow-600' : 'text-green-600'
                    }`}
                  >
                    {wallet.is_restricted ? 'Restricted' : 'Active'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 9. `app/(dashboard)/policies/page.tsx`

```typescript
'use client'

import { usePolicies } from '@/hooks/usePolicies'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Shield } from 'lucide-react'

export default function PoliciesPage() {
  const { data: policies, isLoading } = usePolicies()

  if (isLoading) {
    return <div>Loading policies...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policies</h1>
          <p className="text-gray-600 mt-1">Manage wallet policies</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies?.map((policy: any) => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>{policy.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{policy.description}</p>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    policy.is_active ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {policy.is_active ? 'Active' : 'Inactive'}
                </span>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 10. `app/(dashboard)/approvals/page.tsx`

```typescript
'use client'

import { useApprovals } from '@/hooks/useApprovals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApproveRequest, useRejectRequest } from '@/hooks/useApprovals'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function ApprovalsPage() {
  const { data: approvals, isLoading } = useApprovals('pending')
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()

  if (isLoading) {
    return <div>Loading approvals...</div>
  }

  const handleApprove = (id: string) => {
    approveMutation.mutate({ id })
  }

  const handleReject = (id: string) => {
    rejectMutation.mutate({ id, reason: 'Rejected via dashboard' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Requests</h1>
        <p className="text-gray-600 mt-1">Review and approve pending requests</p>
      </div>

      <div className="space-y-4">
        {approvals?.map((approval: any) => (
          <Card key={approval.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  {approval.request_type}
                </CardTitle>
                <span className="text-sm text-gray-500">
                  {formatDate(approval.created_at)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {formatCurrency(approval.amount || 0)}
                    </p>
                    <p className="text-sm text-gray-600">{approval.purpose}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(approval.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(approval.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 11. `types/index.ts`

```typescript
// Add your types here
export interface Wallet {
  id: string
  user_id: string
  partner_id?: string
  balance: number
  is_restricted: boolean
  requires_approval: boolean
  created_at: string
  updated_at: string
}

export interface Policy {
  id: string
  partner_id?: string
  name: string
  description?: string
  policy_rules: Record<string, any>
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ApprovalRequest {
  id: string
  workflow_id?: string
  wallet_id: string
  transaction_id?: string
  partner_id: string
  request_type: string
  amount?: number
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  created_at: string
  updated_at: string
}

// Add more types as needed
```

## 📝 Installation Notes

Make sure to install these additional packages:

```bash
npm install clsx tailwind-merge date-fns
```

These components use shadcn/ui components, so make sure you've initialized shadcn/ui and added the required components:

```bash
npx shadcn-ui@latest add button card table input select dialog dropdown-menu
```

---

**All components are ready to use!** 🎉
