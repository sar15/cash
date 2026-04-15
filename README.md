# CashFlowIQ

Three-way financial forecasting platform for Indian SMEs and Chartered Accountants.

Upload your P&L and Balance Sheet → get a 12-month P&L, Balance Sheet, and Cash Flow forecast with automatic GST, TDS, and PF/ESI compliance.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: Clerk
- **Database**: Turso (libSQL/SQLite)
- **ORM**: Drizzle
- **File Storage**: Cloudflare R2
- **Email**: Resend
- **Background Jobs**: Inngest
- **Styling**: Tailwind CSS v4

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/cashflowiq
cd cashflowiq
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in at minimum:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from [clerk.com](https://clerk.com)
- `TURSO_DATABASE_URL` — leave as `file:local.db` for local dev

### 3. Set up the database

```bash
# Push schema to local SQLite
npm run db:push

# (Optional) Seed with demo data
npm run seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production Deployment (Vercel)

### 1. Create a Turso database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create cashflowiq-prod

# Get connection URL and token
turso db show cashflowiq-prod --url
turso db tokens create cashflowiq-prod
```

### 2. Create a Cloudflare R2 bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create bucket: `cashflowiq-uploads`
3. Create API token with R2 read/write permissions
4. Note your Account ID, Access Key ID, and Secret Access Key

### 3. Set up Resend (email)

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain
3. Create an API key
4. Update `RESEND_FROM_EMAIL` to use your verified domain

### 4. Set up Inngest (background jobs)

1. Sign up at [inngest.com](https://app.inngest.com)
2. Create an app
3. Get your Event Key and Signing Key
4. Add your production URL as a webhook endpoint: `https://your-domain.com/api/inngest`

### 5. Set up Clerk webhooks (welcome emails)

1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to `user.created` event
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

### 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add all environment variables from `.env.example` to your Vercel project settings.

### 7. Run migrations in production

After first deploy, run migrations:

```bash
# Using Vercel CLI
vercel env pull .env.production
TURSO_DATABASE_URL=your-prod-url TURSO_AUTH_TOKEN=your-token npm run db:migrate
```

---

## Database Commands

```bash
npm run db:push      # Push schema changes to database (dev)
npm run db:generate  # Generate new migration file
npm run db:migrate   # Run pending migrations (production)
npm run db:studio    # Open Drizzle Studio (visual DB browser)
npm run seed         # Seed database with demo data
```

---

## Environment Variables

See `.env.example` for all required and optional variables with descriptions.

**Required for production:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

**Optional (features degrade gracefully without them):**
- `R2_*` — file uploads fall back to local disk in dev
- `RESEND_API_KEY` — emails silently skipped
- `INNGEST_*` — background jobs won't run
- `CLERK_WEBHOOK_SECRET` — welcome emails won't send

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete file map, data flow, and backend roadmap.

---

## Key Invariants

1. All monetary values are **integer paise** (₹1 = 100 paise). Never store rupees.
2. Period format is always **`YYYY-MM-01`**. Month labels (`Apr-25`) are display-only.
3. The engine is **pure** — no DB calls inside `runForecastEngine()`.
4. Every API route checks **company ownership** before any DB write.
5. Balance sheet must balance: `totalAssets === totalLiabilities + totalEquity`.
