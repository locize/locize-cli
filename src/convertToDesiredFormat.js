import { flatten } from 'flat'
import i18next2po from 'gettext-converter/cjs/i18next2po'
import csv from 'fast-csv'
import xlsx from 'xlsx'
import yaml from 'yaml'
import js2asr from 'android-string-resource/cjs/js2asr'
import stringsFile from 'strings-file'
import createxliff from 'xliff/cjs/createxliff'
import createxliff12 from 'xliff/cjs/createxliff12'
import js2resx from 'resx/cjs/js2resx'
import js2ftl from 'fluent_conv/cjs/js2ftl'
import js2tmx from 'tmexchange/cjs/js2tmx'
import js2laravel from 'laravelphp/cjs/js2laravel'
import javaProperties from '@js.properties/properties'
import unflatten from './unflatten.js'
import getRemoteNamespace from './getRemoteNamespace.js'
import removeUndefinedFromArrays from './removeUndefinedFromArrays.js'
import shouldUnflatten from './shouldUnflatten.js'
import { prepareExport as prepareCombinedExport } from './combineSubkeyPreprocessor.js'

const convertToDesiredFormat = (
  opt,
  namespace,
  lng,
  data,
  lastModified,
  cb
) => {
  opt.getNamespace = opt.getNamespace || getRemoteNamespace
  const isEmpty = !data || Object.keys(data).length === 0
  try {
    if (opt.format === 'json') {
      try {
        data = unflatten(data, true)
      } catch (err) {}
      cb(null, JSON.stringify(data, null, 2))
      return
    }
    if (opt.format === 'nested') {
      try {
        data = unflatten(data)
      } catch (err) {}
      cb(null, JSON.stringify(data, null, 2))
      return
    }
    if (opt.format === 'flat') {
      cb(null, JSON.stringify(flatten(data), null, 2))
      return
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
      cb(null, i18next2po(lng, flatData, gettextOpt))
      return
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
      cb(null, i18next2po(lng, flatData, gettextOpt))
      return
    }
    if (opt.format === 'csv') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err)

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

        csv.writeToString(js2CsvData, { headers: true, quoteColumns: true })
          .then((data) => cb(null, `\ufeff${data}`))
          .catch(cb)
      })
      return
    }
    if (opt.format === 'xlsx') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err)

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

        const wbout = xlsx.write(workbook, { type: 'buffer' })

        cb(null, wbout)
      })
      return
    }
    if (
      opt.format === 'yaml' ||
      opt.format === 'yml'
    ) {
      if (isEmpty) return cb(null, '')
      cb(null, yaml.stringify(flatten(data)))
      return
    }
    if (
      opt.format === 'yaml-nested' ||
      opt.format === 'yml-nested'
    ) {
      if (isEmpty) return cb(null, '')
      cb(null, yaml.stringify(shouldUnflatten(data) ? unflatten(data) : data))
      return
    }
    if (
      opt.format === 'yaml-rails' ||
      opt.format === 'yml-rails'
    ) {
      if (isEmpty) return cb(null, '')
      const newData = {}
      newData[lng] = shouldUnflatten(data) ? unflatten(data) : data
      cb(null, yaml.stringify(removeUndefinedFromArrays(newData)))
      return
    }
    if (
      opt.format === 'yaml-rails-ns' ||
      opt.format === 'yml-rails-ns'
    ) {
      if (isEmpty) return cb(null, '')
      const newDataNs = {}
      newDataNs[lng] = {}
      newDataNs[lng][namespace] = shouldUnflatten(data) ? unflatten(data) : data
      cb(null, yaml.stringify(removeUndefinedFromArrays(newDataNs)))
      return
    }
    if (opt.format === 'android') {
      js2asr(flatten(data), cb)
      return
    }
    if (opt.format === 'strings') {
      Object.keys(data).forEach((k) => {
        if (data[k] === null) delete data[k]
      })
      data = stringsFile.compile(data)
      cb(null, data)
      return
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
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err)

        const prepared = prepareCombinedExport(refNs, flatten(data))
        fn(opt.referenceLanguage, lng, prepared.ref, prepared.trg, namespace, cb)
      })
      return
    }
    if (opt.format === 'resx') {
      js2resx(flatten(data), cb)
      return
    }
    if (opt.format === 'fluent') {
      Object.keys(data).forEach((k) => {
        if (!data[k] || data[k] === '') delete data[k]
        data[k] = data[k].replace(
          new RegExp(String.fromCharCode(160), 'g'),
          String.fromCharCode(32)
        )
      })
      js2ftl(unflatten(data), cb)
      return
    }
    if (opt.format === 'tmx') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err)

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
        js2tmx(js2TmxData, cb)
      })
      return
    }
    if (opt.format === 'laravel') {
      js2laravel(unflatten(data), cb)
      return
    }
    if (opt.format === 'properties') {
      cb(null, javaProperties.stringifyFromProperties(data, { eol: '\n' }))
      return
    }
    cb(new Error(`${opt.format} is not a valid format!`))
  } catch (err) {
    cb(err)
  }
}

export default convertToDesiredFormat
