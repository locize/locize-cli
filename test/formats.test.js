import { describe, it, expect } from 'vitest'
import { fileExtensionsMap, acceptedFileExtensions, reversedFileExtensionsMap, gettextContextOf } from '../src/formats.js'

describe('formats', () => {
  it('maps .json to include "json" and reversed maps "json" to .json', () => {
    expect(fileExtensionsMap['.json']).toContain('json')
    expect(reversedFileExtensionsMap['json']).toBe('.json')
  })
  it('acceptedFileExtensions includes .json and .po', () => {
    expect(acceptedFileExtensions).toContain('.json')
    expect(acceptedFileExtensions).toContain('.po')
  })
  it('reversedFileExtensionsMap maps "po" to .po', () => {
    expect(reversedFileExtensionsMap['po']).toBe('.po')
  })

  it('reads the msgctxt out of a gettext key, plural suffix left out', () => {
    expect(gettextContextOf('Open\u0004menu')).toBe('menu')
    expect(gettextContextOf('One item|#|{{count}} items\u0004cart_plural')).toBe('cart')
    expect(gettextContextOf('item\u0004cart_one')).toBe('cart')
    expect(gettextContextOf('Open')).toBe(undefined)
  })
})
