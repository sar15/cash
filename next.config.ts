import type { NextConfig } from "next"

// @ts-expect-error next-pwa typing missing
import withPWAInit from "next-pwa"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})

const nextConfig: NextConfig = {
  // Optimize images from external sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  reactStrictMode: true,
}

export default withPWA(nextConfig)
