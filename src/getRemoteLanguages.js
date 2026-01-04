import request from './request.js'

const getRemoteLanguages = async (opt) => {
  const { res, obj } = await request(opt.apiEndpoint + '/languages/' + opt.projectId + '?ts=' + Date.now() + (opt.cdnType === 'standard' ? '&cache=no' : ''), {
    method: 'get'
  })
  if ((obj && (obj.errorMessage || obj.message))) {
    if (res && res.statusText && res.status) {
      throw new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message))
    }
    throw new Error((obj.errorMessage || obj.message))
  }
  if (res.status >= 300) throw new Error(res.statusText + ' (' + res.status + ')')

  if (Object.keys(obj).length === 0) {
    throw new Error('Project with id "' + opt.projectId + '" not found!')
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
