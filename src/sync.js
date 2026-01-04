import fs from 'node:fs'
import path from 'node:path'
import { mkdirp } from 'mkdirp'
import { rimraf } from 'rimraf'
import colors from 'colors'
import request from './request.js'
import flatten from 'flat'
import cloneDeep from 'lodash.clonedeep'
import getRemoteNamespace from './getRemoteNamespace.js'
import getRemoteLanguages from './getRemoteLanguages.js'
import convertToDesiredFormat from './convertToDesiredFormat.js'
import parseLocalLanguages from './parseLocalLanguages.js'
import parseLocalReference from './parseLocalReference.js'
import * as formats from './formats.js'
import deleteNamespace from './deleteNamespace.js'
import getProjectStats from './getProjectStats.js'
import locize2xcstrings from 'locize-xcstrings/locize2xcstrings'
import getBranches from './getBranches.js'
import isValidUuid from './isValidUuid.js'
import os from 'node:os'
import lngCodes from './lngs.js'

const reversedFileExtensionsMap = formats.reversedFileExtensionsMap

// concurrency-limited map: returns array of results
async function pMapLimit (items, limit, iterator) {
  if (!Array.isArray(items)) items = Array.from(items || [])
  const results = new Array(items.length)
  let i = 0
  const workers = new Array(Math.min(limit || 1, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      results[idx] = await iterator(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

// concurrency-limited each (ignore results)
async function pEachLimit (items, limit, iterator) {
  await pMapLimit(items, limit, async (item, idx) => {
    await iterator(item, idx)
    return null
  })
}

// run array of functions returning Promises in series
async function pSeries (tasks) {
  const results = []
  for (const t of tasks) {
    // t may be a function that accepts no args and returns a Promise
    results.push(await t())
  }
  return results
}

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return fs.statSync(path.join(srcpath, file)).isDirectory()
  })
}

function getInfosInUrl (download) {
  const splitted = download.key.split('/')
  const version = splitted[download.isPrivate ? 2 : 1]
  const language = splitted[download.isPrivate ? 3 : 2]
  const namespace = splitted[download.isPrivate ? 4 : 3]
  return { version, language, namespace }
}

const compareNamespace = (local, remote, lastModifiedLocal, lastModifiedRemote) => {
  const wasLastChangedRemote = lastModifiedLocal && lastModifiedRemote && lastModifiedLocal.getTime() < lastModifiedRemote.getTime()
  const diff = {
    toAdd: [],
    toAddLocally: [],
    toUpdate: [],
    toUpdateLocally: [],
    toRemove: [],
    toRemoveLocally: []
  }
  local = local || {}
  remote = remote || {}
  Object.keys(local).forEach((k) => {
    if (remote[k] === '' && local[k] === '') return
    if (!remote[k]) {
      if (wasLastChangedRemote) {
        diff.toRemoveLocally.push(k) // will download later
      } else {
        diff.toAdd.push(k)
      }
    }
    if (
      remote[k] && (
        (typeof local[k] === 'object' && local[k] && local[k].value && remote[k] !== local[k].value) ||
        (typeof local[k] !== 'object' && remote[k] !== local[k])
      )
    ) {
      if (wasLastChangedRemote) {
        diff.toUpdateLocally.push(k) // will download later
      } else {
        diff.toUpdate.push(k)
      }
    }
  })
  Object.keys(remote).forEach((k) => {
    if (local[k] === '' && remote[k] === '') return
    if (!local[k]) {
      if (wasLastChangedRemote) {
        diff.toAddLocally.push(k) // will download later
      } else {
        diff.toRemove.push(k)
      }
    }
  })
  return diff
}

const doesDirectoryExist = (p) => {
  let directoryExists = false
  try {
    directoryExists = fs.statSync(p).isDirectory()
  } catch (e) {}
  return directoryExists
}

const getNamespaceNamesAvailableInReference = (opt, downloads) => {
  const nsNames = []
  downloads.forEach((d) => {
    const splitted = d.key.split('/')
    const lng = splitted[2]
    const ns = splitted[3]
    if (lng === opt.referenceLanguage) {
      nsNames.push(ns)
    }
  })
  return nsNames
}

const ensureAllNamespacesInLanguages = (opt, remoteLanguages, downloads) => {
  const namespaces = getNamespaceNamesAvailableInReference(opt, downloads)

  remoteLanguages.forEach((lng) => {
    namespaces.forEach((n) => {
      const found = downloads.find((d) => d.key === `${opt.projectId}/${opt.version}/${lng}/${n}`)
      if (!found) {
        downloads.push({
          key: `${opt.projectId}/${opt.version}/${lng}/${n}`,
          lastModified: '1960-01-01T00:00:00.000Z',
          size: 0,
          url: `${opt.apiEndpoint}/${opt.projectId}/${opt.version}/${lng}/${n}`
        })
      }
    })
  })
}

const cleanupLanguages = (opt, remoteLanguages) => {
  if (opt.pathMask.lastIndexOf(path.sep) < 0) return
  const dirs = getDirectories(opt.path).filter((dir) => dir.indexOf('.') !== 0)
  if (!opt.language && (!opt.languages || opt.languages.length === 0) && !opt.namespace && !opt.namespaces) {
    dirs
      .filter((lng) => {
        const lMask = `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`
        const startLIndex = opt.pathMask.indexOf(lMask)
        const restLMask = lng.substring((startLIndex || 0) + lMask.length)
        lng = lng.substring(startLIndex || 0, lng.lastIndexOf(restLMask))

        return lng !== opt.referenceLanguage &&
            !!lngCodes.find((c) => lng === c || lng.indexOf(c + '-') === 0)
      })
      .forEach((lng) => {
        const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng)
        let lngPath
        if (filledLngMask.lastIndexOf(path.sep) > 0) {
          lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep))
        }
        if (doesDirectoryExist(path.join(opt.path, lngPath, 'CVS'))) return // special hack for CVS
        rimraf.sync(path.join(opt.path, lngPath))
      })
  }
  remoteLanguages.forEach((lng) => {
    if (opt.language && opt.language !== lng) return
    if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(lng) < 0) return
    const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng)
    let lngPath
    if (filledLngMask.lastIndexOf(path.sep) > 0) {
      lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep))
    }
    if (lngPath && lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) < 0) mkdirp.sync(path.join(opt.path, lngPath))
  })
}

const backupDeleted = (opt, ns, now) => {
  if (opt.dry || ns.diff.toRemove.length === 0) return
  let m = now.getMonth() + 1
  if (m < 10) m = `0${m}`
  let d = now.getDate()
  if (d < 10) d = `0${d}`
  let h = now.getHours()
  if (h < 10) h = `0${h}`
  let mi = now.getMinutes()
  if (mi < 10) mi = `0${mi}`
  let s = now.getSeconds()
  if (s < 10) s = `0${s}`
  const currentBackupPath = path.join(opt.backupDeletedPath, `${now.getFullYear()}${m}${d}-${h}${mi}${s}`)
  mkdirp.sync(currentBackupPath)
  const removingRemote = ns.diff.toRemove.reduce((prev, k) => {
    prev[k] = ns.remoteContent[k]
    return prev
  }, {})
  mkdirp.sync(path.join(currentBackupPath, ns.language))
  const content = JSON.stringify(removingRemote, null, 2)
  const fileContent = (opt.format !== 'xlsx' && !content.endsWith('\n')) ? (content + '\n') : content
  fs.writeFileSync(path.join(currentBackupPath, ns.language, `${ns.namespace}.json`), fileContent)
}

async function getDownloads (opt) {
  // replicates earlier behavior but returns a Promise that resolves to downloads array
  if (!opt.unpublished) {
    const url = opt.apiEndpoint + '/download/' + opt.projectId + '/' + opt.version
    const headers = opt.apiKey ? { Authorization: opt.apiKey } : undefined
    let { res, obj } = await request(url, { method: 'get', headers })
    if (res.status >= 300) {
      if (obj && (obj.errorMessage || obj.message)) {
        if (res.statusText && res.status) {
          throw new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message))
        }
        throw new Error((obj.errorMessage || obj.message))
      }
      throw new Error(res.statusText + ' (' + res.status + ')')
    }
    if (obj.length > 0) {
      if (opt.skipEmpty) obj = obj.filter((d) => d.size > 2)
      return obj
    }

    const resStats = await getProjectStats(opt)
    const stats = resStats
    if (!stats) throw new Error('Nothing found!')
    if (!stats[opt.version]) throw new Error(`Version "${opt.version}" not found!`)
    return obj
  } else {
    const stats = await getProjectStats(opt)
    if (!stats) throw new Error('Nothing found!')
    if (!stats[opt.version]) throw new Error(`Version "${opt.version}" not found!`)

    const toDownload = []
    const lngsToCheck = opt.language ? [opt.language] : (opt.languages && opt.languages.length > 0) ? opt.languages : Object.keys(stats[opt.version])
    lngsToCheck.forEach((l) => {
      if (opt.namespaces) {
        opt.namespaces.forEach((n) => {
          if (!stats[opt.version][l][n]) return
          if (opt.skipEmpty && stats[opt.version][l][n].segmentsTranslated === 0) return
          toDownload.push({
            url: `${opt.apiEndpoint}/${opt.projectId}/${opt.version}/${l}/${n}`,
            key: `${opt.projectId}/${opt.version}/${l}/${n}`,
            lastModified: '1960-01-01T00:00:00.000Z',
            size: 0
          })
        })
      } else if (opt.namespace) {
        if (!stats[opt.version][l][opt.namespace]) return
        if (opt.skipEmpty && stats[opt.version][l][opt.namespace].segmentsTranslated === 0) return
        toDownload.push({
          url: `${opt.apiEndpoint}/${opt.projectId}/${opt.version}/${l}/${opt.namespace}`,
          key: `${opt.projectId}/${opt.version}/${l}/${opt.namespace}`,
          lastModified: '1960-01-01T00:00:00.000Z',
          size: 0
        })
      } else {
        Object.keys(stats[opt.version][l]).forEach((n) => {
          if (opt.skipEmpty && stats[opt.version][l][n].segmentsTranslated === 0) return
          toDownload.push({
            url: `${opt.apiEndpoint}/${opt.projectId}/${opt.version}/${l}/${n}`,
            key: `${opt.projectId}/${opt.version}/${l}/${n}`,
            lastModified: '1960-01-01T00:00:00.000Z',
            size: 0
          })
        })
      }
    })
    return toDownload
  }
}

async function compareNamespaces (opt, localNamespaces) {
  // previously used async.mapLimit -> pMapLimit
  const limit = 20
  return pMapLimit(localNamespaces, limit, async (ns) => {
    const { result: remoteNamespace, lastModified } = await getRemoteNamespace(opt, ns.language, ns.namespace)
    const diff = compareNamespace(ns.content, remoteNamespace, opt.compareModificationTime ? ns.mtime : undefined, opt.compareModificationTime ? lastModified : undefined)
    ns.diff = diff
    ns.remoteContent = remoteNamespace
    return ns
  })
}

async function downloadAll (opt, remoteLanguages, omitRef = false, manipulate) {
  if (!opt.dry && opt.format !== 'xcstrings') cleanupLanguages(opt, remoteLanguages)

  let downloads = await getDownloads(opt)

  ensureAllNamespacesInLanguages(opt, remoteLanguages, downloads)

  if (omitRef) {
    downloads = downloads.filter((d) => {
      const splitted = d.key.split('/')
      const lng = splitted[d.isPrivate ? 3 : 2]
      return lng !== opt.referenceLanguage
    })
  }

  if (opt.format === 'xcstrings') { // 1 file per namespace including all languages
    const downloadsByNamespace = {}
    downloads.forEach((download) => {
      const { namespace } = getInfosInUrl(download)
      downloadsByNamespace[namespace] = downloadsByNamespace[namespace] || []
      downloadsByNamespace[namespace].push(download)
    })

    const namespaceKeys = Object.keys(downloadsByNamespace)
    const concurrency = opt.unpublished ? 5 : 20

    await pEachLimit(namespaceKeys, concurrency, async (namespace) => {
      const locizeData = {
        sourceLng: opt.referenceLanguage,
        resources: {}
      }

      const entries = downloadsByNamespace[namespace]
      await pEachLimit(entries, opt.unpublished ? 5 : 20, async (download) => {
        const { language } = getInfosInUrl(download)
        opt.isPrivate = download.isPrivate

        if (opt.language && opt.language !== language && language !== opt.referenceLanguage) return
        if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(language) < 0 && language !== opt.referenceLanguage) return
        if (opt.namespace && opt.namespace !== namespace) return
        if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return

        if (opt.unpublished) opt.raw = true
        const { result: ns } = await getRemoteNamespace(opt, language, namespace)

        if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
          return
        }

        if (manipulate && typeof manipulate === 'function') manipulate(language, namespace, ns)

        locizeData.resources[language] = ns
      })

      try {
        const converted = locize2xcstrings(locizeData)

        const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format]
        if (opt.dry) return
        if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) && filledMask.lastIndexOf(path.sep) > 0) {
          mkdirp.sync(path.join(opt.path, filledMask.substring(0, filledMask.lastIndexOf(path.sep))))
        }
        const parentDir = path.dirname(path.join(opt.path, filledMask))
        mkdirp.sync(parentDir)
        const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted
        await fs.promises.writeFile(path.join(opt.path, filledMask), fileContent)
      } catch (e) {
        e.message = 'Invalid content for "' + opt.format + '" format!\n' + (e.message || '')
        throw e
      }
    })
  } else { // 1 file per namespace/lng
    const concurrency = opt.unpublished ? 5 : 20
    await pEachLimit(downloads, concurrency, async (download) => {
      const { language, namespace } = getInfosInUrl(download)
      opt.isPrivate = download.isPrivate

      if (opt.language && opt.language !== language && language !== opt.referenceLanguage) return
      if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(language) < 0 && language !== opt.referenceLanguage) return
      if (opt.namespace && opt.namespace !== namespace) return
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return

      const { result: ns, lastModified } = await getRemoteNamespace(opt, language, namespace)

      if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
        return
      }

      if (manipulate && typeof manipulate === 'function') manipulate(language, namespace, ns)

      const converted = await convertToDesiredFormat(opt, namespace, language, ns, lastModified)
      // convertToDesiredFormatP either resolves converted or throws
      let convertedText = converted
      if (Array.isArray(converted) && converted.length === 1) convertedText = converted[0]

      const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, language).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format]
      if (opt.dry) return
      if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) && filledMask.lastIndexOf(path.sep) > 0) {
        mkdirp.sync(path.join(opt.path, filledMask.substring(0, filledMask.lastIndexOf(path.sep))))
      }
      const parentDir = path.dirname(path.join(opt.path, filledMask))
      mkdirp.sync(parentDir)
      const fileContent = (opt.format !== 'xlsx' && !convertedText.endsWith('\n')) ? (convertedText + '\n') : convertedText
      await fs.promises.writeFile(path.join(opt.path, filledMask), fileContent)
    })
  }
}

async function update (opt, lng, ns, shouldOmit = false) {
  const data = {}
  if (!opt.skipDelete) {
    ns.diff.toRemove.forEach((k) => { data[k] = null })
  }
  ns.diff.toAdd.forEach((k) => { data[k] = ns.content[k] })
  if (opt.updateValues) {
    ns.diff.toUpdate.forEach((k) => { data[k] = ns.content[k] })
  }

  const keysToSend = Object.keys(data).length
  if (keysToSend === 0) return

  if (opt.dry) return

  const payloadKeysLimit = 1000

  async function send (d, so) {
    const queryParams = new URLSearchParams()
    if (opt.autoTranslate && lng === opt.referenceLanguage) {
      /** @See https://www.locize.com/docs/api#optional-autotranslate */
      queryParams.append('autotranslate', 'true')
    }
    if (so) {
      queryParams.append('omitstatsgeneration', 'true')
    }

    const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : ''

    // retry once on 504
    let isRetrying = false
    while (true) {
      const { res, obj } = await request(opt.apiEndpoint + '/update/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace + queryString, {
        method: 'post',
        body: d,
        headers: {
          Authorization: opt.apiKey
        }
      })
      const cliInfo = res.headers.get('x-cli-info')
      if (cliInfo && cliInfo !== opt.lastShownCliInfo) {
        console.log(colors.yellow(cliInfo))
        opt.lastShownCliInfo = cliInfo
      }
      if (res.status === 504 && !isRetrying) {
        isRetrying = true
        await new Promise((resolve) => setTimeout(resolve, 3000))
        continue
      }
      if (res.status >= 300 && res.status !== 412) {
        if (obj && (obj.errorMessage || obj.message)) {
          throw new Error((obj.errorMessage || obj.message))
        }
        throw new Error(res.statusText + ' (' + res.status + ')')
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return
    }
  }

  if (keysToSend > payloadKeysLimit) {
    const tasks = []
    const keysInObj = Object.keys(data)

    while (keysInObj.length > payloadKeysLimit) {
      const pagedData = {}
      keysInObj.splice(0, payloadKeysLimit).forEach((k) => { pagedData[k] = data[k] })
      const hasMoreKeys = keysInObj.length > 0
      tasks.push(async () => send(pagedData, hasMoreKeys ? true : shouldOmit))
    }

    if (keysInObj.length === 0) return

    const finalPagedData = {}
    keysInObj.splice(0, keysInObj.length).forEach((k) => { finalPagedData[k] = data[k] })
    tasks.push(async () => send(finalPagedData, shouldOmit))

    // run tasks in series (as original async.series)
    await pSeries(tasks)
    return
  }

  await send(data, shouldOmit)
}

async function handleSync (opt, remoteLanguages, localNamespaces) {
  if (!localNamespaces || localNamespaces.length === 0) {
    await downloadAll(opt, remoteLanguages, false)
    return
  }

  const downloads = await getDownloads(opt)
  opt.isPrivate = downloads.length > 0 && downloads[0].isPrivate

  const localMissingNamespaces = checkForMissingLocalNamespaces(downloads, localNamespaces, opt)

  const compared = await compareNamespaces(opt, localNamespaces)

  const onlyToUpdate = compared.filter((ns) => ns.diff.toAdd.concat(opt.skipDelete ? [] : ns.diff.toRemove).concat(ns.diff.toUpdate).length > 0)

  const lngsInReqs = []
  const nsInReqs = []
  onlyToUpdate.forEach((n) => {
    if (lngsInReqs.indexOf(n.language) < 0) {
      lngsInReqs.push(n.language)
    }
    if (nsInReqs.indexOf(n.namespace) < 0) {
      nsInReqs.push(n.namespace)
    }
  })
  const shouldOmit = lngsInReqs.length > 5 || nsInReqs.length > 5

  let wasThereSomethingToUpdate = opt.autoTranslate || false

  async function updateComparedNamespaces () {
    const now = new Date()
    const concurrency = Math.max(1, Math.round(os.cpus().length / 2))
    await pEachLimit(compared, concurrency, async (ns) => {
      if (ns.diff.toRemove.length > 0) {
        if (opt.skipDelete) {
          console.log(colors.bgRed(`skipping the removal of ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`))
          if (opt.dry) console.log(colors.bgRed(`skipped to remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`))
        } else {
          console.log(colors.red(`removing ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`))
          if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`))
          if (!opt.dry && opt.backupDeletedPath) backupDeleted(opt, ns, now)
        }
      }
      if (ns.diff.toRemoveLocally.length > 0) {
        console.log(colors.red(`removing ${ns.diff.toRemoveLocally.length} keys in ${ns.language}/${ns.namespace} locally...`))
        if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemoveLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`))
      }
      if (ns.diff.toAdd.length > 0) {
        console.log(colors.green(`adding ${ns.diff.toAdd.length} keys in ${ns.language}/${ns.namespace}...`))
        if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAdd.join(', ')} in ${ns.language}/${ns.namespace}...`))
      }
      if (ns.diff.toAddLocally.length > 0) {
        if (opt.skipDelete) {
          console.log(colors.bgGreen(`skipping the addition of ${ns.diff.toAddLocally.length} keys in ${ns.language}/${ns.namespace} locally...`))
          if (opt.dry) console.log(colors.bgGreen(`skipped the addition of ${ns.diff.toAddLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`))
        } else {
          console.log(colors.green(`adding ${ns.diff.toAddLocally.length} keys in ${ns.language}/${ns.namespace} locally...`))
          if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAddLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`))
        }
      }
      if (opt.updateValues) {
        if (ns.diff.toUpdate.length > 0) {
          console.log(colors.yellow(`updating ${ns.diff.toUpdate.length} keys in ${ns.language}/${ns.namespace}${opt.autoTranslate ? ' with automatic translation' : ''}...`))
          if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdate.join(', ')} in ${ns.language}/${ns.namespace}...`))
        }
        if (ns.diff.toUpdateLocally.length > 0) {
          console.log(colors.yellow(`updating ${ns.diff.toUpdateLocally.length} keys in ${ns.language}/${ns.namespace} locally...`))
          if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdateLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`))
        }
      }
      const somethingToUpdate = ns.diff.toAdd.concat(opt.skipDelete ? [] : ns.diff.toRemove)/* .concat(ns.diff.toUpdate) */.length > 0
      if (!somethingToUpdate) console.log(colors.grey(`nothing to update for ${ns.language}/${ns.namespace}`))
      if (!wasThereSomethingToUpdate && somethingToUpdate) wasThereSomethingToUpdate = true

      await update(opt, ns.language, ns, shouldOmit)
      if (ns.diff.toRemove.length === 0 || ns.language !== opt.referenceLanguage) return
      const nsOnlyRemove = cloneDeep(ns)
      nsOnlyRemove.diff.toAdd = []
      nsOnlyRemove.diff.toUpdate = []
      await pEachLimit(remoteLanguages, Math.max(1, Math.round(os.cpus().length / 2)), async (lng) => {
        await update(opt, lng, nsOnlyRemove, shouldOmit)
      })
    })

    console.log(colors.grey('syncing...'))

    async function down () {
      await new Promise((resolve) => setTimeout(resolve, wasThereSomethingToUpdate && !opt.dry ? (opt.autoTranslate ? 10000 : 5000) : 0))
      await downloadAll(opt, remoteLanguages, false,
        opt.skipDelete
          ? (lng, namespace, ns) => {
              const found = compared.find((n) => n.namespace === namespace && n.language === lng)
              if (found && found.diff) {
                if (found.diff.toAddLocally && found.diff.toAddLocally.length > 0) {
                  found.diff.toAddLocally.forEach((k) => {
                    delete ns[k]
                  })
                }
                if (found.diff.toRemove && found.diff.toRemove.length > 0) {
                  found.diff.toRemove.forEach((k) => {
                    delete ns[k]
                  })
                }
              }
            }
          : undefined
      )
    }

    if (!shouldOmit) return down()
    if (opt.dry) return down()

    // optimize stats generation...
    const url = opt.apiEndpoint + '/stats/project/regenerate/' + opt.projectId + '/' + opt.version + (lngsInReqs.length === 1 ? `/${lngsInReqs[0]}` : '') + (nsInReqs.length === 1 ? `?namespace=${nsInReqs[0]}` : '')
    const { res, obj } = await request(url, {
      method: 'post',
      body: {},
      headers: {
        Authorization: opt.apiKey
      }
    })
    if (res.status >= 300 && res.status !== 412) {
      if (obj && (obj.errorMessage || obj.message)) {
        throw new Error((obj.errorMessage || obj.message))
      }
      throw new Error(res.statusText + ' (' + res.status + ')')
    }
    return down()
  }

  if (opt.deleteRemoteNamespace && localMissingNamespaces.length > 0) {
    wasThereSomethingToUpdate = true
    await pEachLimit(localMissingNamespaces, 20, async (n) => {
      if (opt.dry) {
        console.log(colors.red(`would delete complete namespace ${n.namespace}...`))
        return
      }
      console.log(colors.red(`deleting complete namespace ${n.namespace}...`))
      await deleteNamespace({
        apiEndpoint: opt.apiEndpoint,
        apiKey: opt.apiKey,
        projectId: opt.projectId,
        version: opt.version,
        namespace: n.namespace
      })
    })
    return updateComparedNamespaces()
  }
  return updateComparedNamespaces()
}

const checkForMissingLocalNamespaces = (downloads, localNamespaces, opt) => {
  const localMissingNamespaces = []
  downloads.forEach((d) => {
    const splitted = d.url.split('/')
    const namespace = splitted.pop()
    const language = splitted.pop()
    if (language === opt.referenceLanguage) {
      const foundLocalNamespace = localNamespaces.find((n) => n.namespace === namespace && n.language === language)
      if (!foundLocalNamespace) {
        localMissingNamespaces.push({
          language,
          namespace
        })
      }
    }
  })
  return localMissingNamespaces
}

async function continueToSync (opt) {
  console.log(colors.grey('checking remote (locize)...'))
  const remoteLanguages = await getRemoteLanguages(opt)

  if (opt.referenceLanguageOnly && opt.language && opt.referenceLanguage !== opt.language) {
    opt.referenceLanguage = opt.language
  }
  if (opt.referenceLanguageOnly && !opt.language && opt.languages && opt.languages.length > 0 && opt.languages.indexOf(opt.referenceLanguage) < 0) {
    opt.referenceLanguage = opt.languages[0]
  }

  if (opt.referenceLanguageOnly) {
    console.log(colors.grey(`checking local${opt.path !== process.cwd() ? ` (${opt.path})` : ''} only reference language...`))
    let localNamespaces = await parseLocalReference(opt)
    if (!opt.dry && opt.cleanLocalFiles) {
      localNamespaces.forEach((ln) => fs.unlinkSync(ln.path))
      localNamespaces = []
    }

    console.log(colors.grey('calculate diffs...'))
    await handleSync(opt, remoteLanguages, localNamespaces)
    return
  }

  console.log(colors.grey(`checking local${opt.path !== process.cwd() ? ` (${opt.path})` : ''}...`))
  let localNamespaces = await parseLocalLanguages(opt, remoteLanguages)
  if (!opt.dry && opt.cleanLocalFiles) {
    localNamespaces.forEach((ln) => fs.unlinkSync(ln.path))
    localNamespaces = []
  }

  console.log(colors.grey('calculate diffs...'))
  await handleSync(opt, remoteLanguages, localNamespaces)
}

async function syncInternal (opt) {
  opt.format = opt.format || 'json'
  if (!reversedFileExtensionsMap[opt.format]) {
    throw new Error(`${opt.format} is not a valid format!`)
  }

  if (opt.autoTranslate && !opt.referenceLanguageOnly) {
    console.log(colors.yellow('Using the "--auto-translate true" option together with the "--reference-language-only false" option might result in inconsistent target language translations (automatic translation vs. what is sent direcly to locize).'))
  }

  opt.version = opt.version || 'latest'
  opt.apiEndpoint = opt.apiEndpoint || 'https://api.locize.app'

  if (!opt.dry && opt.clean) rimraf.sync(path.join(opt.path, '*'))

  if (opt.autoCreatePath === false) {
    if (!doesDirectoryExist(opt.path)) {
      throw new Error(`${opt.path} does not exist!`)
    }
  }
  if (!opt.dry) mkdirp.sync(opt.path)

  if (opt.namespace && opt.namespace.indexOf(',') > 0 && opt.namespace.indexOf(' ') < 0) {
    opt.namespaces = opt.namespace.split(',')
    delete opt.namespace
  }

  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{'
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}'
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`
  opt.languageFolderPrefix = opt.languageFolderPrefix || ''
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`)
  if (opt.overriddenOnly) {
    opt.unpublished = true
  }
  if (opt.unpublished && !opt.apiKey) {
    throw new Error('Please provide also an api-key!')
  }

  if (opt.branch === '') {
    throw new Error('The branch name seems invalid!')
  }

  if (opt.branch) {
    const branches = await getBranches(opt)
    let b
    if (isValidUuid(opt.branch)) b = branches.find((br) => br.id === opt.branch)
    if (!b) b = branches.find((br) => br.name === opt.branch)
    if (!b) {
      throw new Error(`Branch ${opt.branch} not found!`)
    }
    opt.projectId = b.id
    opt.version = b.version

    return continueToSync(opt)
  }

  return continueToSync(opt)
}

async function sync (opt) {
  opt = opt || {}

  try {
    await syncInternal(opt)
    console.log(colors.green('FINISHED'))
  } catch (err) {
    console.error(colors.red(err.stack))
    process.exit(1)
  }
}

export default sync
