import { describe, it, expect } from 'vitest'
import filterNamespaces from '../src/filterNamespaces.js'

describe('filterNamespaces', () => {
  const nss = [
    { namespace: 'ns1' },
    { namespace: 'ns2' },
    { namespace: 'ns3' }
  ]
  it('filters by opt.namespace', () => {
    const result = filterNamespaces({ namespace: 'ns2' }, nss)
    expect(result).toEqual([{ namespace: 'ns2' }])
  })
  it('filters by opt.namespaces', () => {
    const result = filterNamespaces({ namespaces: ['ns1', 'ns3'] }, nss)
    expect(result).toEqual([{ namespace: 'ns1' }, { namespace: 'ns3' }])
  })
  it('returns all if no filter', () => {
    const result = filterNamespaces({}, nss)
    expect(result).toEqual(nss)
  })
})
