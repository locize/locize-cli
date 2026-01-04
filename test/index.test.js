import { describe, it, expect } from 'vitest'
import * as index from '../src/index.js'

describe('index', () => {
  const expectedExports = [
    'add',
    'copyVersion',
    'createBranch',
    'deleteBranch',
    'deleteNamespace',
    'download',
    'format',
    'get',
    'getBranches',
    'getJob',
    'mergeBranch',
    'migrate',
    'missing',
    'publishVersion',
    'removeVersion',
    'sync'
  ]
  it('should export all expected functions', () => {
    for (const key of expectedExports) {
      expect(typeof index[key]).toBe('function')
    }
  })
})
