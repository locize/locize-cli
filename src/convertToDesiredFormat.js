import flatten from 'flat'
import gettextConv from 'gettext-converter'
import csv from 'fast-csv'
import xlsx from './vendor/xlsx/xlsx.mjs'
import yaml from 'yaml'
import asr from 'android-string-resource'
import stringsFile from 'strings-file'
import xliff from 'xliff'
import resx from 'resx'
import fluentConv from 'fluent_conv'
import tmexchange from 'tmexchange'
import laravelphp from 'laravelphp'
import javaProperties from '@js.properties/properties'
import colors from 'colors'
import unflatten from './unflatten.js'
import getRemoteNamespace from './getRemoteNamespace.js'
import removeUndefinedFromArrays from './removeUndefinedFromArrays.js'
import shouldUnflatten from './shouldUnflatten.js'
import { prepareExport as prepareCombinedExport } from './combineSubkeyPreprocessor.js'
import { GETTEXT_CTX_SEPARATOR } from './formats.js'

// a raw (unpublished) pull hands over { value, needsReview, ... } objects (see
// GETTEXT_FORMATS in download.js / sync.js): for the gettext formats reduce them
// to their text and turn the marks into "#, fuzzy"; a row without a text (context
// only) is left out like a plain pull leaves it out
const splitMarks = (data) => {
  const fuzzy = []
  const values = {}
  Object.keys(data || {}).forEach((k) => {
    const v = data[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof v.value !== 'string') return
      values[k] = v.value
      if (v.needsReview === true) fuzzy.push(k)
    } else {
      values[k] = v
    }
  })
  return { values, fuzzy }
}

const MAX_LISTED_KEYS = 10

// flattens what the export writes: unlike `flat`, an empty key (`{ "": { "leading": … } }`) gives `.leading`; an
// empty object or array stays a value, as `flat` keeps it in the input
const flattenOutput = (value, prefix, out = {}) => {
  if (value === null || typeof value !== 'object' || (prefix !== undefined && Object.keys(value).length === 0)) {
    out[prefix] = value
  } else {
    Object.keys(value).forEach((k) => flattenOutput(value[k], prefix === undefined ? k : `${prefix}.${k}`, out))
  }
  return out
}

// unflatten drops a value it cannot nest: a key below another key's value (`button` and `button.tooltip`), or a
// segment it reads as an array index that is none (`Saved.`, `errors..required`, `offset.-1`). Flattening the result
// again finds exactly those keys. Every language repeats the same keys, so one command run (one opt) reports a key
// once per namespace
const warnLostKeys = (opt, namespace, data, nested) => {
  // JSON, YAML and Fluent drop the non-index properties of an array; laravel writes them as PHP array keys
  const kept = flattenOutput(opt.format === 'laravel' ? nested : JSON.parse(JSON.stringify(nested)))
  const reported = (opt.reportedLostKeys ||= new Set())
  const lost = Object.keys(data || {}).filter((key) => {
    const id = JSON.stringify([namespace, key])
    if (JSON.stringify(kept[key]) === JSON.stringify(data[key]) || reported.has(id)) return false
    reported.add(id)
    return true
  })
  if (!lost.length) return nested
  const named = (key) => {
    let parent = key.indexOf('.')
    while (parent > 0 && !Object.prototype.hasOwnProperty.call(data, key.slice(0, parent))) parent = key.indexOf('.', parent + 1)
    return JSON.stringify(key) + (parent > 0 ? ` (below ${JSON.stringify(key.slice(0, parent))})` : '')
  }
  const listed = lost.slice(0, MAX_LISTED_KEYS).map(named).join(', ') +
    (lost.length > MAX_LISTED_KEYS ? `, and ${lost.length - MAX_LISTED_KEYS} more` : '')
  // json, nested, yaml-*, yml-* have a flat sibling format; laravel and fluent have none
  const flatFormat = ['json', 'nested'].includes(opt.format) ? 'flat' : /^ya?ml/.test(opt.format) ? opt.format.split('-')[0] : null
  const them = lost.length === 1 ? 'it' : 'them'
  const advice = flatFormat ? `Use --format ${flatFormat} to keep ${them}.` : `Rename ${them} to keep ${them}.`
  console.warn(colors.yellow(`Warning: the ${opt.format} export of namespace ${JSON.stringify(namespace)} loses ${lost.length} key${lost.length === 1 ? '' : 's'}: ${listed}. ${advice}`))
  return nested
}

const prepareNestedYaml = (opt, namespace, data) => shouldUnflatten(data) ? warnLostKeys(opt, namespace, data, unflatten(data)) : data

const convertToDesiredFormat = async (
  opt,
  namespace,
  lng,
  data,
  lastModified
) => {
  opt.getNamespace = opt.getNamespace || getRemoteNamespace
  const isEmpty = !data || Object.keys(data).length === 0
  if (opt.format === 'json' || opt.format === 'nested') {
    let nested
    try {
      nested = unflatten(data, opt.format === 'json')
    } catch (err) {} // some key mixes make unflatten throw: the namespace is then written flat, nothing is lost
    return JSON.stringify(nested ? warnLostKeys(opt, namespace, data, nested) : data, null, 2)
  }
  if (opt.format === 'flat') {
    return JSON.stringify(flatten(data), null, 2)
  }
  if (opt.format === 'po' || opt.format === 'gettext') {
    const { values, fuzzy } = splitMarks(data)
    const flatData = flatten(values)
    const gettextOpt = {
      project: 'locize',
      language: lng,
      potCreationDate: lastModified,
      poRevisionDate: lastModified,
      ctxSeparator: GETTEXT_CTX_SEPARATOR,
      persistMsgIdPlural: true,
      fuzzy
    }
    return gettextConv.i18next2po(lng, flatData, gettextOpt)
  }
  if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
    const { values, fuzzy } = splitMarks(data)
    const flatData = flatten(values)
    const compatibilityJSON = !!Object.keys(flatData).find((k) => /_(zero|one|two|few|many|other)/.test(k)) && 'v4'
    const gettextOpt = {
      project: 'locize',
      language: lng,
      potCreationDate: lastModified,
      poRevisionDate: lastModified,
      compatibilityJSON,
      fuzzy
    }
    return gettextConv.i18next2po(lng, flatData, gettextOpt)
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
    return yaml.stringify(prepareNestedYaml(opt, namespace, data))
  }
  if (
    opt.format === 'yaml-rails' ||
    opt.format === 'yml-rails'
  ) {
    if (isEmpty) return ''
    const newData = {}
    newData[lng] = prepareNestedYaml(opt, namespace, data)
    return yaml.stringify(removeUndefinedFromArrays(newData))
  }
  if (
    opt.format === 'yaml-rails-ns' ||
    opt.format === 'yml-rails-ns'
  ) {
    if (isEmpty) return ''
    const newDataNs = {}
    newDataNs[lng] = {}
    newDataNs[lng][namespace] = prepareNestedYaml(opt, namespace, data)
    return yaml.stringify(removeUndefinedFromArrays(newDataNs))
  }
  if (opt.format === 'android') {
    return await asr.js2asr(flatten(data))
  }
  if (opt.format === 'strings') {
    Object.keys(data).forEach((k) => {
      if (data[k] === null) delete data[k]
    })
    return stringsFile.compile(data)
  }
  if (['xliff2', 'xliff21', 'xliff22', 'xliff12', 'xlf2', 'xlf21', 'xlf22', 'xlf12'].indexOf(opt.format) > -1) {
    const refNs = await opt.getNamespace(opt, opt.referenceLanguage, namespace)
    const prepared = prepareCombinedExport(refNs, flatten(data))
    const js = await xliff.createjs(opt.referenceLanguage, lng, prepared.ref, prepared.trg, namespace)
    if (opt.format === 'xliff12' || opt.format === 'xlf12') {
      return await xliff.jsToXliff12(js, { inlineAsString: true })
    }
    let targetXliffVersion // default 2.0
    if (opt.format === 'xliff21' || opt.format === 'xlf21') targetXliffVersion = '2.1'
    if (opt.format === 'xliff22' || opt.format === 'xlf22') targetXliffVersion = '2.2'
    return await xliff.js2xliff(js, { targetXliffVersion, inlineAsString: true })
  }
  if (opt.format === 'resx') {
    return await resx.js2resx(flatten(data))
  }
  if (opt.format === 'fluent') {
    Object.keys(data).forEach((k) => {
      if (!data[k] || data[k] === '') {
        delete data[k]
        return
      }
      data[k] = data[k].replace(
        new RegExp(String.fromCharCode(160), 'g'),
        String.fromCharCode(32)
      )
    })
    return fluentConv.js2ftl(warnLostKeys(opt, namespace, data, unflatten(data)))
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
    return await tmexchange.js2tmx(js2TmxData)
  }
  if (opt.format === 'laravel') {
    return await laravelphp.js2laravel(warnLostKeys(opt, namespace, data, unflatten(data)))
  }
  if (opt.format === 'properties') {
    return javaProperties.stringifyFromProperties(data, { eol: '\n' })
  }
  throw new Error(`${opt.format} is not a valid format!`)
}

export default convertToDesiredFormat
