type Compute<T> = () => T

export class SimpleLruCache<T> {
  private map = new Map<string, T>()
  constructor(private readonly maxSize = 25) {}

  get(key: string): T | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // refresh recency
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: T) {
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as string | undefined
      if (oldest) this.map.delete(oldest)
    }
  }

  getOrCompute(key: string, compute: Compute<T>): T {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    const value = compute()
    this.set(key, value)
    return value
  }
}

import type { EngineResult } from '@/lib/engine'

export const scenarioEngineCache = new SimpleLruCache<EngineResult>(20)
