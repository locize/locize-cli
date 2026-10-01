import fs from 'node:fs'
import path from 'node:path'
import lngCodes from './lngs.js'
import { reversedFileExtensionsMap } from './formats.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lngPattern = `(?:${lngCodes.map(esc).join('|')})(?:[-_][\\w-]+)?`

// --clean removes what the path mask writes into --path and nothing else:
// leading static mask folders are entered, then only the entries the next
// mask segment can produce go (a {{language}} matches known language codes).
// Dot entries (.git, .locize) always stay.
export default function cleanPath (opt) {
  const root = path.resolve(opt.path)
  const L = `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`
  const N = `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`
  // xcstrings holds all languages in one file per namespace: the writer drops {{language}}
  const mask = opt.format === 'xcstrings' ? opt.pathMask.replace(L, '') : opt.pathMask
  const segments = mask.split(/[\\/]/).filter(Boolean)
  let i = 0
  while (i < segments.length - 1 && !segments[i].includes(L) && !segments[i].includes(N)) i++
  const dir = path.join(root, ...segments.slice(0, i))
  if (!fs.existsSync(dir)) return

  // only a leading mask folder inside --path confines the clean
  if (!dir.startsWith(root + path.sep)) {
    const rel = path.relative(fs.realpathSync(dir), fs.realpathSync(process.cwd()))
    const holdsCwd = !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)
    if (holdsCwd || fs.existsSync(path.join(dir, '.git'))) {
      throw new Error(`--clean true refused for ${dir}: it is ${holdsCwd ? 'the working directory (or contains it)' : 'the root of a git repository'}, so cleaning it could delete more than your translations. Point --path at the folder that only holds them (e.g. --path ./locales) or start --path-mask with that folder (e.g. locales/${L}/${N}).`)
    }
  }

  let pattern = segments[i].split(L).map((part) => part.split(N).map(esc).join('.+')).join(lngPattern)
  if (i === segments.length - 1) pattern += esc(reversedFileExtensionsMap[opt.format])
  const re = new RegExp(`^${pattern}$`, 'i')
  fs.readdirSync(dir)
    .filter((entry) => !entry.startsWith('.') && re.test(entry))
    .forEach((entry) => fs.rmSync(path.join(dir, entry), { recursive: true, force: true }))
}
