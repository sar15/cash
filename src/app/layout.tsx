import type { Metadata, Viewport } from "next"
import { Inter, IBM_Plex_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-num",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "CashFlowIQ — Financial Forecasting for Indian SMEs",
  description:
    "Three-way integrated forecasting platform. Upload P&L + Balance Sheet, get a 12-month Projected P&L, Balance Sheet & Cash Flow Statement with GST/TDS compliance.",
  applicationName: "CashFlowIQ",
  keywords: ["financial forecasting", "indian sme", "cash flow", "balance sheet", "P&L"],
  openGraph: {
    title: "CashFlowIQ — Financial Forecasting for Indian SMEs",
    description: "Three-way integrated forecasting platform.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#FCFCFD",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
          <TooltipProvider delay={300}>
            {children}
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
