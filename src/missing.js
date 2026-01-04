import colors from 'colors'
import path from 'node:path'
import request from './request.js'
import * as formats from './formats.js'
import getRemoteLanguages from './getRemoteLanguages.js'
import parseLocalReference from './parseLocalReference.js'
import parseLocalLanguages from './parseLocalLanguages.js'
import getRemoteNamespace from './getRemoteNamespace.js'
import os from 'node:os'
import mapLimit from './mapLimit.js'

const reversedFileExtensionsMap = formats.reversedFileExtensionsMap

const compareNamespace = (local, remote) => {
  const diff = {
    toAdd: []
  }
  local = local || {}
  remote = remote || {}
  Object.keys(local).forEach((k) => {
    if (remote[k] === '' && local[k] === '') return
    if (!remote[k]) {
      diff.toAdd.push(k)
    }
  })
  return diff
}

const compareNamespaces = async (opt, localNamespaces) => {
  return await Promise.all(localNamespaces.map(async (ns) => {
    const { result: remoteNamespace } = await getRemoteNamespace(opt, ns.language, ns.namespace)
    const diff = compareNamespace(ns.content, remoteNamespace)
    ns.diff = diff
    ns.remoteContent = remoteNamespace
    return ns
  }))
}

const saveMissing = async (opt, lng, ns) => {
  const data = {}
  ns.diff.toAdd.forEach((k) => { data[k] = ns.content[k] })
  if (Object.keys(data).length === 0 || opt.dry) return
  const payloadKeysLimit = 1000
  async function send (d, isRetrying = false) {
    const { res, obj } = await request(opt.apiEndpoint + '/missing/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace, {
      method: 'post',
      body: d,
      headers: {
        Authorization: opt.apiKey
      }
    })
    if (res.status === 504 && !isRetrying) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      return send(d, true)
    }
    if (res.status >= 300 && res.status !== 412) {
      if (obj && (obj.errorMessage || obj.message)) {
        throw new Error((obj.errorMessage || obj.message))
      }
      throw new Error(res.statusText + ' (' + res.status + ')')
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (Object.keys(data).length > payloadKeysLimit) {
    const keysInObj = Object.keys(data)
    while (keysInObj.length > payloadKeysLimit) {
      const pagedData = {}
      keysInObj.splice(0, payloadKeysLimit).forEach((k) => { pagedData[k] = data[k] })
      await send(pagedData)
    }
    if (keysInObj.length === 0) return
    const finalPagedData = {}
    keysInObj.splice(0, keysInObj.length).forEach((k) => { finalPagedData[k] = data[k] })
    await send(finalPagedData)
    return
  }
  await send(data)
}

const handleError = (err) => {
  if (err) {
    console.error(colors.red(err.stack))
    process.exit(1)
  }
}

const handleMissing = async (opt, localNamespaces) => {
  if (!localNamespaces || localNamespaces.length === 0) {
    handleError(new Error('No local namespaces found!'))
    return
  }
  let compared
  try {
    compared = await compareNamespaces(opt, localNamespaces)
  } catch (err) {
    handleError(err)
    return
  }
  const concurrency = os.cpus().length
  await mapLimit(compared, concurrency, async (ns) => {
    if (ns.diff.toAdd.length > 0) {
      console.log(colors.green(`adding ${ns.diff.toAdd.length} keys in ${ns.language}/${ns.namespace}...`))
      if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAdd.join(', ')} in ${ns.language}/${ns.namespace}...`))
    }
    try {
      await saveMissing(opt, ns.language, ns)
    } catch (err) {
      handleError(err)
      // Don't return here, continue with others
    }
  })
  console.log(colors.green('FINISHED'))
}

const missing = async (opt) => {
  if (!reversedFileExtensionsMap[opt.format]) {
    handleError(new Error(`${opt.format} is not a valid format!`))
    return
  }
  if (opt.namespace && opt.namespace.indexOf(',') > 0) {
    opt.namespaces = opt.namespace.split(',')
    delete opt.namespace
  }
  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{'
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}'
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`
  opt.languageFolderPrefix = opt.languageFolderPrefix || ''
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`)
  let remoteLanguages
  try {
    remoteLanguages = await getRemoteLanguages(opt)
  } catch (err) {
    handleError(err)
    return
  }
  if (opt.referenceLanguageOnly && opt.language && opt.referenceLanguage !== opt.language) {
    opt.referenceLanguage = opt.language
  }
  if (opt.referenceLanguageOnly) {
    let localNamespaces
    try {
      localNamespaces = await parseLocalReference(opt)
    } catch (err) {
      handleError(err)
      return
    }
    await handleMissing(opt, localNamespaces)
    return
  }
  let localNamespaces
  try {
    localNamespaces = await parseLocalLanguages(opt, remoteLanguages)
  } catch (err) {
    handleError(err)
    return
  }
  await handleMissing(opt, localNamespaces)
}

export default missing
