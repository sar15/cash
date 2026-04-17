// Vitest setup file — provisions test environment variables
process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes of 0xaa — deterministic test key
