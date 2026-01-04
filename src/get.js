import colors from 'colors'
import request from './request.js'
import flatten from 'flat'

const get = async (opt) => {
  const url = `${opt.apiEndpoint}/{{projectId}}/{{version}}/{{lng}}/{{ns}}`
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', opt.language)
    .replace('{{lng}}', opt.language)
    .replace('{{ns}}', opt.namespace)
    .replace('{{namespace}}', opt.namespace)

  if (opt.key && opt.key.indexOf(',') > 0 && opt.key.indexOf(' ') < 0) {
    opt.keys = opt.key.split(',')
    delete opt.key
  }

  const { res, obj, err } = await request(`${url}${opt.cdnType === 'standard' ? '?cache=no' : ''}`, {
    method: 'get'
  })
  if (err) {
    console.log(colors.red(`get failed for ${opt.key || (opt.keys && opt.keys.join(', '))} from ${opt.version}/${opt.language}/${opt.namespace}...`))
    throw err
  }
  const ignore404 = res.status === 404 && opt.cdnType === 'standard'
  if (res.status >= 300 && !ignore404) {
    console.error(colors.red(res.statusText + ' (' + res.status + ')'))
    throw new Error(res.statusText + ' (' + res.status + ')')
  }
  const flatObj = flatten(ignore404 ? {} : obj)
  if (opt.key) {
    if (!flatObj[opt.key]) {
      console.error(colors.red(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`))
      throw new Error(`${opt.key} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`)
    }
    console.log(flatObj[opt.key])
  }
  if (opt.keys) {
    const ret = {}
    const retWitAllKeys = {}
    opt.keys.forEach((k) => {
      if (flatObj[k] !== undefined) {
        ret[k] = flatObj[k]
      }
      retWitAllKeys[k] = flatObj[k]
    })
    const retKeys = Object.keys(ret)
    if (retKeys.length === 0) {
      console.error(colors.red(`${opt.keys.join(', ')} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`))
      throw new Error(`${opt.keys.join(', ')} not found in ${opt.version}/${opt.language}/${opt.namespace} => ${JSON.stringify(obj, null, 2)}`)
    }
    if (console.table) {
      console.table(retWitAllKeys)
    } else {
      opt.keys.forEach((k) => {
        console.log(`${k}\t=>\t${ret[k] || ''}`)
      })
    }
  }
}

export default get
