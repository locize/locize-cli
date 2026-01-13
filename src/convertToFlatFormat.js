import gettextConv from 'gettext-converter'
import csv from 'fast-csv'
import xlsx from 'xlsx'
import yaml from 'yaml'
import asr from 'android-string-resource'
import stringsFile from 'strings-file'
import xliff from 'xliff'
import resx from 'resx'
import fluentConv from 'fluent_conv'
import tmexchange from 'tmexchange'
import laravelphp from 'laravelphp'
import javaProperties from '@js.properties/properties'
import xcstrings from 'locize-xcstrings'
import flatten from 'flat'
import { prepareImport as prepareCombinedImport } from './combineSubkeyPreprocessor.js'

const convertToFlatFormat = async (opt, data, lng) => {
  if (lng && typeof lng !== 'string') lng = undefined
  if (opt.format === 'json' || opt.format === 'nested' || opt.format === 'flat') {
    const dataString = data.toString().trim()
    if (dataString[0] !== '{' && dataString[0] !== '[') {
      throw new Error(`Not a valid json file: Content starts with "${dataString[0]}" but should start with "{"`)
    }
    const jsonParsed = JSON.parse(dataString)
    return flatten(jsonParsed)
  }
  if (opt.format === 'po' || opt.format === 'gettext') {
    const ret = gettextConv.po2i18next(data.toString(), {
      persistMsgIdPlural: true,
      ignoreCtx: true
    })
    return flatten(ret)
  }
  if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
    const potxt = data.toString()
    const compatibilityJSON = /msgctxt "(zero|one|two|few|many|other)"/.test(potxt) && 'v4'
    const ret = gettextConv.po2i18next(potxt, { compatibilityJSON })
    return flatten(ret)
  }
  if (opt.format === 'csv') {
    // CRLF => LF
    const text = data.toString().replace(/\r\n/g, '\n')
    const rows = await csv.parseString(text, { headers: true, ignoreEmpty: true }).promise()
    const result = rows.reduce((mem, entry) => {
      if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
        mem[entry.key] = entry[opt.referenceLanguage]
      }
      return mem
    }, {})
    return result
  }
  if (opt.format === 'xlsx') {
    const wb = xlsx.read(data, { type: 'buffer' })
    const jsonData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    const result = jsonData.reduce((mem, entry) => {
      if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
        mem[entry.key] = entry[opt.referenceLanguage]
      }
      return mem
    }, {})
    return result
  }
  if (
    opt.format === 'yaml' ||
    opt.format === 'yml'
  ) {
    const d = data.toString()
    if (!d || d === '' || d === '\n') return {}
    return flatten(yaml.parse(d))
  }
  if (
    opt.format === 'yaml-nested' ||
    opt.format === 'yml-nested'
  ) {
    const d = data.toString()
    if (!d || d === '' || d === '\n') return {}
    return flatten(yaml.parse(d))
  }
  if (
    opt.format === 'yaml-rails' ||
    opt.format === 'yml-rails'
  ) {
    const d = data.toString()
    if (!d || d.trim() === '') return {}
    const jsObj = yaml.parse(d)
    return flatten(jsObj[Object.keys(jsObj)[0]])
  }
  if (
    opt.format === 'yaml-rails-ns' ||
    opt.format === 'yml-rails-ns'
  ) {
    const dn = data.toString()
    if (!dn || dn.trim() === '') return {}
    const jsObjn = yaml.parse(dn)
    return flatten(jsObjn[Object.keys(jsObjn)[0]][Object.keys(jsObjn[Object.keys(jsObjn)[0]])[0]])
  }
  if (opt.format === 'android') {
    const res = await asr.asr2js(data.toString(), { comment: 'right' })
    Object.keys(res).forEach((k) => {
      if (res[k] !== 'string' && typeof res[k].comment === 'string') {
        res[k] = {
          value: res[k].value,
          context: {
            text: res[k].comment,
          },
        }
      } else {
        res[k] = { value: res[k].value || res[k] }
      }
    })
    return res
  }
  if (opt.format === 'strings') {
    // CRLF => LF
    return stringsFile.parse(data.toString().replace(/\r\n/g, '\n'), false)
  }
  if (
    opt.format === 'xliff2' ||
    opt.format === 'xliff12' ||
    opt.format === 'xlf2' ||
    opt.format === 'xlf12'
  ) {
    const fn =
      opt.format === 'xliff12' || opt.format === 'xlf12'
        ? xliff.xliff12ToJs
        : xliff.xliff2js
    const res = await fn(data.toString())
    res.resources = res.resources || {}
    const ns = Object.keys(res.resources)[0]
    const orgRes = res.resources[ns] || res.resources
    function checkForPostProcessing (nsRes) {
      Object.keys(nsRes).forEach((k) => {
        if (orgRes[k].note && (typeof nsRes[k] === 'string' || !nsRes[k])) {
          nsRes[k] = {
            value: nsRes[k],
            context: {
              text: orgRes[k].note,
            }
          }
        }
      })
      return prepareCombinedImport(nsRes)
    }
    if (!res.targetLanguage) {
      const ret = await xliff.sourceOfjs(res)
      return checkForPostProcessing(ret)
    } else {
      let ret = xliff.targetOfjs(res)
      if (lng !== opt.referenceLanguage) return checkForPostProcessing(ret)
      ret = ret || {}
      const keys = Object.keys(ret)
      if (keys.length === 0) return checkForPostProcessing(ret)
      const allEmpty = keys.filter((k) => ret[k] !== '').length === 0
      if (!allEmpty) return checkForPostProcessing(ret)
      ret = await xliff.sourceOfjs(res)
      return checkForPostProcessing(ret)
    }
  }
  if (opt.format === 'resx') {
    let res = await resx.resx2js(data.toString())
    res = Object.keys(res).reduce((mem, k) => {
      const value = res[k]
      if (typeof value === 'string') {
        mem[k] = value
      } else if (value.value) {
        mem[k] = {
          value: value.value,
          context: value.comment ? { text: value.comment } : null,
        }
      }
      return mem
    }, {})
    return res
  }
  if (opt.format === 'fluent') {
    const fluentJS = fluentConv.ftl2js(
      data
        .toString()
        .replace(
          new RegExp(String.fromCharCode(160), 'g'),
          String.fromCharCode(32)
        )
    )
    const comments = {}
    Object.keys(fluentJS).forEach((prop) => {
      if (fluentJS[prop] && fluentJS[prop].comment) {
        comments[prop] = fluentJS[prop].comment
        delete fluentJS[prop].comment
      }
    })
    const res = flatten(fluentJS)
    if (res && comments) {
      Object.keys(comments).forEach((prop) => {
        res[`${prop}.val`] = {
          value: res[`${prop}.val`],
          context: comments[prop] ? { text: comments[prop] } : null,
        }
      })
    }
    return res
  }
  if (opt.format === 'tmx') {
    const jsonData = await tmexchange.tmx2js(data.toString())
    const tmxJsRes = jsonData.resources[Object.keys(jsonData.resources)[0]]
    const res = {}
    if (tmxJsRes) {
      Object.keys(tmxJsRes).forEach((k) => {
        res[k] = tmxJsRes[k][opt.referenceLanguage]
      })
    }
    return res
  }
  if (opt.format === 'laravel') {
    const res = await laravelphp.laravel2js(data.toString())
    return flatten(res)
  }
  if (opt.format === 'properties') {
    return javaProperties.parseToProperties(data.toString())
  }
  if (opt.format === 'xcstrings') {
    return xcstrings.xcstrings2locize(data.toString())
  }
  throw new Error(`${opt.format} is not a valid format!`)
}

export default convertToFlatFormat
