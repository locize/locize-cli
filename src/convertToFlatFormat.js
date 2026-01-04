import po2i18next from 'gettext-converter/cjs/po2i18next'
import csv from 'fast-csv'
import xlsx from 'xlsx'
import yaml from 'yaml'
import asr2js from 'android-string-resource/cjs/asr2js'
import stringsFile from 'strings-file'
import xliff2js from 'xliff/cjs/xliff2js'
import xliff12ToJs from 'xliff/cjs/xliff12ToJs'
import targetOfjs from 'xliff/cjs/targetOfjs'
import sourceOfjs from 'xliff/cjs/sourceOfjs'
import resx2js from 'resx/cjs/resx2js'
import ftl2js from 'fluent_conv/cjs/ftl2js'
import tmx2js from 'tmexchange/cjs/tmx2js'
import laravel2js from 'laravelphp/cjs/laravel2js'
import javaProperties from '@js.properties/properties'
import xcstrings2locize from 'locize-xcstrings/cjs/xcstrings2locize'
import flatten from 'flat'
import { prepareImport as prepareCombinedImport } from './combineSubkeyPreprocessor.js'

const convertToFlatFormat = (opt, data, lng, cb) => {
  if (!cb) {
    cb = lng
    lng = undefined
  }
  try {
    if (opt.format === 'json' || opt.format === 'nested' || opt.format === 'flat') {
      const dataString = data.toString().trim()
      if (dataString[0] !== '{' && dataString[0] !== '[') {
        return cb(new Error(`Not a valid json file: Content starts with "${dataString[0]}" but should start with "{"`))
      }
      try {
        const jsonParsed = JSON.parse(dataString)
        cb(null, flatten(jsonParsed))
      } catch (err) {
        return cb(err)
      }
      return
    }
    if (opt.format === 'po' || opt.format === 'gettext') {
      try {
        const ret = po2i18next(data.toString(), {
          persistMsgIdPlural: true,
          ignoreCtx: true
        })
        cb(null, flatten(ret))
      } catch (err) {
        cb(err)
      }
      return
    }
    if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
      try {
        const potxt = data.toString()
        const compatibilityJSON = /msgctxt "(zero|one|two|few|many|other)"/.test(potxt) && 'v4'
        const ret = po2i18next(potxt, { compatibilityJSON })
        cb(null, flatten(ret))
      } catch (err) {
        cb(err)
      }
      return
    }
    if (opt.format === 'csv') {
      // CRLF => LF
      const text = data.toString().replace(/\r\n/g, '\n')

      const res = []
      csv.parseString(text, { headers: true, ignoreEmpty: true })
        .on('error', cb)
        .on('data', (row) => res.push(row))
        .on('end', () => {
          try {
            data = res.reduce((mem, entry) => {
              if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
                mem[entry.key] = entry[opt.referenceLanguage]
              }
              return mem
            }, {})
            cb(null, data)
          } catch (err) {
            cb(err)
          }
        })
      return
    }
    if (opt.format === 'xlsx') {
      const wb = xlsx.read(data, { type: 'buffer' })
      const jsonData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      data = jsonData.reduce((mem, entry) => {
        if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
          mem[entry.key] = entry[opt.referenceLanguage]
        }
        return mem
      }, {})
      cb(null, data)
      return
    }
    if (
      opt.format === 'yaml' ||
      opt.format === 'yml'
    ) {
      const d = data.toString()
      if (!d || d === '' || d === '\n') return cb(null, {})
      cb(null, flatten(yaml.parse(d)))
      return
    }
    if (
      opt.format === 'yaml-nested' ||
      opt.format === 'yml-nested'
    ) {
      const d = data.toString()
      if (!d || d === '' || d === '\n') return cb(null, {})
      cb(null, flatten(yaml.parse(d)))
      return
    }
    if (
      opt.format === 'yaml-rails' ||
      opt.format === 'yml-rails'
    ) {
      const d = data.toString()
      if (!d || d.trim() === '') return cb(null, {})
      const jsObj = yaml.parse(d)
      cb(
        null,
        flatten(
          jsObj[Object.keys(jsObj)[0]]
        )
      )
      return
    }
    if (
      opt.format === 'yaml-rails-ns' ||
      opt.format === 'yml-rails-ns'
    ) {
      const dn = data.toString()
      if (!dn || dn.trim() === '') return cb(null, {})
      const jsObjn = yaml.parse(dn)
      cb(
        null,
        flatten(
          jsObjn[Object.keys(jsObjn)[0]][
            Object.keys(jsObjn[Object.keys(jsObjn)[0]])[0]
          ]
        )
      )
      return
    }
    if (opt.format === 'android') {
      asr2js(data.toString(), { comment: 'right' }, (err, res) => {
        if (err) return cb(err)
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
        cb(null, res)
      })
      return
    }
    if (opt.format === 'strings') {
      // CRLF => LF
      data = stringsFile.parse(data.toString().replace(/\r\n/g, '\n'), false)
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
          ? xliff12ToJs
          : xliff2js
      fn(data.toString(), (err, res) => {
        if (err) return cb(err)
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
          sourceOfjs(res, (err, ret) => {
            if (err) return cb(err)
            cb(null, checkForPostProcessing(ret))
          })
        } else {
          let ret = targetOfjs(res)
          if (lng !== opt.referenceLanguage) return cb(null, checkForPostProcessing(ret))
          ret = ret || {}
          const keys = Object.keys(ret)
          if (keys.length === 0) return cb(null, checkForPostProcessing(ret))
          const allEmpty = keys.filter((k) => ret[k] !== '').length === 0
          if (!allEmpty) return cb(null, checkForPostProcessing(ret))
          ret = sourceOfjs(res)
          cb(null, checkForPostProcessing(ret))
        }
      })
      return
    }
    if (opt.format === 'resx') {
      resx2js(data.toString(), (err, res) => {
        if (err) return cb(err)
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
        cb(null, res)
      })
      return
    }
    if (opt.format === 'fluent') {
      const fluentJS = ftl2js(
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
      cb(null, res)
      return
    }
    if (opt.format === 'tmx') {
      tmx2js(data.toString(), (err, jsonData) => {
        if (err) return cb(err)
        const tmxJsRes = jsonData.resources[Object.keys(jsonData.resources)[0]]
        const res = {}
        if (tmxJsRes) {
          Object.keys(tmxJsRes).forEach((k) => {
            res[k] = tmxJsRes[k][opt.referenceLanguage]
          })
        }
        cb(null, res)
      })
      return
    }
    if (opt.format === 'laravel') {
      laravel2js(data.toString(), (err, res) => cb(err, flatten(res)))
      return
    }
    if (opt.format === 'properties') {
      cb(null, javaProperties.parseToProperties(data.toString()))
      return
    }
    if (opt.format === 'xcstrings') {
      cb(null, xcstrings2locize(data.toString()))
      return
    }
    cb(new Error(`${opt.format} is not a valid format!`))
  } catch (err) {
    cb(err)
  }
}

export default convertToFlatFormat
