# CashFlowIQ Features

## Current Features

### ✅ Core Forecasting
- **Three-Way Financial Model** - Integrated P&L, Balance Sheet, and Cash Flow forecasting
- **12-Month Rolling Forecast** - Automatic forward projection with configurable rules
- **Scenario Planning** - Base, Best, and Worst case scenarios with custom overrides
- **Value Rules** - Configure forecast methods per account (rolling average, growth %, fixed amount)
- **Timing Profiles** - Model payment terms and collection cycles

### ✅ Data Management
- **Excel Import** - Upload P&L and Balance Sheet from Excel files
- **Demo Data Seeding** - Quick start with sample financial data
- **Account Management** - Full chart of accounts with categorization
- **Historical Actuals** - Import and manage historical financial data

### ✅ Compliance (India-Specific)
- **GST Calculation** - Automatic GST liability computation
- **TDS Tracking** - Track TDS obligations and due dates
- **PF/ESI Calculation** - Employee statutory compliance
- **Compliance Dashboard** - View all obligations in one place

### ✅ Visualization
- **Cash Flow Waterfall Chart** - Visual bridge showing cash movements
- **Forecast Grid** - Interactive table with monthly projections
- **Dashboard Metrics** - Key financial indicators at a glance

### ✅ Security & Performance
- **OAuth Token Encryption** - XChaCha20-Poly1305 encryption for integration tokens
- **Rate Limiting** - Distributed rate limiting with Upstash Redis
- **Forecast Caching** - Cached results for faster page loads
- **Error Monitoring** - Sentry integration for production monitoring

---

## Planned Features

### 🚧 In Progress

#### Scenario Comparison View
Show Base, Best, Worst case side-by-side with delta columns.

**Status:** Design complete, implementation pending

#### Rolling Forecast Lock
Mark months as "locked" actuals to advance the forecast window.

**Status:** Design complete, implementation pending

---

### 📋 Roadmap

#### Phase 1: Enhanced Forecasting (Weeks 1-2)
- **Sensitivity Analysis** - Adjust key assumptions with sliders, see real-time impact
- **Forecast Result Pre-computation** - Background jobs to cache forecasts
- **Actuals vs Forecast Variance** - Compare actual results to forecasts

#### Phase 2: Professional Reporting (Weeks 2-3)
- **PDF Report Generation** - Branded, downloadable financial reports
- **Scheduled Report Delivery** - Email reports on a schedule
- **Multi-Company Dashboard (CA Firm View)** - Portfolio view for CAs managing multiple clients

#### Phase 3: Data Quality (Weeks 3-4)
- **Bank Reconciliation Status** - Track which months are reconciled
- **GST Filing Status Tracker** - Track GSTR-1 and GSTR-3B filing status
- **Audit Trail** - Log all changes with user and timestamp

#### Phase 4: Integrations (Weeks 4-6)
- **Zoho Books Integration** - Auto-sync actuals from Zoho Books
- **Tally Integration** - Pull data from Tally Prime
- **Daily Auto-Sync** - Background jobs to keep actuals fresh

#### Phase 5: Multi-User (Week 6)
- **Team Sharing** - Invite team members to companies
- **Role-Based Access** - Owner, Editor, Viewer roles
- **Notification Feed** - Real-time notifications for compliance and changes

---

## Feature Details

### Cash Flow Waterfall Chart

**What it does:** Visual bridge chart showing opening cash → inflows → outflows → closing cash per month.

**Key capabilities:**
- Green bars for inflows, red for outflows
- Hover tooltips with detailed breakdowns
- Mobile responsive with horizontal scroll
- Negative cash warnings
- Indian number format (lakhs/crores)

**Location:** Dashboard page

---

### Forecast Caching

**What it does:** Saves forecast results to database to avoid recomputing on every page load.

**Key capabilities:**
- Automatic cache invalidation when config changes
- Version tracking to detect stale results
- Debounced saves (500ms) to reduce DB writes
- Falls back to real-time computation if cache is stale

**Performance impact:** 50-80% faster page loads

---

### OAuth Token Encryption

**What it does:** Encrypts Zoho Books and other integration tokens at rest.

**Key capabilities:**
- XChaCha20-Poly1305 authenticated encryption
- Automatic encryption on write, decryption on read
- Graceful degradation if encryption key is missing
- Secure key management via environment variables

**Security:** Prevents token leakage if database is compromised

---

### Rate Limiting

**What it does:** Prevents API abuse with distributed rate limiting.

**Key capabilities:**
- Per-user rate limits on all API routes
- Upstash Redis for distributed state
- In-memory fallback for development
- Configurable limits per endpoint

**Limits:**
- Import upload: 10 requests/hour
- Seed demo: 3 requests/hour
- Other routes: 100 requests/minute

---

## Feature Flags

Some features can be enabled/disabled via environment variables:

```env
# Enable Sentry error monitoring
SENTRY_DSN=your-sentry-dsn

# Enable rate limiting (requires Upstash Redis)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Enable email notifications
RESEND_API_KEY=your-resend-key

# Enable background jobs
INNGEST_EVENT_KEY=your-inngest-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# Enable Zoho Books integration
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ENCRYPTION_KEY=your-64-char-hex-key
```

---

## Usage Examples

### Import Financial Data

1. Navigate to Data → Import
2. Upload Excel file with P&L and Balance Sheet
3. Map columns to accounts
4. Review and save

### Create a Scenario

1. Navigate to Forecast page
2. Click "New Scenario"
3. Name it (e.g., "Best Case")
4. Add overrides (e.g., Revenue +20%)
5. Save and view results

### Configure Compliance

1. Navigate to Settings → Compliance
2. Set GST frequency (monthly/quarterly)
3. Configure TDS rates
4. Set PF/ESI thresholds
5. Save configuration

---

## Performance Benchmarks

| Operation | Before Optimization | After Optimization |
|-----------|--------------------|--------------------|
| Dashboard load | 3.3s | 500-800ms |
| API calls | 1-2s | 100-300ms |
| Forecast computation | 2-3s | 1-1.5s |
| Subsequent loads | 3.3s | Instant (cached) |

**Test environment:** Vercel Edge, Turso (libSQL), 3G connection

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

**Minimum screen width:** 360px (Indian mobile baseline)
