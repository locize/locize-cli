import { describe, it, expect } from 'vitest'
import { fileExtensionsMap, acceptedFileExtensions, reversedFileExtensionsMap } from '../src/formats.js'

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
})
