# CashFlowIQ

**Three-way financial forecasting for Indian SMEs and Chartered Accountants.**

Upload your P&L and Balance Sheet → get a 12-month forecast with automatic GST, TDS, and PF/ESI compliance.

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Initialize database
npm run db:push
npm run seed  # Optional: Load demo data

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Documentation

- **[Getting Started](./GETTING_STARTED.md)** - Setup and first steps
- **[Features](./FEATURES.md)** - Current and planned features
- **[Architecture](./ARCHITECTURE.md)** - System design and data flow
- **[Deployment](./DEPLOYMENT.md)** - Production deployment guide
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[Backend Plan](./BACKEND_PLAN.md)** - Roadmap and future features

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

## Core Principles

1. **Integer Paise** - All monetary values are integer paise (₹1 = 100 paise)
2. **Pure Engine** - Forecast engine has no side effects or DB calls
3. **Period Format** - Months are always `YYYY-MM-01`
4. **Company Isolation** - Every API route verifies ownership
5. **Balance Sheet Invariant** - Assets = Liabilities + Equity

---

## Production Status

✅ **Production Ready** (95% complete)

- ✅ Core forecasting engine
- ✅ Three-way financial model
- ✅ Indian compliance (GST, TDS, PF/ESI)
- ✅ OAuth token encryption
- ✅ Rate limiting
- ✅ Error monitoring
- ✅ Performance optimized

See [FEATURES.md](./FEATURES.md) for detailed feature list and roadmap.
