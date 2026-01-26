# Dashboard Repository - File Templates

Use these templates to bootstrap your new Next.js dashboard repository.

## 📁 File Structure Templates

### 1. `package.json`

```json
{
  "name": "planmoni-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.50.0",
    "@tanstack/react-query": "^5.90.17",
    "axios": "^1.13.2",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "recharts": "^2.10.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    "next-auth": "^4.24.0",
    "@auth/supabase-adapter": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.55.0",
    "eslint-config-next": "14.0.0"
  }
}
```

### 2. `app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Planmoni Partner Dashboard',
  description: 'Manage your Planmoni integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### 3. `app/providers.tsx`

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  )
}
```

### 4. `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 5. `lib/api-client.ts`

```typescript
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add API key
apiClient.interceptors.request.use((config) => {
  // Get API key from session or storage
  const apiKey = typeof window !== 'undefined' 
    ? localStorage.getItem('planmoni_api_key') 
    : null

  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }

  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
```

### 6. `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

### 7. `app/(dashboard)/layout.tsx`

```typescript
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 8. `app/(dashboard)/page.tsx`

```typescript
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { useDashboardStats } from '@/hooks/useDashboardStats'

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back!</p>
      </div>

      <StatsGrid stats={stats} />
      <RecentActivity />
    </div>
  )
}
```

### 9. `components/dashboard/Sidebar.tsx`

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Wallet, 
  Shield, 
  CheckCircle, 
  Settings,
  BarChart3 
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Wallets', href: '/wallets', icon: Wallet },
  { name: 'Policies', href: '/policies', icon: Shield },
  { name: 'Approvals', href: '/approvals', icon: CheckCircle },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold">Planmoni</h2>
        <p className="text-sm text-gray-600">Partner Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

### 10. `hooks/useWallets.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data } = await apiClient.get('/wallets')
      return data
    },
  })
}

export function useWallet(id: string) {
  return useQuery({
    queryKey: ['wallets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/wallets/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateWallet() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (wallet: any) => {
      const { data } = await apiClient.post('/wallets', wallet)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })
}
```

### 11. `.gitignore`

```
# Dependencies
node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

### 12. `README.md` (for new repo)

```markdown
# Planmoni Partner Dashboard

Web-based dashboard for Planmoni partners to manage their integration.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env.local
   # Edit .env.local with your values
   \`\`\`

3. Run development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3001](http://localhost:3001)

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Supabase

## Project Structure

- \`app/\` - Next.js app router pages
- \`components/\` - React components
- \`lib/\` - Utilities and API client
- \`hooks/\` - Custom React hooks
- \`types/\` - TypeScript types

## Documentation

See the main Planmoni repository for API documentation.
```

## 🚀 Quick Start Commands

```bash
# 1. Create new directory
mkdir planmoni-dashboard && cd planmoni-dashboard

# 2. Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --app

# 3. Install additional dependencies
npm install @supabase/supabase-js @tanstack/react-query axios date-fns lucide-react recharts

# 4. Set up shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card table input

# 5. Copy template files
# (Copy the files from this document)

# 6. Set up environment
cp .env.example .env.local
# Edit .env.local

# 7. Start development
npm run dev
```

## 📝 Notes

- Update API URLs in `lib/api-client.ts`
- Configure authentication based on your setup
- Add your Supabase types to `types/supabase.ts`
- Customize colors in `tailwind.config.js`
- Add more components as needed

---

**Ready to build!** 🚀
