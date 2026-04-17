# Getting Started with CashFlowIQ

**CashFlowIQ** is a three-way financial forecasting platform for Indian SMEs and Chartered Accountants. Upload your P&L and Balance Sheet → get a 12-month forecast with automatic GST, TDS, and PF/ESI compliance.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env.local
```

**Required variables:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Get from [clerk.com](https://clerk.com)
- `CLERK_SECRET_KEY` - Get from [clerk.com](https://clerk.com)
- `TURSO_DATABASE_URL` - Use `file:local.db` for local dev

### 3. Initialize Database

```bash
npm run db:push
npm run seed  # Optional: Load demo data
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Auth:** Clerk
- **Database:** Turso (libSQL/SQLite)
- **ORM:** Drizzle
- **Storage:** Cloudflare R2
- **Email:** Resend
- **Jobs:** Inngest
- **Styling:** Tailwind CSS v4

---

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/
│   ├── db/          # Database schema & queries
│   ├── engine/      # Forecast engine (pure functions)
│   ├── integrations/# Zoho Books, Tally
│   └── utils/       # Helpers, formatters
└── hooks/           # React hooks
```

---

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # Type checking
npm run lint         # Lint code
npm test             # Run tests
npm run db:studio    # Open database UI
```

---

## Core Concepts

### Monetary Values
All amounts are stored as **integer paise** (₹1 = 100 paise). Never use floating-point for money.

### Periods
Months are stored as `YYYY-MM-01` format. Display labels like "Apr-25" are generated at render time.

### Forecast Engine
The engine is **pure** - no database calls inside `runForecastEngine()`. All data is passed as parameters.

### Company Isolation
Every API route verifies `clerkUserId` ownership before any database operation.

---

## Next Steps

1. **Read the Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. **Deploy to Production:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide
3. **Explore Features:** See [FEATURES.md](./FEATURES.md) for feature documentation

---

## Need Help?

- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Review [.env.example](./.env.example) for all configuration options
- See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for roadmap and future features
