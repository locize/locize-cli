import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveGitCompareRef, getChangedKeysByNamespace, filterComparedToChangedKeys } from '../src/gitChangedKeys.js'

// isolate from the developer's global git config (signing, hooks, defaultBranch)
const git = (args, cwd) => execFileSync('git', args, {
  cwd,
  stdio: 'ignore',
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
})
const commit = (cwd, message) => git(['-c', 'user.name=test', '-c', 'user.email=test@test.tld', 'commit', '-m', message], cwd)

describe('gitChangedKeys', () => {
  let tempDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-git-changed-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const writeJson = (relPath, obj) => {
    const p = path.join(tempDir, relPath)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(obj, null, 2))
    return p
  }

  it('scopes changed keys per namespace file: the same bare key name in another file does not cross-match', async () => {
    git(['init', '-b', 'main'], tempDir)
    const pathA = writeJson('en/emailA.json', { subject: 'Welcome!' })
    const pathB = writeJson('en/emailB.json', { subject: 'Goodbye!' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'base')
    git(['checkout', '-q', '-b', 'feature'], tempDir)
    writeJson('en/emailA.json', { subject: 'Welcome to locize!' })

    const opt = { path: tempDir, format: 'json' }
    const { base, compareRef } = resolveGitCompareRef(opt)
    expect(base).toBe('main')
    opt.gitBaseName = base
    opt.gitCompareRef = compareRef

    const referenceNamespaces = [
      { namespace: 'emailA', path: pathA, language: 'en', content: { subject: 'Welcome to locize!' } },
      { namespace: 'emailB', path: pathB, language: 'en', content: { subject: 'Goodbye!' } }
    ]
    const changedKeysByNamespace = await getChangedKeysByNamespace(opt, referenceNamespaces)
    expect([...changedKeysByNamespace.get('emailA')]).toEqual(['subject'])
    expect(changedKeysByNamespace.get('emailB').size).toBe(0)

    // both namespaces are missing `subject` remotely: only emailA's may be pushed
    const compared = [
      { namespace: 'emailA', language: 'en', diff: { toAdd: ['subject'], toUpdate: [], toRemove: [] } },
      { namespace: 'emailB', language: 'en', diff: { toAdd: ['subject'], toUpdate: [], toRemove: [] } }
    ]
    filterComparedToChangedKeys(compared, changedKeysByNamespace)
    expect(compared[0].diff.toAdd).toEqual(['subject'])
    expect(compared[1].diff.toAdd).toEqual([])
  })

  it('includes all plural variants of a base key when any variant changed in that file', () => {
    // en only has one/other, the target language needs zero/two/few/many too
    const changedKeysByNamespace = new Map([['items', new Set(['item_one', 'item_other'])]])
    const compared = [{
      namespace: 'items',
      language: 'ar',
      diff: {
        toAdd: ['item_zero', 'item_two', 'item_few', 'item_many', 'unrelated_key'],
        toUpdate: ['item_one'],
        toRemove: []
      }
    }]
    filterComparedToChangedKeys(compared, changedKeysByNamespace)
    expect(compared[0].diff.toAdd).toEqual(['item_zero', 'item_two', 'item_few', 'item_many'])
    expect(compared[0].diff.toUpdate).toEqual(['item_one'])
  })

  it('does not let plural grouping leak across namespaces', () => {
    const changedKeysByNamespace = new Map([
      ['items', new Set(['item_one'])],
      ['other', new Set()]
    ])
    const compared = [
      { namespace: 'other', language: 'ar', diff: { toAdd: ['item_many'], toUpdate: [], toRemove: [] } }
    ]
    filterComparedToChangedKeys(compared, changedKeysByNamespace)
    expect(compared[0].diff.toAdd).toEqual([])
  })

  it('auto-detects master when neither origin/HEAD nor main exist, and uses the merge-base', () => {
    git(['init', '-b', 'master'], tempDir)
    writeJson('en/common.json', { a: '1' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'base')
    git(['checkout', '-q', '-b', 'feature'], tempDir)
    writeJson('en/common.json', { a: '1', b: '2' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'feature work')

    const { base, compareRef } = resolveGitCompareRef({ path: tempDir })
    expect(base).toBe('master')
    // merge-base of master and HEAD is the base commit, not the feature tip
    const masterSha = execFileSync('git', ['rev-parse', 'master'], { cwd: tempDir, encoding: 'utf8' }).trim()
    expect(compareRef).toBe(masterSha)
  })

  it('fails with a clear message outside a git repository', () => {
    expect(() => resolveGitCompareRef({ path: tempDir }))
      .toThrow(/not inside one/)
  })

  it('fails with a fetch hint when the explicit base ref cannot be resolved', () => {
    git(['init', '-b', 'main'], tempDir)
    writeJson('en/common.json', { a: '1' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'base')

    expect(() => resolveGitCompareRef({ path: tempDir, base: 'develop' }))
      .toThrow(/could not resolve the base ref "develop"[\s\S]*fetch-depth/)
  })

  it('end-to-end (dry): sync --changed-only only pushes keys changed on the branch, scoped per namespace', async () => {
    git(['init', '-b', 'main'], tempDir)
    writeJson('en/emailA.json', { subject: 'Welcome!' })
    writeJson('en/emailB.json', { subject: 'Goodbye!' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'base')
    git(['checkout', '-q', '-b', 'feature'], tempDir)
    writeJson('en/emailA.json', { subject: 'Welcome!', greeting: 'Hi there' })

    const { createFetchSimulator, jsonHandler } = await import('./helpers/fetchSimulator.js')
    const origFetch = global.fetch
    const origExit = process.exit
    process.exit = (code) => { throw new Error(`process.exit called with ${code}`) }
    const logs = []
    const origLog = console.log
    console.log = (...args) => { logs.push(args.join(' ')) }
    try {
      global.fetch = createFetchSimulator([
        jsonHandler('/languages/pid', { en: { isReferenceLanguage: true } }),
        jsonHandler('/download/pid/latest', [
          { key: 'pid/latest/en/emailA', url: 'http://api/pid/latest/en/emailA', size: 10 },
          { key: 'pid/latest/en/emailB', url: 'http://api/pid/latest/en/emailB', size: 10 }
        ]),
        // remote is missing `greeting` (changed on branch) in emailA and
        // `subject` (unchanged on branch) in emailB
        jsonHandler('/pid/latest/en/emailA', { subject: 'Welcome!' }),
        jsonHandler('/pid/latest/en/emailB', {})
      ])

      const { default: sync } = await import('../src/sync.js')
      await sync({
        apiEndpoint: 'http://api',
        apiKey: 'key',
        projectId: 'pid',
        version: 'latest',
        path: tempDir,
        format: 'json',
        referenceLanguageOnly: true,
        changedOnly: true,
        dry: true
      })
    } finally {
      console.log = origLog
      global.fetch = origFetch
      process.exit = origExit
    }

    expect(logs.some((l) => l.includes('would add greeting') && l.includes('emailA'))).toBe(true)
    expect(logs.some((l) => l.includes('would add subject'))).toBe(false)
    expect(logs.some((l) => l.includes('nothing to update for en/emailB'))).toBe(true)
  })

  it('treats a file that did not exist at the base as fully changed', async () => {
    git(['init', '-b', 'main'], tempDir)
    writeJson('en/common.json', { a: '1' })
    git(['add', '.'], tempDir)
    commit(tempDir, 'base')
    git(['checkout', '-q', '-b', 'feature'], tempDir)
    const newPath = writeJson('en/brandnew.json', { x: '1', y: '2' })

    const opt = { path: tempDir, format: 'json' }
    const { base, compareRef } = resolveGitCompareRef(opt)
    opt.gitBaseName = base
    opt.gitCompareRef = compareRef

    const changedKeysByNamespace = await getChangedKeysByNamespace(opt, [
      { namespace: 'brandnew', path: newPath, language: 'en', content: { x: '1', y: '2' } }
    ])
    expect([...changedKeysByNamespace.get('brandnew')].sort()).toEqual(['x', 'y'])
  })
})
