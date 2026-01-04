import flatten from 'flat'
import i18next2po from 'gettext-converter/i18next2po'
import csv from 'fast-csv'
import xlsx from 'xlsx'
import yaml from 'yaml'
import js2asr from 'android-string-resource/js2asr'
import stringsFile from 'strings-file'
import createxliff from 'xliff/createxliff'
import createxliff12 from 'xliff/createxliff12'
import js2resx from 'resx/js2resx'
import js2ftl from 'fluent_conv/js2ftl'
import js2tmx from 'tmexchange/js2tmx'
import js2laravel from 'laravelphp/js2laravel'
import javaProperties from '@js.properties/properties'
import unflatten from './unflatten.js'
import getRemoteNamespace from './getRemoteNamespace.js'
import removeUndefinedFromArrays from './removeUndefinedFromArrays.js'
import shouldUnflatten from './shouldUnflatten.js'
import { prepareExport as prepareCombinedExport } from './combineSubkeyPreprocessor.js'

const convertToDesiredFormat = async (
  opt,
  namespace,
  lng,
  data,
  lastModified
) => {
  opt.getNamespace = opt.getNamespace || getRemoteNamespace
  const isEmpty = !data || Object.keys(data).length === 0
  if (opt.format === 'json') {
    try {
      data = unflatten(data, true)
    } catch (err) {}
    return JSON.stringify(data, null, 2)
  }
  if (opt.format === 'nested') {
    try {
      data = unflatten(data)
    } catch (err) {}
    return JSON.stringify(data, null, 2)
  }
  if (opt.format === 'flat') {
    return JSON.stringify(flatten(data), null, 2)
  }
  if (opt.format === 'po' || opt.format === 'gettext') {
    const flatData = flatten(data)
    const gettextOpt = {
      project: 'locize',
      language: lng,
      potCreationDate: lastModified,
      poRevisionDate: lastModified,
      ctxSeparator: '_ is default but we set it to something that is never found!!!',
      persistMsgIdPlural: true
    }
    return i18next2po(lng, flatData, gettextOpt)
  }
  if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
    const flatData = flatten(data)
    const compatibilityJSON = !!Object.keys(flatData).find((k) => /_(zero|one|two|few|many|other)/.test(k)) && 'v4'
    const gettextOpt = {
      project: 'locize',
      language: lng,
      potCreationDate: lastModified,
      poRevisionDate: lastModified,
      compatibilityJSON
    }
    return i18next2po(lng, flatData, gettextOpt)
  }
  if (opt.format === 'csv') {
    const refNs = await opt.getNamespace(opt, opt.referenceLanguage, namespace)
    const js2CsvData = Object.keys(flatten(data)).reduce((mem, k) => {
      const value = data[k] || ''
      const line = {
        key: k,
        [opt.referenceLanguage]: refNs[k] || '',
        [lng]: value
      }
      mem.push(line)
      return mem
    }, [])
    return `\ufeff${await csv.writeToString(js2CsvData, { headers: true, quoteColumns: true })}`
  }
  if (opt.format === 'xlsx') {
    const refNs = await opt.getNamespace(opt, opt.referenceLanguage, namespace)
    const js2XlsxData = Object.keys(flatten(data)).reduce((mem, k) => {
      const value = data[k] || ''
      const line = {
        key: k,
        [opt.referenceLanguage]: refNs[k] || '',
        [lng]: value
      }
      mem.push(line)
      return mem
    }, [])
    const worksheet = xlsx.utils.json_to_sheet(js2XlsxData)
    const workbook = xlsx.utils.book_new()
    let workSheetName = namespace
    if (workSheetName.length > 31) workSheetName = workSheetName.substring(0, 31)
    workbook.SheetNames.push(workSheetName)
    workbook.Sheets[workSheetName] = worksheet
    return xlsx.write(workbook, { type: 'buffer' })
  }
  if (
    opt.format === 'yaml' ||
    opt.format === 'yml'
  ) {
    if (isEmpty) return ''
    return yaml.stringify(flatten(data))
  }
  if (
    opt.format === 'yaml-nested' ||
    opt.format === 'yml-nested'
  ) {
    if (isEmpty) return ''
    return yaml.stringify(shouldUnflatten(data) ? unflatten(data) : data)
  }
  if (
    opt.format === 'yaml-rails' ||
    opt.format === 'yml-rails'
  ) {
    if (isEmpty) return ''
    const newData = {}
    newData[lng] = shouldUnflatten(data) ? unflatten(data) : data
    return yaml.stringify(removeUndefinedFromArrays(newData))
  }
  if (
    opt.format === 'yaml-rails-ns' ||
    opt.format === 'yml-rails-ns'
  ) {
    if (isEmpty) return ''
    const newDataNs = {}
    newDataNs[lng] = {}
    newDataNs[lng][namespace] = shouldUnflatten(data) ? unflatten(data) : data
    return yaml.stringify(removeUndefinedFromArrays(newDataNs))
  }
  if (opt.format === 'android') {
    return await js2asr(flatten(data))
  }
  if (opt.format === 'strings') {
    Object.keys(data).forEach((k) => {
      if (data[k] === null) delete data[k]
    })
    return stringsFile.compile(data)
  }
  if (
    opt.format === 'xliff2' ||
    opt.format === 'xliff12' ||
    opt.format === 'xlf2' ||
    opt.format === 'xlf12'
  ) {
    const fn =
      opt.format === 'xliff12' || opt.format === 'xlf12'
        ? createxliff12
        : createxliff
    const refNs = await opt.getNamespace(opt, opt.referenceLanguage, namespace)
    const prepared = prepareCombinedExport(refNs, flatten(data))
    return await fn(opt.referenceLanguage, lng, prepared.ref, prepared.trg, namespace)
  }
  if (opt.format === 'resx') {
    return await js2resx(flatten(data))
  }
  if (opt.format === 'fluent') {
    Object.keys(data).forEach((k) => {
      if (!data[k] || data[k] === '') delete data[k]
      data[k] = data[k].replace(
        new RegExp(String.fromCharCode(160), 'g'),
        String.fromCharCode(32)
      )
    })
    return js2ftl(unflatten(data))
  }
  if (opt.format === 'tmx') {
    const refNs = await opt.getNamespace(opt, opt.referenceLanguage, namespace)
    const js = flatten(data)
    const js2TmxData = Object.keys(js).reduce(
      (mem, k) => {
        const refItem = refNs[k]
        if (!refItem) return mem
        const value = js[k] || ''
        mem.resources[namespace][k] = {}
        mem.resources[namespace][k][opt.referenceLanguage] = refItem
        mem.resources[namespace][k][lng] = value
        return mem
      },
      {
        resources: {
          [namespace]: {}
        },
        sourceLanguage: opt.referenceLanguage
      }
    )
    return await js2tmx(js2TmxData)
  }
  if (opt.format === 'laravel') {
    return await js2laravel(unflatten(data))
  }
  if (opt.format === 'properties') {
    return javaProperties.stringifyFromProperties(data, { eol: '\n' })
  }
  throw new Error(`${opt.format} is not a valid format!`)
}

export default convertToDesiredFormat
