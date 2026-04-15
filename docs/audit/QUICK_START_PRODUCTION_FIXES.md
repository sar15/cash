# Quick Start Guide — Production Readiness Sprint

**For:** Development Team  
**Goal:** Get from 72% → 95% production ready in 4 weeks  
**Start Date:** April 14, 2026

---

## 🚀 Getting Started (5 minutes)

### 1. Read These Documents (in order)
1. **AUDIT_SUMMARY_NEXT_STEPS.md** — Executive summary (10 min read)
2. **COMPREHENSIVE_AUDIT_REPORT.md** — Detailed findings (30 min read)
3. **EXECUTION_PLAN_AGENTS.md** — Task breakdown (20 min read)
4. **This file** — Quick start guide (5 min read)

### 2. Verify Your Environment
```bash
# Clone and install
git pull origin main
npm install

# Check environment
cp .env.example .env.local
# Fill in your Clerk keys (required)

# Run dev server
npm run dev

# Open http://localhost:3000
# You should see the login page
```

### 3. Verify Fix #1 is Working
```bash
# In browser DevTools console:
localStorage.clear()  # Clear any cached data

# Navigate to /dashboard
# Open Network tab
# Change a forecast value (e.g., edit a value rule)
# Look for POST to /api/forecast/result/[companyId]
# Should return 201 Created

# Reload page
# Forecast should load instantly (from cache)
```

---

## 📋 Week 1 Sprint Plan (40 hours)

### Monday (Today) — ✅ COMPLETE
- [x] Comprehensive audit completed
- [x] Fix #1 applied (forecast caching)
- [x] Documentation created

### Tuesday — Security Day (8 hours)

#### Task 1: OAuth Token Encryption (4 hours)
**Assigned To:** Backend Developer  
**Priority:** CRITICAL

**Steps:**
1. Create `src/lib/utils/crypto.ts`:
```typescript
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

export function encryptToken(plaintext: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set')
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const nonce = crypto.getRandomValues(new Uint8Array(24))
  const cipher = xchacha20poly1305(key, nonce)
  const encrypted = cipher.encrypt(utf8ToBytes(plaintext))
  return Buffer.concat([nonce, encrypted]).toString('base64')
}

export function decryptToken(ciphertext: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set')
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const buffer = Buffer.from(ciphertext, 'base64')
  const nonce = buffer.slice(0, 24)
  const encrypted = buffer.slice(24)
  const cipher = xchacha20poly1305(key, nonce)
  return bytesToUtf8(cipher.decrypt(encrypted))
}
```

2. Update `src/lib/integrations/zoho-books/client.ts`:
```typescript
import { encryptToken, decryptToken } from '@/lib/utils/crypto'

// When saving tokens:
await db.insert(integrations).values({
  accessToken: encryptToken(tokens.access_token),
  refreshToken: encryptToken(tokens.refresh_token),
  // ...
})

// When reading tokens:
const integration = await db.query.integrations.findFirst(...)
const accessToken = decryptToken(integration.accessToken)
```

3. Generate encryption key:
```bash
openssl rand -hex 32
# Add to .env.local:
ENCRYPTION_KEY=your-generated-key-here
```

4. Test:
```bash
# Create test script: tests/crypto.test.ts
import { encryptToken, decryptToken } from '@/lib/utils/crypto'

const original = 'test-token-12345'
const encrypted = encryptToken(original)
const decrypted = decryptToken(encrypted)

console.assert(decrypted === original, 'Round-trip failed')
console.assert(encrypted !== original, 'Not encrypted')
console.log('✅ Encryption working')
```

**Acceptance Criteria:**
- [ ] `encryptToken()` and `decryptToken()` functions work
- [ ] Round-trip test passes
- [ ] Zoho integration still works after encryption
- [ ] No plaintext tokens in database

---

#### Task 2: Distributed Rate Limiting (3 hours)
**Assigned To:** Backend Developer  
**Priority:** HIGH

**Steps:**
1. Create Upstash Redis database:
   - Go to https://console.upstash.com
   - Create database → REST API
   - Copy REST URL and token

2. Add to `.env.local`:
```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

3. Create `src/lib/rate-limit.ts`:
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
    })
  : null

// Fallback in-memory limiter
const memoryLimiter = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (ratelimit) {
    const result = await ratelimit.limit(identifier)
    return { success: result.success }
  }

  // Fallback to in-memory
  const now = Date.now()
  const entry = memoryLimiter.get(identifier)
  
  if (!entry || entry.resetAt < now) {
    memoryLimiter.set(identifier, { count: 1, resetAt: now + 60000 })
    return { success: true }
  }

  if (entry.count >= 100) {
    return { success: false }
  }

  entry.count++
  return { success: true }
}
```

4. Update `src/middleware.ts`:
```typescript
import { checkRateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const userId = auth().userId
  if (!userId) return NextResponse.next()

  const { success } = await checkRateLimit(userId)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  return NextResponse.next()
}
```

**Acceptance Criteria:**
- [ ] Rate limits work across multiple Vercel instances
- [ ] Fallback to in-memory when Upstash unavailable
- [ ] No performance degradation (<50ms overhead)

---

#### Task 3: Environment Setup (1 hour)
**Assigned To:** DevOps Engineer  
**Priority:** HIGH

**Steps:**
1. Update `.env.example` with all required variables
2. Create setup guide in `docs/ENVIRONMENT_SETUP.md`
3. Test fresh clone + setup on clean machine

---

### Wednesday — Monitoring & Quick Fixes (6 hours)

#### Task 4: Sentry Error Monitoring (3 hours)
**Assigned To:** Backend Developer  
**Priority:** HIGH

**Steps:**
1. Create Sentry project:
   - Go to https://sentry.io
   - Create project → Next.js
   - Copy DSN

2. Install Sentry wizard:
```bash
npx @sentry/wizard@latest -i nextjs
```

3. Configure error boundaries:
```typescript
// src/components/shared/ErrorBoundary.tsx
import * as Sentry from '@sentry/nextjs'

export class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { contexts: { react: errorInfo } })
  }
  // ...
}
```

4. Test error capture:
```typescript
// Trigger test error
throw new Error('Test Sentry integration')
// Check Sentry dashboard for event
```

**Acceptance Criteria:**
- [ ] Unhandled errors captured in Sentry
- [ ] Source maps uploaded
- [ ] No PII in error reports

---

#### Task 5: Timing Profile Duplicates Fix (30 min)
**Assigned To:** Backend Developer  
**Priority:** MEDIUM

**File:** `src/lib/db/queries/timing-profiles.ts`

**Change:**
```typescript
// BEFORE
export async function upsertTimingProfile(companyId: string, data: any) {
  return await db.insert(timingProfiles).values({ companyId, ...data })
}

// AFTER
export async function upsertTimingProfile(companyId: string, data: any) {
  return await db
    .insert(timingProfiles)
    .values({ companyId, ...data })
    .onConflictDoUpdate({
      target: [timingProfiles.companyId, timingProfiles.name],
      set: {
        profileType: data.profileType,
        config: data.config,
        autoDerived: data.autoDerived,
        isDefault: data.isDefault,
      },
    })
}
```

**Test:**
```typescript
// Call twice with same name
await upsertTimingProfile('company-1', { name: 'Test', profileType: 'ar', config: '{}' })
await upsertTimingProfile('company-1', { name: 'Test', profileType: 'ap', config: '{}' })

// Verify only 1 row exists
const profiles = await db.query.timingProfiles.findMany({
  where: eq(timingProfiles.companyId, 'company-1')
})
console.assert(profiles.length === 1, 'Duplicate created!')
```

---

### Thursday-Friday — Indian Market Optimization (10 hours)

#### Task 6: Offline-First + Retry Logic (8 hours)
**Assigned To:** Frontend Developer  
**Priority:** HIGH

**Steps:**
1. Update `src/lib/api/client.ts`:
```typescript
async function fetchWithRetry(url: string, options: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
      if (response.status >= 500 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
        continue
      }
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
}

export async function apiPost(url: string, data: any) {
  return fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
```

2. Add network status indicator:
```typescript
// src/components/shared/NetworkStatus.tsx
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded">
      ⚠️ You're offline. Changes will sync when reconnected.
    </div>
  )
}
```

3. Test on 3G:
```bash
# Chrome DevTools → Network → Throttling → Slow 3G
# Verify:
# - Failed requests retry automatically
# - Network status indicator appears when offline
# - Cached data loads offline
```

---

#### Task 7: Load Testing (2 hours)
**Assigned To:** QA Engineer  
**Priority:** MEDIUM

**Steps:**
1. Install Artillery:
```bash
npm install -g artillery
```

2. Create `tests/load/artillery-config.yml`:
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 50
      name: Sustained load
scenarios:
  - name: Forecast computation
    flow:
      - post:
          url: '/api/forecast/result/{{ companyId }}'
          json:
            scenarioId: null
            plData: {}
            bsData: {}
            cfData: {}
            compliance: {}
            metrics: {}
```

3. Run test:
```bash
artillery run tests/load/artillery-config.yml
```

4. Verify:
   - p95 latency <2s
   - No 500 errors
   - No database deadlocks

---

## 🎯 Week 1 Success Criteria

By end of Week 1, you should have:
- [x] Fix #1: Forecast caching working ✅
- [ ] Fix #2: OAuth tokens encrypted
- [ ] Fix #3: Rate limiting distributed
- [ ] Fix #4: Sentry monitoring live
- [ ] Fix #5: Timing profile duplicates fixed
- [ ] Offline-first + retry logic working
- [ ] Load test passing

**Production Readiness:** 72% → 85% (+13%)

---

## 🆘 Getting Help

### Blockers
If stuck >2 hours:
1. Document in `BLOCKERS.md`
2. Post in team Slack channel
3. Tag @tech-lead

### Questions
- **Architecture:** Check `ARCHITECTURE.md`
- **API Docs:** Check `BACKEND_PLAN.md`
- **Audit Details:** Check `COMPREHENSIVE_AUDIT_REPORT.md`

### Emergency
If production-blocking issue:
1. Stop all feature work
2. All hands on critical fix
3. Deploy hotfix ASAP

---

## 📊 Daily Standup Template

Post in Slack every morning:

```
**Yesterday:**
- ✅ Completed: [task name]
- 🚧 In Progress: [task name]

**Today:**
- 🎯 Goal: [task name]
- ⏱️ Estimated: [hours]

**Blockers:**
- 🚫 [blocker description] OR "None"

**Metrics:**
- Test Coverage: [%]
- Production Readiness: [%]
```

---

## ✅ Checklist Before Starting

- [ ] Read all 4 audit documents
- [ ] Environment set up and working
- [ ] Dev server running
- [ ] Fix #1 verified working
- [ ] Understand Week 1 goals
- [ ] Know who to ask for help

---

**Ready to start? Begin with Task 1 (OAuth Encryption) tomorrow morning!**

**Questions?** Check the audit documents or ask in Slack.

**Good luck! 🚀**
