import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow `any` in route handler context params — Next.js 16 requires
  // `params: Promise<any>` for the validator to accept route handlers.
  {
    files: ['src/app/api/**/route.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated PWA bundles are emitted into public/ during production builds.
    "public/sw*.js",
    "public/sw*.js.map",
    "public/workbox-*.js",
    "public/workbox-*.js.map",
  ]),
]);

export default eslintConfig;
