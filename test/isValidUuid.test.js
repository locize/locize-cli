import { describe, it, expect } from 'vitest'
import isValidUuid from '../src/isValidUuid.js'

describe('isValidUuid', () => {
  it('should return true for valid UUID v4', () => {
    expect(isValidUuid('cb39e790-cfb3-42b7-aa4a-10f53b0192cf')).toBe(true)
    expect(isValidUuid('ab39e790-cfb3-42b7-aa4a-10f53b0192c2')).toBe(true)
  })

  it('should return false for invalid UUID', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false)
    expect(isValidUuid('123e4567e89b12d3a456426614174000')).toBe(false)
    expect(isValidUuid('550e8400-e29b-11d4-a716-446655440000')).toBe(false) // not v4
  })
})
