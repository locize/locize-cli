import fs from 'node:fs'
import path from 'node:path'
import { mkdirp } from 'mkdirp'
import convertToFlatFormat from './convertToFlatFormat.js'
import * as formats from './formats.js'
import xcstrings2locize from 'locize-xcstrings/cjs/xcstrings2locize'
const fileExtensionsMap = formats.fileExtensionsMap
const acceptedFileExtensions = formats.acceptedFileExtensions

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return !fs.statSync(path.join(srcpath, file)).isDirectory()
  }).filter((file) => acceptedFileExtensions.indexOf(path.extname(file)) > -1)
}

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return fs.statSync(path.join(srcpath, file)).isDirectory()
  })
}

const parseLocalLanguage = async (opt, lng) => {
  const hasNamespaceInPath = opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1
  const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, opt.format === 'xcstrings' ? '' : lng)
  let firstPartLngMask, lastPartLngMask
  if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
    const secondPartMask = opt.pathMask.substring(opt.pathMask.lastIndexOf(path.sep) + 1)
    firstPartLngMask = secondPartMask.substring(0, secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`))
    lastPartLngMask = secondPartMask.substring(secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`.length)
  }
  let lngPath
  if (filledLngMask.lastIndexOf(path.sep) > 0) {
    lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep))
  }
  if (!opt.dry && lngPath && lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) < 0) mkdirp.sync(path.join(opt.path, lngPath))

  let files = []
  try {
    if (lngPath) {
      if (lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1) {
        const firstPart = lngPath.substring(0, lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`))
        const lastPart = lngPath.substring(lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`.length)
        let additionalSubDirsLeft = ''
        let additionalSubDirs = ''
        const splittedP = lngPath.split(path.sep)
        const foundSplitted = splittedP.find((s) => s.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1)
        const foundSplittedIndex = splittedP.indexOf(foundSplitted)
        if (splittedP.length > 2) {
          additionalSubDirsLeft = splittedP.slice(0, foundSplittedIndex).join(path.sep)
          additionalSubDirs = splittedP.slice(foundSplittedIndex + 1).join(path.sep)
        }
        let dirs = getDirectories(path.join(opt.path, additionalSubDirsLeft))
        if (additionalSubDirs === '') {
          dirs = dirs.filter((d) => d.startsWith(firstPart) && d.endsWith(lastPart))
        }
        dirs.forEach((d) => {
          if (additionalSubDirs && fs.statSync(path.join(opt.path, additionalSubDirsLeft, d)).isDirectory()) {
            let directoryExists = false
            try {
              directoryExists = fs.statSync(path.join(opt.path, additionalSubDirsLeft, d, additionalSubDirs)).isDirectory()
            } catch (e) {}
            if (directoryExists) {
              let subFls = getFiles(path.join(opt.path, additionalSubDirsLeft, d, additionalSubDirs))
              if (firstPartLngMask || lastPartLngMask) subFls = subFls.filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`)

              subFls = subFls.filter((f) => {
                const a = path.join(additionalSubDirsLeft, d, additionalSubDirs, path.basename(f, path.extname(f)))
                const startIndexOfNs = filledLngMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)
                if (startIndexOfNs === -1) return true
                const afterNs = filledLngMask.substring(startIndexOfNs + `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`.length)
                const nsName = a.substring(startIndexOfNs, a.indexOf(afterNs))
                const b = filledLngMask.replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, nsName)
                return a === b
              })

              files = files.concat(subFls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${additionalSubDirs}${path.sep}${f}`))
            }
          } else {
            const fls = getFiles(path.join(opt.path, additionalSubDirsLeft, d)).filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`)
            files = files.concat(fls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${f}`))
          }
        })
      } else {
        files = getFiles(path.join(opt.path, lngPath))
      }
    } else {
      files = getFiles(opt.path)
      // filter lng files...
      const lngIndex = filledLngMask.indexOf(lng)
      const lngLeftLength = filledLngMask.length - lngIndex
      files = files.filter((f) => { // {{language}} can be left or right of {{namespace}}
        if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) < opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
          return f.indexOf(lng) === lngIndex
        }
        return (path.basename(f, path.extname(f)).length - f.indexOf(lng)) === lngLeftLength
      })
    }
  } catch (err) {}

  // Async map logic using Promise.all
  const results = await Promise.all(files.map(async (fileOrig) => {
    let file = fileOrig
    let dirPath
    if (file.lastIndexOf(path.sep) > 0) {
      dirPath = file.substring(0, file.lastIndexOf(path.sep))
      file = file.substring(file.lastIndexOf(path.sep) + 1)
    }
    const fExt = path.extname(file)
    let namespace = path.basename(file, fExt)
    const nsMask = `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`
    const filledNsMask = lngPath && lngPath.indexOf(nsMask) > -1 ? filledLngMask : filledLngMask.substring(filledLngMask.lastIndexOf(path.sep) + 1)
    const startNsIndex = filledNsMask.indexOf(nsMask)
    let restNsMask = filledNsMask.substring((startNsIndex || 0) + nsMask.length)
    namespace = namespace.substring(startNsIndex || 0, namespace.lastIndexOf(restNsMask))
    if (lngPath && lngPath.indexOf(nsMask) > -1) {
      restNsMask = restNsMask.substring(0, restNsMask.lastIndexOf(path.sep))
      if (dirPath.indexOf(restNsMask) > 0) {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask), dirPath.indexOf(restNsMask))
      } else {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask))
      }
    } else if (!hasNamespaceInPath && startNsIndex < 0) {
      namespace = opt.namespace
    }
    let fPath = path.join(opt.path, lngPath || '', file)
    if (dirPath && lngPath.indexOf(nsMask) > -1) {
      fPath = path.join(opt.path, dirPath.replace(nsMask, namespace), file)
    }
    if (!namespace) throw new Error(`namespace could not be found in ${fPath}`)
    if (opt.namespaces && opt.namespaces.indexOf(namespace) < 0) return undefined
    if (opt.namespace && opt.namespace !== namespace) return undefined
    const data = await fs.promises.readFile(fPath)
    if (fileExtensionsMap[fExt].indexOf(opt.format) < 0) {
      throw new Error(`Format mismatch! Found ${fileExtensionsMap[fExt][0]} but requested ${opt.format}!`)
    }
    if (opt.namespace) {
      let hasNamespaceInPathPask = !opt.pathMask || !opt.pathMaskInterpolationPrefix || !opt.pathMaskInterpolationSuffix
      hasNamespaceInPathPask = !hasNamespaceInPathPask && opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1
      if (!hasNamespaceInPathPask && namespace === lng) {
        namespace = opt.namespace
      }
    }
    if (opt.format === 'xcstrings') {
      try {
        const content = xcstrings2locize(data)
        const stat = await fs.promises.stat(fPath)
        return Object.keys(content.resources).map((l) => ({
          namespace,
          path: fPath,
          extension: fExt,
          content: content.resources[l],
          language: l,
          mtime: stat.mtime
        }))
      } catch (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
        err.message += '\n' + fPath
        throw err
      }
    } else {
      let content
      try {
        content = await convertToFlatFormat(opt, data, lng)
      } catch (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
        err.message += '\n' + fPath
        throw err
      }
      const stat = await fs.promises.stat(fPath)
      return {
        namespace,
        path: fPath,
        extension: fExt,
        content,
        language: lng,
        mtime: stat.mtime
      }
    }
  }))

  // xcstrings, returns array in array
  const r = results.filter((r) => r !== undefined).reduce((prev, cur) => {
    if (Array.isArray(cur)) {
      prev = prev.concat(cur)
    } else {
      prev.push(cur)
    }
    return prev
  }, [])
  return r
}

export default parseLocalLanguage
