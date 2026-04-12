test will be done after phase 5 build so forget about test of phase 1 to 4 . 
Phase 5: What Each Item Actually Means
5.1 Dashboard Page — Not "more charts"
The current dashboard has hardcoded static charts. It needs to become a decision surface — a page where a business owner opens the app and in 5 seconds knows if they're safe or in trouble.

Specific requirements:TOP ROW: 4 KPI cards (already exist, make them read from engine not constants)
  - Cash on Hand (end of forecast period) — red if negative
  - This Month Net Cash Flow — red if negative
  - Working Capital Gap — red if positive (gap is bad)
  - Gross Margin % — amber if < 20%

MIDDLE ROW: Cash Waterfall chart (already exists, make it use engine data)
  - 12 bars: Opening Cash + Monthly Net CF = Closing Cash
  - Red dashed line: Minimum cash threshold
  - If any month dips below threshold, that bar turns red

BOTTOM ROW: Alert list (NEW)
  - "⚠️ Cash drops below ₹5L in October — before GST payment of ₹8.2L"
  - "⚠️ Receivables exceed ₹50L — collection slowdown detected"
  - "✅ Working capital gap closing — improving trend"
  - Pull alerts from: compliance calendar (GST shortfalls), 
    engine (negative cash months), working capital trends.  5.2 Onboarding Wizard — Not "a form"
A 4-step flow that takes a new user from signup to seeing their forecast. This replaces the empty "Data Import" page for first-time users.

Specific requirements:STEP 1: Company Setup
  - Company name (required)
  - Industry dropdown (Manufacturing, Trading, Services, Startup/SaaS)
  - Financial year start (April, default)
  - "Skip, use demo data" button

STEP 2: Upload Data
  - Drag-and-drop zone for Excel/CSV
  - OR "I'll enter manually later" button
  - File validation happens here (show errors immediately)
  - On success: auto-redirect to Step 3

STEP 3: Account Mapping
  - Show detected accounts in left column
  - Show standard mapping in right column
  - Green check for auto-matched, yellow for fuzzy, red for unmapped
  - User can change mappings via dropdown
  - "Confirm & Continue" button

STEP 4: Generate
  - Loading animation with progress steps
  - "Analyzing trends..." → "Building forecast..." → "Done!"
  - On complete: redirect to /forecast with real data
  - Success message: "Your 12-month forecast is ready". 5.3 PDF Report — Not "print the page"
A proper management report that a CA can put their logo on and send to a client. Borrowed from the Jirav research on report templates.

Specific requirements:REPORT STRUCTURE (3-4 pages):
Page 1: Cover + Executive Summary
  - Company name, report period (e.g., "Forecast: Apr 2025 - Mar 2026")
  - Key metrics: Revenue, Net Profit, Cash on Hand, Working Capital Gap
  - Notes section (manually editable text box for CA commentary)

Page 2: P&L Forecast
  - Full 12-month P&L table
  - Columns: Account Name, Apr, May, ..., Mar, Total
  - Subtotals in bold (Gross Profit, Operating Profit, Net Profit)
  - Values in ₹ Lakhs

Page 3: Balance Sheet + Cash Flow
  - BS table: Key items (Cash, Receivables, Payables, Fixed Assets, Loans, Equity)
  - CF table: Operating CF, Investing CF, Financing CF, Net CF, Closing Cash
  - Both as 12-month tables

Page 4: Compliance + Scenarios (if applicable)
  - Monthly GST/TDS/PF/ESI schedule
  - Scenario comparison summary table (Base vs Pessimistic key metrics)

TECHNICAL APPROACH:
  - Build a hidden HTML div with the report layout
  - Style it with print-friendly CSS (white bg, no sidebar, black text)
  - Use html2canvas + jsPDF to capture and download
  - Company logo from user's settings (if uploaded). 5.4 Export/Import Config — Straightforward  . SETTINGS PAGE addition:
  - "Export Configuration" button → downloads JSON file containing:
    - All value rules
    - All timing profiles
    - All micro-forecasts
    - Compliance config (GST rate, TDS regime, etc.)
    - Quick metrics thresholds
  - "Import Configuration" button → upload JSON → applies to current company
  - Use case: CA configures one manufacturing client, exports, 
    imports for 10 other similar clients → saves hours. 5.5 Landing Page — Not "a beautiful marketing site"
A single page that answers: "What is this, who is it for, and why should I sign up?" Nothing more.

Specific requirements:HERO SECTION:
  - Headline: "Stop Guessing Your Cash Flow"
  - Subheadline: "3-statement integrated forecasting for Indian businesses"
  - CTA button: "Start Free Forecast" → links to signup
  - Below CTA: "No credit card. Upload your Excel. See your forecast in 2 minutes."

FEATURES SECTION (3 cards, no more):
  - Card 1: "Three-Way Forecast" — P&L, Balance Sheet, Cash Flow that always balance
  - Card 2: "Event-Based Planning" — Model hires, purchases, loans, new clients
  - Card 3: "Compliance Aware" — GST, TDS, Advance Tax due dates with cash impact

FOR WHOM SECTION (3 icons with 1 line each):
  - "SME Owners" — Know if you can pay next month's bills
  - "Startup Founders" — Track runway and plan fundraising
  - "Chartered Accountants" — Deliver advisory reports in minutes

FOOTER:
  - "Built for Indian businesses" 
  - Privacy policy link (can be placeholder). Final Polish — Specific checklist, not vague. EMPTY STATES:
  - /forecast with no data: "Upload your financial data to see your forecast" + button to import
  - /compliance with no data: "Complete your forecast setup first" + link
  - /scenarios with no data: "Create your first scenario" + button

ERROR STATES:
  - Upload fails: "Failed to parse file. Please ensure it's a valid .xlsx or .csv"
  - Engine fails: "Forecast could not be generated. Check your data for errors."
  - API fails: Generic "Something went wrong. Please try again."

LOADING STATES:
  - Forecast grid: Skeleton rows while engine computes
  - Compliance page: Skeleton cards while calculating
  - Scenario comparison: Skeleton chart

RESPONSIVE:
  - Forecast grid: Horizontal scroll on mobile (don't try to make it responsive — tables don't work on small screens)
  - Dashboard: Stack KPI cards vertically on mobile
  - Sidebar: Collapsible on mobile (hamburger menu)
  - Landing page: Full responsive

ACCESSIBILITY (quick wins only):
  - All interactive elements are keyboard-focusable
  - Color is not the only indicator (add icons to red/green states)
  - Images have alt text (landing page)

NUMBER FORMATTING AUDIT:
  - Search entire codebase for any displayed number NOT using formatLakhs()
  - Every user-visible number must go through the formatter
  - Zero instances of raw paise values leaking to UI.  DAY 1-2: Dashboard (5.1)
  Why first: It's the first thing users see after login.
  Makes the product feel complete even if other pages are rough.

DAY 3-4: Onboarding Wizard (5.2)
  Why second: Without this, new users can't get data into the app.
  This unblocks real-user testing.

DAY 5-6: PDF Report (5.3)
  Why third: This is what CAs will pay for.
  The report format also forces you to organize the data cleanly.

DAY 7: Export/Import Config (5.4)
  Quick win. Half a day.

DAY 8: Landing Page (5.5)
  Pure HTML/CSS. No backend needed. Half a day.

DAY 9-10: Final Polish (5.6)
  Go through the specific checklist above. Fix what you find.