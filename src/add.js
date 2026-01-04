import colors from 'colors'
import flatten from 'flat'
import getRemoteLanguages from './getRemoteLanguages.js'
import request from './request.js'

const _add = async (opt) => {
  const url = `${opt.apiEndpoint}/update/{{projectId}}/{{version}}/{{lng}}/{{ns}}`
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', opt.language)
    .replace('{{lng}}', opt.language)
    .replace('{{ns}}', opt.namespace)
    .replace('{{namespace}}', opt.namespace)

  if (!opt.data && (opt.value === undefined || opt.value === null)) {
    console.log(colors.yellow(`removing ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`))
  } else {
    console.log(colors.yellow(`adding ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`))
  }

  const data = flatten(opt.data || {})
  if (!opt.data) {
    data[opt.key] = opt.value || null // null will remove the key
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
      if (!opt.data && (opt.value === undefined || opt.value === null)) {
        console.log(colors.red(`remove failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`))
      } else {
        console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`))
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
    if (!opt.data && (opt.value === undefined || opt.value === null)) {
      console.log(colors.green(`removed ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`))
    } else {
      console.log(colors.green(`added ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`))
    }
  } catch (err) {
    if (!opt.data && (opt.value === undefined || opt.value === null)) {
      console.log(colors.red(`remove failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`))
    } else {
      console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`))
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
  if (!opt.data && (opt.value === undefined || opt.value === null)) {
    console.log(colors.green(`removed ${opt.namespace}/${opt.key} (${opt.version}) from all languages...`))
  } else {
    console.log(colors.green(`added ${opt.namespace}/${opt.key} (${opt.version}) in all languages...`))
  }
}

export default add
