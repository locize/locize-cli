import { describe, it, expect } from 'vitest'
import lngs from '../src/lngs.js'

describe('lngs', () => {
  it('should include "en" as a language code', () => {
    expect(lngs).toContain('en')
  })
})
