#!/bin/bash
export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin

add_env() {
  vercel env rm $1 production -y || true
  echo "$2" | vercel env add $1 production
}

add_env "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "<set-in-vercel-dashboard>"
add_env "CLERK_SECRET_KEY" "<set-in-vercel-dashboard>"
add_env "NEXT_PUBLIC_CLERK_SIGN_IN_URL" "/sign-in"
add_env "NEXT_PUBLIC_CLERK_SIGN_UP_URL" "/sign-up"
add_env "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL" "/dashboard"
add_env "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL" "/dashboard"
add_env "TURSO_DATABASE_URL" "<set-in-vercel-dashboard>"
add_env "TURSO_AUTH_TOKEN" "<set-in-vercel-dashboard>"
add_env "RESEND_API_KEY" "<set-in-vercel-dashboard>"
add_env "RESEND_FROM_EMAIL" "onboarding@resend.dev"
add_env "ENCRYPTION_KEY" "<generate-with-openssl-rand-hex-32>"
