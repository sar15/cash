export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            CashFlowIQ is built for secure financial planning. This page explains what information we
            collect, how we use it, and the controls available to you when you use the product.
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Effective date: 8 April 2026
          </p>
        </div>

        <section className="rounded-3xl border border-border bg-card px-6 py-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-base font-semibold">What we collect</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                We collect account information needed to create and secure your workspace, along with
                the financial data you upload or enter into forecasts, scenario plans, reports, and
                compliance workflows.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Why we collect it</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                We use your data to calculate forecasts, generate dashboards and downloadable reports,
                support onboarding and settings preferences, and improve reliability, security, and
                performance of the service.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          {[
            {
              title: '1. Account and authentication data',
              body: 'When you create an account or sign in, we process basic identity details such as your name, email address, and authentication metadata supplied by our sign-in provider. We use this information to secure access to your workspace and to prevent unauthorized use.',
            },
            {
              title: '2. Financial and operational data',
              body: 'Forecast inputs such as uploaded statements, mapped accounts, value rules, timing assumptions, business events, scenarios, and exported configuration files are processed so CashFlowIQ can generate forecast outputs, compliance schedules, and management reports.',
            },
            {
              title: '3. Product analytics and diagnostics',
              body: 'We may collect usage logs, device information, browser details, and error diagnostics needed to monitor uptime, investigate bugs, and protect the service from abuse. We use this information in aggregate where possible.',
            },
            {
              title: '4. How we share information',
              body: 'We do not sell your financial data. We may share information with infrastructure, authentication, storage, and analytics providers that help us operate the service, subject to contractual and security obligations. We may also disclose information if required by law.',
            },
            {
              title: '5. Data retention and security',
              body: 'We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. We use administrative, technical, and physical safeguards designed to protect your data, but no system can guarantee absolute security.',
            },
            {
              title: '6. Your choices',
              body: 'You can update company details, replace uploaded configuration, export your settings, and request account deletion subject to any legal retention requirements. You remain responsible for ensuring that the data you upload is lawful and accurate.',
            },
            {
              title: '7. Contact',
              body: 'If you have questions about privacy, data handling, or security, contact the CashFlowIQ team through your account support channel before sharing any highly sensitive information by email.',
            },
          ].map((section) => (
            <section key={section.title} className="rounded-3xl border border-border bg-card px-6 py-6">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
