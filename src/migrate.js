import fs from 'node:fs'
import path from 'node:path'
import flatten from 'flat'
import colors from 'colors'
import request from './request.js'
import getRemoteLanguages from './getRemoteLanguages.js'
import os from 'node:os'
import mapLimit from './mapLimit.js'

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function (file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory()
  })
}

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function (file) {
    return !fs.statSync(path.join(srcpath, file)).isDirectory()
  })
}

const load = async (namespaces) => {
  await Promise.all(namespaces.map(async (ns) => {
    try {
      const data = await fs.promises.readFile(ns.path, 'utf8')
      ns.value = flatten(JSON.parse(data))
    } catch (err) {
      console.error(colors.red(err.stack))
      ns.value = {}
    }
  }))
  return namespaces
}

const parseLanguage = async (p) => {
  const dirs = getDirectories(p)
  const namespaces = []
  dirs.forEach((lng) => {
    const files = getFiles(path.join(p, lng))
    files.forEach((file) => {
      if (path.extname(file) !== '.json') return
      namespaces.push({
        language: lng,
        namespace: path.basename(file, '.json'),
        path: path.join(p, lng, file)
      })
    })
  })
  return await load(namespaces)
}

const transfer = async (opt, ns) => {
  let url = `${opt.apiEndpoint}/update/{{projectId}}/{{version}}/{{lng}}/{{ns}}`
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', ns.language)
    .replace('{{lng}}', ns.language)
    .replace('{{ns}}', ns.namespace)
    .replace('{{namespace}}', ns.namespace)

  console.log(colors.yellow(`transfering ${opt.version}/${ns.language}/${ns.namespace}...`))

  if (!opt.replace) url = url.replace('/update/', '/missing/')

  const data = ns.value
  const keysToSend = Object.keys(data).length
  if (keysToSend === 0) return

  const payloadKeysLimit = 1000

  async function send (d, so, isFirst, isRetrying = false) {
    const queryParams = new URLSearchParams()
    if (so) {
      queryParams.append('omitstatsgeneration', 'true')
    }
    if (isFirst && opt.replace) {
      queryParams.append('replace', 'true')
    }
    const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : ''
    try {
      const { res, obj } = await request(url + queryString, {
        method: 'post',
        body: d,
        headers: {
          Authorization: opt.apiKey
        }
      })
      if (url.indexOf('/missing/') > -1 && res.status === 412) {
        console.log(colors.green(`transfered ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace} (but all keys already existed)...`))
        return
      }
      if (res.status === 504 && !isRetrying) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        return send(d, so, isFirst, true)
      }
      if (res.status >= 300 && res.status !== 412) {
        if (obj && (obj.errorMessage || obj.message)) {
          throw new Error((obj.errorMessage || obj.message))
        }
        throw new Error(res.statusText + ' (' + res.status + ')')
      }
      console.log(colors.green(`transfered ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace}...`))
    } catch (err) {
      console.log(colors.red(`transfer failed for ${Object.keys(d).length} keys ${opt.version}/${ns.language}/${ns.namespace}...`))
      throw err
    }
  }

  if (keysToSend > payloadKeysLimit) {
    const keysInObj = Object.keys(data)
    let isFirst = true
    while (keysInObj.length > payloadKeysLimit) {
      const pagedData = {}
      keysInObj.splice(0, payloadKeysLimit).forEach((k) => { pagedData[k] = data[k] })
      const hasMoreKeys = keysInObj.length > 0
      await send(pagedData, hasMoreKeys, isFirst)
      isFirst = false
    }
    if (keysInObj.length === 0) return
    const finalPagedData = {}
    keysInObj.splice(0, keysInObj.length).forEach((k) => { finalPagedData[k] = data[k] })
    await send(finalPagedData, false, isFirst)
    return
  }

  await send(data, false, true)
}

const upload = async (opt, nss) => {
  const concurrency = os.cpus().length
  if (!opt.referenceLanguage) {
    await mapLimit(nss, concurrency, async (ns) => transfer(opt, ns))
    return
  }

  const nssRefLng = nss.filter((n) => n.language === opt.referenceLanguage)
  const nssNonRefLng = nss.filter((n) => n.language !== opt.referenceLanguage)

  // Reference language first, then others, but each group in parallel
  await mapLimit(nssRefLng, concurrency, async (ns) => transfer(opt, ns))
  await mapLimit(nssNonRefLng, concurrency, async (ns) => transfer(opt, ns))
}

const addLanguage = async (opt, l) => {
  const url = opt.apiEndpoint + '/language/' + opt.projectId + '/' + l
  try {
    const { res } = await request(url, {
      method: 'post',
      headers: {
        Authorization: opt.apiKey
      }
    })
    if (res.status >= 300 && res.status !== 412) throw new Error(res.statusText + ' (' + res.status + ')')
    console.log(colors.green(`added language ${l}...`))
  } catch (err) {
    console.log(colors.red(`failed to add language ${l}...`))
    throw err
  }
}

const migrate = async (opt) => {
  if (opt.format !== 'json') {
    throw new Error(`Format ${opt.format} is not accepted!`)
  }

  opt.apiEndpoint = opt.apiEndpoint || 'https://api.locize.app'

  if (opt.language) {
    const files = getFiles(opt.path)
    const namespaces = files.map((file) => ({
      language: opt.language,
      namespace: path.basename(file, '.json'),
      path: path.join(opt.path, file)
    }))
    let nss
    try {
      nss = await load(namespaces)
    } catch (err) {
      console.error(colors.red(err.stack))
      process.exit(1)
    }
    try {
      await upload(opt, nss)
      console.log(colors.green('FINISHED'))
    } catch (err) {
      console.error(colors.red(err.stack))
      process.exit(1)
    }
    return
  }

  if (opt.parseLanguage) {
    let nss
    try {
      nss = await parseLanguage(opt.path)
    } catch (err) {
      console.error(colors.red(err.stack))
      process.exit(1)
    }
    let remoteLanguages
    try {
      remoteLanguages = await getRemoteLanguages(opt)
    } catch (err) {
      console.error(colors.red(err.stack))
      process.exit(1)
    }
    const localLanguages = []
    nss.forEach((n) => {
      if (localLanguages.indexOf(n.language) < 0) localLanguages.push(n.language)
    })
    const notExistingLanguages = localLanguages.filter((l) => remoteLanguages.indexOf(l) < 0)
    if (notExistingLanguages.length === 0) {
      try {
        await upload(opt, nss)
        console.log(colors.green('FINISHED'))
      } catch (err) {
        console.error(colors.red(err.stack))
        process.exit(1)
      }
      return
    }
    try {
      for (const l of notExistingLanguages) {
        await addLanguage(opt, l)
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      await upload(opt, nss)
      console.log(colors.green('FINISHED'))
    } catch (err) {
      console.error(colors.red(err.stack))
      process.exit(1)
    }
  }
}

export default migrate
