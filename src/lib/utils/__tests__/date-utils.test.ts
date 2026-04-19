import { describe, it, expect } from 'vitest'
import { generatePeriodKey } from '../date-utils'

describe('generatePeriodKey', () => {
  it('generates correct period key for April FY start', () => {
    // April 2025 - March 2026 → FY25-26
    expect(generatePeriodKey(4, 2025)).toBe('FY25-26')
  })

  it('generates correct period key for January FY start', () => {
    // January 2025 - December 2025 → FY25-26
    expect(generatePeriodKey(1, 2025)).toBe('FY25-26')
  })

  it('handles year boundary correctly (2099-2100)', () => {
    // April 2099 - March 2100 → FY99-00
    expect(generatePeriodKey(4, 2099)).toBe('FY99-00')
  })

  it('pads single-digit years with zero', () => {
    // April 2005 - March 2006 → FY05-06
    expect(generatePeriodKey(4, 2005)).toBe('FY05-06')
  })

  it('handles year 2000 correctly', () => {
    // April 2000 - March 2001 → FY00-01
    expect(generatePeriodKey(4, 2000)).toBe('FY00-01')
  })

  it('handles year 2009 correctly', () => {
    // April 2009 - March 2010 → FY09-10
    expect(generatePeriodKey(4, 2009)).toBe('FY09-10')
  })

  it('handles different FY start months correctly', () => {
    // July 2024 - June 2025 → FY24-25
    expect(generatePeriodKey(7, 2024)).toBe('FY24-25')
    
    // October 2023 - September 2024 → FY23-24
    expect(generatePeriodKey(10, 2023)).toBe('FY23-24')
  })

  it('throws error for invalid month (< 1)', () => {
    expect(() => generatePeriodKey(0, 2025)).toThrow('Invalid fyStartMonth: 0')
  })

  it('throws error for invalid month (> 12)', () => {
    expect(() => generatePeriodKey(13, 2025)).toThrow('Invalid fyStartMonth: 13')
  })

  it('throws error for invalid year (too old)', () => {
    expect(() => generatePeriodKey(4, 1899)).toThrow('Invalid currentYear: 1899')
  })

  it('throws error for invalid year (too far in future)', () => {
    expect(() => generatePeriodKey(4, 2201)).toThrow('Invalid currentYear: 2201')
  })

  it('throws error for non-integer year', () => {
    expect(() => generatePeriodKey(4, 2025.5)).toThrow('Invalid currentYear: 2025.5')
  })

  it('is deterministic - same inputs produce same output', () => {
    const result1 = generatePeriodKey(4, 2025)
    const result2 = generatePeriodKey(4, 2025)
    const result3 = generatePeriodKey(4, 2025)
    
    expect(result1).toBe(result2)
    expect(result2).toBe(result3)
    expect(result1).toBe('FY25-26')
  })

  it('produces unique keys for consecutive years', () => {
    const fy2023 = generatePeriodKey(4, 2023)
    const fy2024 = generatePeriodKey(4, 2024)
    const fy2025 = generatePeriodKey(4, 2025)
    
    expect(fy2023).toBe('FY23-24')
    expect(fy2024).toBe('FY24-25')
    expect(fy2025).toBe('FY25-26')
    
    // All should be unique
    expect(fy2023).not.toBe(fy2024)
    expect(fy2024).not.toBe(fy2025)
    expect(fy2023).not.toBe(fy2025)
  })
})
