# Planmoni Dashboard - New Repository Setup Guide

## 📋 Overview

This guide will help you set up a new Next.js repository for the Planmoni Partner Dashboard (web application).

## 🎯 Project Structure

```
planmoni-dashboard/
├── .env.local                    # Environment variables
├── .gitignore
├── next.config.js               # Next.js configuration
├── package.json
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── README.md
├── app/
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing/login page
│   ├── (dashboard)/             # Dashboard routes (protected)
│   │   ├── layout.tsx           # Dashboard layout with sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── wallets/
│   │   ├── policies/
│   │   ├── approvals/
│   │   ├── settings/
│   │   └── analytics/
│   └── api/                     # API proxy routes (optional)
│       └── proxy/
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── dashboard/               # Dashboard-specific components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── StatsCard.tsx
│   │   └── DataTable.tsx
│   └── layout/
├── lib/
│   ├── api-client.ts            # API client for Planmoni API
│   ├── auth.ts                  # Authentication utilities
│   ├── utils.ts                 # Utility functions
│   └── supabase.ts              # Supabase client (if needed)
├── hooks/
│   ├── useAuth.ts
│   ├── useWallets.ts
│   ├── usePolicies.ts
│   └── useApprovals.ts
└── types/
    └── index.ts                 # TypeScript types
```

## 🚀 Setup Steps

### 1. Create New Repository

```bash
# Create new directory
mkdir planmoni-dashboard
cd planmoni-dashboard

# Initialize git
git init
git branch -M main

# Create initial structure
mkdir -p app components lib hooks types
```

### 2. Initialize Next.js Project

```bash
# Using create-next-app (recommended)
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# Or manually install dependencies
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/react @types/node tailwindcss postcss autoprefixer
```

### 3. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js @tanstack/react-query axios
npm install date-fns recharts lucide-react

# UI components (shadcn/ui)
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card table input select dialog dropdown-menu

# Authentication
npm install next-auth @auth/supabase-adapter

# Form handling
npm install react-hook-form @hookform/resolvers zod
```

### 4. Configure Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Planmoni API (if separate)
NEXT_PUBLIC_API_URL=http://localhost:3000
# Or production API
# NEXT_PUBLIC_API_URL=https://api.planmoni.com

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### 5. Configure Next.js

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['your-image-domain.com'],
  },
  // API proxy if needed
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

### 6. Set Up Tailwind CSS

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Add your brand colors
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 7. Create Initial Files

See the file templates below for:
- `app/layout.tsx` - Root layout
- `app/(dashboard)/layout.tsx` - Dashboard layout
- `lib/api-client.ts` - API client
- `components/dashboard/Sidebar.tsx` - Navigation sidebar

## 🔗 Integration with Main App

### Option A: Direct API Access
- Dashboard calls API endpoints directly from `app-1/app/api/v1/`
- Use environment variable for API URL
- Requires CORS configuration on main app

### Option B: API Proxy
- Dashboard has proxy routes in `app/api/proxy/`
- Forwards requests to main app API
- Useful for handling authentication

### Option C: Shared Supabase Client
- Both apps use same Supabase instance
- Dashboard queries database directly (with RLS)
- Faster but less abstraction

## 📦 Recommended Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React
- **Authentication**: NextAuth.js or Supabase Auth
- **API Client**: Axios or fetch

## 🎨 UI Components

Use shadcn/ui for consistent, accessible components:
- Buttons, Cards, Tables
- Forms (Input, Select, Textarea)
- Dialogs, Dropdowns, Menus
- Data tables with sorting/filtering

## 🔐 Authentication

### Option 1: NextAuth.js
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { SupabaseAdapter } from '@auth/supabase-adapter'

export const authOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  // ... other options
}
```

### Option 2: Supabase Auth Direct
```typescript
// Use Supabase client directly
import { createClient } from '@supabase/supabase-js'
```

## 📝 Next Steps

1. **Create Repository**: Initialize git and push to GitHub/GitLab
2. **Set Up CI/CD**: GitHub Actions for deployment
3. **Configure Domain**: Set up custom domain
4. **Add Analytics**: Integrate analytics (optional)
5. **Set Up Monitoring**: Error tracking (Sentry, etc.)

## 🔄 Development Workflow

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📚 Documentation

- Next.js Docs: https://nextjs.org/docs
- shadcn/ui: https://ui.shadcn.com
- TanStack Query: https://tanstack.com/query
- Supabase: https://supabase.com/docs

## 🆘 Support

For questions or issues:
- Check main app API documentation
- Review Supabase RLS policies
- Verify environment variables

---

**Ready to start?** Use the file templates in the next section to bootstrap your project!
