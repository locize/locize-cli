import request from './request.js'
import flatten from 'flat'
import sortFlatResources from './sortFlatResources.js'

const getRandomDelay = (delayFrom, delayTo) => Math.floor(Math.random() * delayTo) + delayFrom

function onlyKeysFlat (resources, prefix, ret) {
  ret = ret || {}
  if (!resources) return ret
  Object.keys(resources).forEach((k) => {
    if (typeof resources[k] === 'string' || !resources[k] || typeof resources[k].value === 'string') {
      if (prefix) {
        ret[prefix + '.' + k] = resources[k]
      } else {
        ret[k] = resources[k]
      }
    } else {
      onlyKeysFlat(resources[k], prefix ? prefix + '.' + k : k, ret)
    }
  })
  return ret
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const pullNamespacePaged = async (opt, lng, ns, next = '', retry = 0) => {
  const { res, obj, err } = await request(opt.apiEndpoint + '/pull/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?' + 'next=' + next + ((opt.raw || opt.overriddenOnly) ? '&raw=true' : '') + '&ts=' + Date.now(), {
    method: 'get',
    headers: {
      Authorization: opt.apiKey
    }
  })
  if (err) throw err
  if (res.status >= 300) {
    if (retry < 3 && res.status !== 401) {
      await sleep(getRandomDelay(3000, 10000))
      return await pullNamespacePaged(opt, lng, ns, next, retry + 1)
    }
    if (obj && (obj.errorMessage || obj.message)) {
      if (res.statusText && res.status) {
        throw new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message))
      }
      throw new Error((obj.errorMessage || obj.message))
    }
    throw new Error(res.statusText + ' (' + res.status + ')')
  }

  let resultObj = obj
  if (opt.overriddenOnly && obj) {
    const newObj = {}
    Object.keys(obj).forEach((k) => {
      if (obj[k].overrides !== undefined) {
        if (opt.raw) {
          newObj[k] = obj[k]
        } else {
          newObj[k] = obj[k].value
        }
      }
    })
    resultObj = newObj
  }

  return {
    result: opt.raw ? sortFlatResources(onlyKeysFlat(resultObj)) : sortFlatResources(flatten(resultObj)),
    next: res.headers.get('x-next-page'),
    lastModified: res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined
  }
}

const pullNamespace = async (opt, lng, ns) => {
  const ret = {}
  let lastModified = new Date(2000, 0, 1)
  let next = ''
  while (true) {
    const info = await pullNamespacePaged(opt, lng, ns, next)
    Object.keys(info.result).forEach((k) => {
      ret[k] = info.result[k]
    })
    if (info.lastModified && info.lastModified.getTime() > (lastModified ? lastModified.getTime() : 0)) {
      lastModified = info.lastModified
    }
    if (info.next) {
      next = info.next
      continue
    }
    break
  }
  return { result: ret, lastModified }
}

const getRemoteNamespace = async (opt, lng, ns) => {
  if (opt.unpublished) {
    const { result, lastModified } = await pullNamespace(opt, lng, ns)
    return { result, lastModified }
  }

  const { res, obj, err } = await request(opt.apiEndpoint + (opt.isPrivate ? '/private' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?ts=' + Date.now() + (opt.cdnType === 'standard' ? '&cache=no' : ''), {
    method: 'get',
    headers: opt.isPrivate
      ? {
          Authorization: opt.apiKey
        }
      : undefined
  })
  if (err) throw err
  const ignore404 = res.status === 404 && opt.cdnType === 'standard'
  if (ignore404) return { result: {}, lastModified: undefined }
  if (res.status >= 300) {
    if (obj && (obj.errorMessage || obj.message)) {
      if (res.statusText && res.status) {
        throw new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message))
      }
      throw new Error((obj.errorMessage || obj.message))
    }
    throw new Error(res.statusText + ' (' + res.status + ')')
  }
  return {
    result: sortFlatResources(flatten(obj)),
    lastModified: res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined
  }
}

export default getRemoteNamespace
