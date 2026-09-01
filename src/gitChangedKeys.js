import { execFileSync } from 'node:child_process'
import path from 'node:path'
import colors from 'colors'
import convertToFlatFormat from './convertToFlatFormat.js'
import xcstrings from 'locize-xcstrings'

// i18next plural suffixes: cardinal/ordinal CLDR categories plus the legacy
// v3 forms (_plural, _0, _1, ...). Kept in sync with the sister copy in
// i18next-cli (src/utils/git-changed-keys.ts).
const PLURAL_SUFFIX_REGEX = /(?:_ordinal)?_(?:zero|one|two|few|many|other|plural|\d+)$/

const runGit = (args, cwd, options = {}) => execFileSync('git', args, {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 50 * 1024 * 1024,
  ...options
})

const CI_FETCH_HINT = 'In CI, make sure the checkout is not shallow and includes the base branch — e.g. actions/checkout with "fetch-depth: 0".'

/**
 * Resolves the git ref to compare against for --changed-only.
 *
 * Returns { base, compareRef }: `base` is the resolved base branch ref (for
 * messaging), `compareRef` is the merge-base of that ref and HEAD — the commit
 * where the current branch diverged — so commits landing on the base branch
 * after the branch point are not attributed to this branch (the semantics of
 * `git diff base...HEAD`). Falls back to the base tip when merge-base cannot
 * be computed (e.g. shallow clones).
 *
 * Throws with an actionable message when git is unavailable, opt.path is not
 * inside a repository, or no base ref can be resolved.
 */
export function resolveGitCompareRef (opt) {
  try {
    runGit(['--version'])
  } catch (err) {
    throw new Error('--changed-only requires git, but the "git" command was not found. Install git or remove --changed-only to sync the whole project.')
  }

  try {
    runGit(['rev-parse', '--git-dir'], opt.path)
  } catch (err) {
    throw new Error(`--changed-only requires a git repository, but "${opt.path}" is not inside one. Run the sync inside your repository or remove --changed-only to sync the whole project.`)
  }

  const candidates = opt.base
    ? [opt.base, `origin/${opt.base}`]
    : ['origin/HEAD', 'main', 'origin/main', 'master', 'origin/master']

  let base
  for (const candidate of candidates) {
    try {
      runGit(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], opt.path)
      base = candidate
      break
    } catch (err) {}
  }

  if (!base) {
    if (opt.base) {
      throw new Error(`--changed-only could not resolve the base ref "${opt.base}" (also tried "origin/${opt.base}"). Fetch it first (git fetch origin ${opt.base}). ${CI_FETCH_HINT}`)
    }
    throw new Error(`--changed-only could not auto-detect a base branch (tried origin/HEAD, main and master). Pass one explicitly with --base <ref>. ${CI_FETCH_HINT}`)
  }

  let compareRef
  try {
    compareRef = runGit(['merge-base', base, 'HEAD'], opt.path, { encoding: 'utf8' }).trim()
  } catch (err) {}
  if (!compareRef) {
    console.log(colors.yellow(`could not find the merge-base of ${base} and HEAD — comparing against ${base} directly. On shallow CI clones (actions/checkout default fetch-depth: 1) deepen the fetch for exact results.`))
    compareRef = base
  }

  return { base, compareRef }
}

/**
 * Computes the keys that changed (added or value-modified) on the current
 * branch, per namespace, by diffing each local reference-language file
 * against its content at opt.gitCompareRef.
 *
 * The result is scoped PER NAMESPACE on purpose: many projects use the same
 * bare key names across namespaces (e.g. every email template has its own
 * `subject` / `body`), so a flat key set would let a change in one namespace
 * falsely match same-named keys in unrelated ones.
 */
export async function getChangedKeysByNamespace (opt, referenceNamespaces) {
  const changedKeysByNamespace = new Map()

  for (const ns of referenceNamespaces) {
    const relPath = path.relative(opt.path, ns.path).split(path.sep).join('/')
    // "./" makes the path relative to the git cwd (opt.path), not the repo root.
    // Existence at the base ref is checked via cat-file's exit code instead of
    // matching `git show`'s stderr, which is localized.
    let existedAtBase = true
    try {
      runGit(['cat-file', '-e', `${opt.gitCompareRef}:./${relPath}`], opt.path)
    } catch (err) {
      existedAtBase = false // new file on this branch: every key counts as changed
    }
    let oldData = null
    if (existedAtBase) {
      try {
        oldData = runGit(['show', `${opt.gitCompareRef}:./${relPath}`], opt.path)
      } catch (err) {
        throw new Error(`--changed-only could not read "${relPath}" at ${opt.gitBaseName || opt.gitCompareRef}: ${String(err.stderr || '').trim() || err.message}`)
      }
    }

    let oldFlat = {}
    if (oldData !== null) {
      try {
        oldFlat = opt.format === 'xcstrings'
          ? (xcstrings.xcstrings2locize(oldData).resources[ns.language] || {})
          : await convertToFlatFormat(opt, oldData, ns.language)
      } catch (err) {
        // An unparsable base version must not silently become "all keys
        // changed" (over-syncs and over-translates) or "no keys changed"
        // (silently drops the file) — fail loudly instead.
        throw new Error(`--changed-only could not parse "${relPath}" at ${opt.gitBaseName || opt.gitCompareRef}: ${err.message}`)
      }
    }

    const changed = new Set()
    Object.keys(ns.content || {}).forEach((k) => {
      if (!(k in oldFlat) || JSON.stringify(oldFlat[k]) !== JSON.stringify(ns.content[k])) {
        changed.add(k)
      }
    })
    changedKeysByNamespace.set(ns.namespace, changed)
  }

  return changedKeysByNamespace
}

/**
 * Restricts each compared namespace diff (toAdd/toUpdate) to the keys that
 * changed in THAT namespace's reference-language file.
 *
 * Plural grouping: when ANY variant of a base key changed in a namespace, ALL
 * variants of that base key pass the filter. Source and target languages have
 * different CLDR plural category counts (en: one/other; ar: zero..other), so
 * filtering target variants by exact source-key match would drop the extra
 * target-only forms.
 */
export function filterComparedToChangedKeys (compared, changedKeysByNamespace) {
  const empty = new Set()
  compared.forEach((ns) => {
    const changed = changedKeysByNamespace.get(ns.namespace) || empty
    const baseChanged = new Set()
    changed.forEach((k) => baseChanged.add(k.replace(PLURAL_SUFFIX_REGEX, '')))
    const matches = (k) => {
      if (changed.has(k)) return true
      const base = k.replace(PLURAL_SUFFIX_REGEX, '')
      return base !== k && baseChanged.has(base)
    }
    ns.diff.toAdd = ns.diff.toAdd.filter(matches)
    ns.diff.toUpdate = ns.diff.toUpdate.filter(matches)
  })
}
