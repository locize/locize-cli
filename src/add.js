import colors from 'colors'
import flatten from 'flat'
import getRemoteLanguages from './getRemoteLanguages.js'
import request from './request.js'

const payloadOf = (opt) => {
  const data = flatten(opt.data || {})
  if (!opt.data) {
    data[opt.key] = opt.value || null // null will remove the key
  }
  return data
}

const isRemoval = (data) => Object.keys(data).length > 0 && Object.values(data).every((v) => v === undefined || v === null)

const keyLabel = (opt, data) => opt.key || Object.keys(data).join(', ')

const _add = async (opt) => {
  const url = `${opt.apiEndpoint}/update/{{projectId}}/{{version}}/{{lng}}/{{ns}}`
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', opt.language)
    .replace('{{lng}}', opt.language)
    .replace('{{ns}}', opt.namespace)
    .replace('{{namespace}}', opt.namespace)

  const data = payloadOf(opt)
  const removing = isRemoval(data)
  const label = keyLabel(opt, data)

  if (removing) {
    console.log(colors.yellow(`removing ${label} from ${opt.version}/${opt.language}/${opt.namespace}...`))
  } else {
    console.log(colors.yellow(`adding ${label} to ${opt.version}/${opt.language}/${opt.namespace}...`))
  }

  try {
    const { res, obj } = await request(url, {
      method: 'post',
      headers: {
        Authorization: opt.apiKey
      },
      body: data
    })
    if (res.status >= 300 && res.status !== 412) {
      if (removing) {
        console.log(colors.red(`remove failed for ${label} from ${opt.version}/${opt.language}/${opt.namespace}...`))
      } else {
        console.log(colors.red(`add failed for ${label} to ${opt.version}/${opt.language}/${opt.namespace}...`))
      }
      if (obj && (obj.errorMessage || obj.message)) {
        console.error(colors.red((obj.errorMessage || obj.message)))
        process.exit(1)
      } else {
        console.error(colors.red(res.statusText + ' (' + res.status + ')'))
        process.exit(1)
      }
      return
    }
    if (removing) {
      console.log(colors.green(`removed ${label} from ${opt.version}/${opt.language}/${opt.namespace}...`))
    } else {
      console.log(colors.green(`added ${label} to ${opt.version}/${opt.language}/${opt.namespace}...`))
    }
  } catch (err) {
    if (removing) {
      console.log(colors.red(`remove failed for ${label} from ${opt.version}/${opt.language}/${opt.namespace}...`))
    } else {
      console.log(colors.red(`add failed for ${label} to ${opt.version}/${opt.language}/${opt.namespace}...`))
    }
    console.error(colors.red(err.message))
    process.exit(1)
  }
}

const add = async (opt) => {
  if (opt.language) return _add(opt)

  let lngs
  try {
    lngs = await getRemoteLanguages(opt)
  } catch (err) {
    console.error(colors.red(err.message))
    process.exit(1)
  }

  for (const lng of lngs) {
    opt.language = lng
    await _add(opt)
  }
  const data = payloadOf(opt)
  if (isRemoval(data)) {
    console.log(colors.green(`removed ${opt.namespace}/${keyLabel(opt, data)} (${opt.version}) from all languages...`))
  } else {
    console.log(colors.green(`added ${opt.namespace}/${keyLabel(opt, data)} (${opt.version}) in all languages...`))
  }
}

export default add
