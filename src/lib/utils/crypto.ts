/**
 * Encryption utilities for sensitive data (OAuth tokens, API keys)
 * Uses XChaCha20-Poly1305 authenticated encryption from @noble/ciphers
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/ciphers/webcrypto'
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils'

/**
 * Encrypt a plaintext string using XChaCha20-Poly1305
 * Returns base64-encoded ciphertext with nonce prepended
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const nonce = randomBytes(24) // XChaCha20 uses 24-byte nonce
  const cipher = xchacha20poly1305(key, nonce)
  const encrypted = cipher.encrypt(utf8ToBytes(plaintext))
  
  // Prepend nonce to ciphertext for storage
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce, 0)
  combined.set(encrypted, nonce.length)
  
  return Buffer.from(combined).toString('base64')
}

/**
 * Decrypt a base64-encoded ciphertext
 * Expects nonce to be prepended to ciphertext
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(ciphertext, 'base64')
  
  // Extract nonce and ciphertext
  const nonce = combined.slice(0, 24)
  const encrypted = combined.slice(24)
  
  const cipher = xchacha20poly1305(key, nonce)
  const decrypted = cipher.decrypt(encrypted)
  
  return bytesToUtf8(decrypted)
}

/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Uint8Array {
  const keyHex = process.env.ENCRYPTION_KEY
  
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable not set. Generate with: openssl rand -hex 32'
    )
  }
  
  if (keyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (64 hex characters), got ${keyHex.length} characters`
    )
  }
  
  return Buffer.from(keyHex, 'hex')
}

/**
 * Test encryption/decryption round-trip
 * Throws if encryption is not working correctly
 */
export function testEncryption(): void {
  const testData = 'test-token-' + Date.now()
  const encrypted = encryptToken(testData)
  const decrypted = decryptToken(encrypted)
  
  if (decrypted !== testData) {
    throw new Error('Encryption round-trip failed')
  }
  
  if (encrypted === testData) {
    throw new Error('Data was not encrypted')
  }
}
