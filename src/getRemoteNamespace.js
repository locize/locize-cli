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

const pullNamespacePaged = (opt, lng, ns, cb, next, retry) => {
  next = next || ''
  request(opt.apiEndpoint + '/pull/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?' + 'next=' + next + ((opt.raw || opt.overriddenOnly) ? '&raw=true' : '') + '&ts=' + Date.now(), {
    method: 'get',
    headers: {
      Authorization: opt.apiKey
    }
  }, (err, res, obj) => {
    if (err) return cb(err)
    if (res.status >= 300) {
      retry = retry || 0
      if (retry < 3 && res.status !== 401) {
        setTimeout(() => {
          pullNamespacePaged(opt, lng, ns, cb, next, retry + 1)
        }, getRandomDelay(3000, 10000))
        return
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (res.statusText && res.status) {
          return cb(new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message)))
        }
        return cb(new Error((obj.errorMessage || obj.message)))
      }
      return cb(new Error(res.statusText + ' (' + res.status + ')'))
    }

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
      obj = newObj
    }

    cb(null, {
      result: opt.raw ? sortFlatResources(onlyKeysFlat(obj)) : sortFlatResources(flatten(obj)),
      next: res.headers.get('x-next-page'),
      lastModified: res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined
    })
  })
}

const pullNamespace = (opt, lng, ns, cb) => {
  const ret = {}
  let lastModified = new Date(2000, 0, 1);
  (function nextPage (next) {
    pullNamespacePaged(opt, lng, ns, (err, info) => {
      if (err) return cb(err)

      Object.keys(info.result).forEach((k) => {
        ret[k] = info.result[k]
      })

      if (info.lastModified && info.lastModified.getTime() > (lastModified ? lastModified.getTime() : 0)) {
        lastModified = info.lastModified
      }

      if (info.next) {
        return nextPage(info.next)
      }
      cb(null, ret, lastModified)
    }, next)
  })()
}

const getRemoteNamespace = (opt, lng, ns, cb) => {
  if (opt.unpublished) return pullNamespace(opt, lng, ns, cb)

  request(opt.apiEndpoint + (opt.isPrivate ? '/private' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?ts=' + Date.now() + (opt.cdnType === 'standard' ? '&cache=no' : ''), {
    method: 'get',
    headers: opt.isPrivate
      ? {
          Authorization: opt.apiKey
        }
      : undefined
  }, (err, res, obj) => {
    if (err) return cb(err)
    const ignore404 = res.status === 404 && opt.cdnType === 'standard'
    if (ignore404) return cb(null, {}, undefined)
    if (res.status >= 300) {
      if (obj && (obj.errorMessage || obj.message)) {
        if (res.statusText && res.status) {
          return cb(new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message)))
        }
        return cb(new Error((obj.errorMessage || obj.message)))
      }
      return cb(new Error(res.statusText + ' (' + res.status + ')'))
    }
    cb(null, sortFlatResources(flatten(obj)), res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined)
  })
}

export default getRemoteNamespace
