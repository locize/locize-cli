import colors from 'colors'
import { mkdirp } from 'mkdirp'
import { rimraf } from 'rimraf'
import request from './request.js'
import fs from 'node:fs'
import path from 'node:path'
import flatten from 'flat'
import getRemoteNamespace from './getRemoteNamespace.js'
import getRemoteLanguages from './getRemoteLanguages.js'
import convertToDesiredFormat from './convertToDesiredFormat.js'
import * as formats from './formats.js'
import getProjectStats from './getProjectStats.js'
import locize2xcstrings from 'locize-xcstrings/locize2xcstrings'
import getBranches from './getBranches.js'
import isValidUuid from './isValidUuid.js'
import mapLimit from './mapLimit.js'

const reversedFileExtensionsMap = formats.reversedFileExtensionsMap

function getInfosInUrl (download) {
  const splitted = download.key.split('/')
  const version = splitted[download.isPrivate ? 2 : 1]
  const language = splitted[download.isPrivate ? 3 : 2]
  const namespace = splitted[download.isPrivate ? 4 : 3]
  return { version, language, namespace }
}

async function handleDownload (opt, url, err, res, downloads) {
  if (err || (downloads && (downloads.errorMessage || downloads.message))) {
    console.log(colors.red(`download failed for ${url} to ${opt.path}...`))
    if (err) {
      console.error(colors.red(err.message))
      throw err
    }
    if (downloads && (downloads.errorMessage || downloads.message)) {
      console.error(colors.red((downloads.errorMessage || downloads.message)))
      throw new Error((downloads.errorMessage || downloads.message))
    }
  }
  if (res.status >= 300) {
    console.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw new Error(res.statusText + ' (' + res.status + ')')
  }

  if (opt.format === 'xcstrings') {
    const downloadsByNamespace = {}
    downloads.forEach((download) => {
      const { version, namespace } = getInfosInUrl(download)
      opt.isPrivate = download.isPrivate
      downloadsByNamespace[version] = downloadsByNamespace[version] || {}
      downloadsByNamespace[version][namespace] = downloadsByNamespace[version][namespace] || []
      downloadsByNamespace[version][namespace].push(download)
    })
    for (const version of Object.keys(downloadsByNamespace)) {
      await mapLimit(Object.keys(downloadsByNamespace[version]), 20, async (ns) => {
        if (opt.namespace && opt.namespace !== ns) return
        if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(ns) < 0) return
        const locizeData = {
          sourceLng: opt.referenceLanguage,
          resources: {}
        }
        await mapLimit(downloadsByNamespace[version][ns], 20, async (download) => {
          const { language } = getInfosInUrl(download)
          const { result: nsData } = await getRemoteNamespace(opt, language, ns)
          if (opt.skipEmpty && Object.keys(flatten(nsData)).length === 0) {
            return
          }
          locizeData.resources[language] = nsData
        })
        try {
          const converted = locize2xcstrings(locizeData)
          const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, ns) + reversedFileExtensionsMap[opt.format]
          let mkdirPath
          if (filledMask.lastIndexOf(path.sep) > 0) {
            mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep))
          }
          const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted
          if (!opt.version) {
            if (mkdirPath) mkdirp.sync(path.join(opt.path, version, mkdirPath))
            fs.writeFileSync(path.join(opt.path, version, filledMask), fileContent)
          } else {
            if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath))
            fs.writeFileSync(path.join(opt.path, filledMask), fileContent)
          }
          console.log(colors.green(`downloaded ${version}/${ns} to ${opt.path}...`))
        } catch (err) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
          throw err
        }
      })
    }
  } else {
    await mapLimit(downloads, 20, async (download) => {
      const { version, language, namespace } = getInfosInUrl(download)
      opt.isPrivate = download.isPrivate
      if (opt.namespace && opt.namespace !== namespace) return
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return
      const { result: nsData, lastModified } = await getRemoteNamespace(opt, language, namespace)
      if (opt.skipEmpty && Object.keys(flatten(nsData)).length === 0) {
        return
      }
      let converted
      try {
        converted = await convertToDesiredFormat(opt, namespace, language, nsData, lastModified)
      } catch (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
        throw err
      }
      let filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, language).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format]
      let mkdirPath
      if (filledMask.lastIndexOf(path.sep) > 0) {
        mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep))
      }
      const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted
      if (!opt.version) {
        if (mkdirPath) mkdirp.sync(path.join(opt.path, version, mkdirPath))
        fs.writeFileSync(path.join(opt.path, version, filledMask), fileContent)
      } else if (!opt.language) {
        if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath))
        fs.writeFileSync(path.join(opt.path, filledMask), fileContent)
      } else {
        if (opt.languageFolderPrefix && filledMask.indexOf(path.sep) > 0) filledMask = filledMask.replace(opt.languageFolderPrefix + language, '')
        const parentDir = path.dirname(path.join(opt.path, filledMask))
        mkdirp.sync(parentDir)
        fs.writeFileSync(path.join(opt.path, filledMask), fileContent)
      }
    })
    console.log(colors.green(`downloaded ${url} to ${opt.path}...`))
  }
}

async function handlePull (opt, toDownload) {
  const url = opt.apiEndpoint + '/pull/' + opt.projectId + '/' + opt.version

  if (opt.format === 'xcstrings') {
    const downloadsByNamespace = {}
    toDownload.forEach((download) => {
      const { namespace } = download
      downloadsByNamespace[namespace] = downloadsByNamespace[namespace] || []
      downloadsByNamespace[namespace].push(download)
    })
    await mapLimit(Object.keys(downloadsByNamespace), 5, async (namespace) => {
      if (opt.namespace && opt.namespace !== namespace) return
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return
      const locizeData = {
        sourceLng: opt.referenceLanguage,
        resources: {}
      }
      await mapLimit(downloadsByNamespace[namespace], 5, async (download) => {
        const { language } = download
        opt.raw = true
        const { result: nsData } = await getRemoteNamespace(opt, language, namespace)
        if (opt.skipEmpty && Object.keys(flatten(nsData)).length === 0) {
          return
        }
        locizeData.resources[language] = nsData
      })
      try {
        const result = locize2xcstrings(locizeData)
        const converted = JSON.stringify(result, null, 2)
        const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format]
        let mkdirPath
        if (filledMask.lastIndexOf(path.sep) > 0) {
          mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep))
        }
        const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted
        if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath))
        fs.writeFileSync(path.join(opt.path, filledMask), fileContent)
        console.log(colors.green(`downloaded ${opt.version}/${namespace} to ${opt.path}...`))
      } catch (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
        throw err
      }
    })
  } else {
    await mapLimit(toDownload, 5, async (download) => {
      const lng = download.language
      const namespace = download.namespace
      if (opt.namespace && opt.namespace !== namespace) return
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return
      const { result: nsData, lastModified } = await getRemoteNamespace(opt, lng, namespace)
      if (opt.skipEmpty && Object.keys(flatten(nsData)).length === 0) {
        return
      }
      let converted
      try {
        converted = await convertToDesiredFormat(opt, namespace, lng, nsData, lastModified)
      } catch (err) {
        err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '')
        throw err
      }
      const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format]
      let mkdirPath
      if (filledMask.lastIndexOf(path.sep) > 0) {
        mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep))
      }
      const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted
      if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath))
      fs.writeFileSync(path.join(opt.path, filledMask), fileContent)
    })
    console.log(colors.green(`downloaded ${url} to ${opt.path}...`))
  }
}

// handleError removed (unused)

const filterDownloadsLanguages = (opt, downloads) => {
  if (opt.languages) {
    downloads = downloads.filter((d) => {
      const splitted = d.key.split('/')
      // const p = splitted[d.isPrivate ? 1 : 0];
      // const v = splitted[d.isPrivate ? 2 : 1];
      const l = splitted[d.isPrivate ? 3 : 2]
      const n = splitted[d.isPrivate ? 4 : 3]
      return opt.languages.indexOf(l) > -1 && (!opt.namespace || opt.namespace === n)
    })
  }
  return downloads
}

const filterDownloads = (opt, downloads) => {
  if (opt.skipEmpty) return filterDownloadsLanguages(opt, downloads.filter((d) => d.size > 2))
  if (downloads.length < 1) return downloads

  const allNamespaces = []
  const downloadMap = {}
  downloads.forEach((d) => {
    const splitted = d.key.split('/')
    const p = splitted[d.isPrivate ? 1 : 0]
    const v = splitted[d.isPrivate ? 2 : 1]
    const l = splitted[d.isPrivate ? 3 : 2]
    const n = splitted[d.isPrivate ? 4 : 3]
    downloadMap[p] = downloadMap[p] || {}
    downloadMap[p][v] = downloadMap[p][v] || {}
    downloadMap[p][v][l] = downloadMap[p][v][l] || {}
    downloadMap[p][v][l][n] = d
    if (allNamespaces.indexOf(n) < 0) allNamespaces.push(n)
  })
  Object.keys(downloadMap).forEach((projectId) => {
    Object.keys(downloadMap[projectId]).forEach((version) => {
      Object.keys(downloadMap[projectId][version]).forEach((language) => {
        allNamespaces.forEach((namespace) => {
          if (!downloadMap[projectId][version][language][namespace]) {
            downloads.push({
              url: `${opt.apiEndpoint}/${projectId}/${version}/${language}/${namespace}`,
              key: `${projectId}/${version}/${language}/${namespace}`,
              lastModified: '1960-01-01T00:00:00.000Z',
              size: 0
            })
          }
        })
      })
    })
  })
  return filterDownloadsLanguages(opt, downloads)
}

async function continueToDownload (opt) {
  let url = opt.apiEndpoint + '/download/' + opt.projectId

  if (opt.namespace && opt.namespace.indexOf(',') > 0 && opt.namespace.indexOf(' ') < 0) {
    opt.namespaces = opt.namespace.split(',')
    delete opt.namespace
  }

  if (opt.version) {
    url += '/' + opt.version
    if (!opt.languages && opt.language) {
      url += '/' + opt.language
      if (opt.namespace) {
        url += '/' + opt.namespace
      }
    }
  }

  if (opt.clean) rimraf.sync(path.join(opt.path, '*'))
  mkdirp.sync(opt.path)
  console.log(colors.yellow(`downloading ${url} to ${opt.path}...`))
  await getRemoteLanguages(opt)
  if (!opt.unpublished) {
    const { res, obj, err } = await request(url, {
      method: 'get',
      headers: opt.apiKey
        ? {
            Authorization: opt.apiKey
          }
        : undefined
    })
    let downloadsObj = obj
    if (res && res.status === 401) {
      opt.apiKey = null
      const { obj: obj2 } = await request(url, {
        method: 'get',
      })
      downloadsObj = obj2
    }
    downloadsObj = filterDownloads(opt, downloadsObj || [])
    if (downloadsObj.length > 0) {
      await handleDownload(opt, url, err, res, downloadsObj)
      return
    }
    const stats = await getProjectStats(opt)
    if (!stats) throw new Error('Nothing found!')
    if (!stats[opt.version]) throw new Error(`Version "${opt.version}" not found!`)
    downloadsObj = filterDownloads(opt, downloadsObj || [])
    await handleDownload(opt, url, err, res, downloadsObj)
    return
  }
  const stats = await getProjectStats(opt)
  if (!stats) throw new Error('Nothing found!')
  if (!stats[opt.version]) throw new Error(`Version "${opt.version}" not found!`)
  const toDownload = []
  const lngsToCheck = opt.language ? [opt.language] : Object.keys(stats[opt.version])
  lngsToCheck.forEach((l) => {
    if (opt.namespaces) {
      opt.namespaces.forEach((n) => {
        if (!stats[opt.version][l][n]) return
        if (opt.skipEmpty && stats[opt.version][l][n].segmentsTranslated === 0) return
        toDownload.push({ language: l, namespace: n })
      })
    } else if (opt.namespace) {
      if (!stats[opt.version][l][opt.namespace]) return
      if (opt.skipEmpty && stats[opt.version][l][opt.namespace].segmentsTranslated === 0) return
      toDownload.push({ language: l, namespace: opt.namespace })
    } else {
      Object.keys(stats[opt.version][l]).forEach((n) => {
        if (opt.skipEmpty && stats[opt.version][l][n].segmentsTranslated === 0) return
        toDownload.push({ language: l, namespace: n })
      })
    }
  })
  await handlePull(opt, toDownload)
}

async function download (opt) {
  opt.format = opt.format || 'json'
  if (!reversedFileExtensionsMap[opt.format]) {
    throw new Error(`${opt.format} is not a valid format!`)
  }
  if (opt.skipEmpty === undefined) opt.skipEmpty = true
  opt.apiEndpoint = opt.apiEndpoint || 'https://api.locize.app'
  opt.version = opt.version || 'latest'
  opt.languageFolderPrefix = opt.languageFolderPrefix || ''
  opt.path = opt.path || opt.target
  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{'
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}'
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`
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
    await continueToDownload(opt)
    return
  }
  await continueToDownload(opt)
}

export default download
