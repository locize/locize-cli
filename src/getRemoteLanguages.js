import request from './request.js'

const getOtherApiEndpoint = (apiEndpoint) => {
  if (apiEndpoint.indexOf('.lite.locize.') > 0) {
    return apiEndpoint.replace('.lite.locize.', '.locize.')
  } else if (apiEndpoint.indexOf('.locize.') > 0) {
    return apiEndpoint.replace('.locize.', '.lite.locize.')
  }
}

const getRemoteLanguages = async (opt) => {
  const { res, obj } = await request(opt.apiEndpoint + '/languages/' + opt.projectId + '?ts=' + Date.now() + (opt.cdnType === 'standard' ? '&cache=no' : ''), { method: 'get' })
  if ((obj && (obj.errorMessage || obj.message))) {
    if (res && res.statusText && res.status) {
      throw new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message))
    }
    throw new Error((obj.errorMessage || obj.message))
  }
  if (res.status >= 300) throw new Error(res.statusText + ' (' + res.status + ')')

  if (Object.keys(obj).length === 0) {
    let errMsg = 'Project with id "' + opt.projectId + '" not found!'
    const otherEndpoint = getOtherApiEndpoint(opt.apiEndpoint)
    const { res: res2, obj: obj2 } = await request(otherEndpoint + '/languages/' + opt.projectId + '?ts=' + Date.now() + (opt.cdnType === 'standard' ? '' : '&cache=no'), { method: 'get' })
    if (res2.status === 200 && Object.keys(obj2).length > 0) {
      errMsg += ` It seems you're using the wrong cdnType. Your Locize project is configured to use "${opt.cdnType === 'standard' ? 'pro' : 'standard'}" but here you've configured "${opt.cdnType}".`
    }
    throw new Error(errMsg)
  }

  const lngs = Object.keys(obj)
  let foundRefLng = null
  lngs.forEach((l) => {
    if (obj[l].isReferenceLanguage) foundRefLng = l
  })
  if (!foundRefLng) {
    throw new Error('Reference language for project with id "' + opt.projectId + '" not found!')
  }
  opt.referenceLanguage = foundRefLng

  // reflng first
  lngs.splice(lngs.indexOf(opt.referenceLanguage), 1)
  lngs.unshift(opt.referenceLanguage)

  return lngs
}

export default getRemoteLanguages
