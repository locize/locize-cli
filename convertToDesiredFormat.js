const flatten = require('flat');
const i18next2po = require('gettext-converter/cjs/i18next2po');
const csvjson = require('csvjson');
const xlsx = require('xlsx');
const jsyaml = require('js-yaml');
const js2asr = require('android-string-resource/cjs/js2asr');
const stringsFile = require('strings-file');
const createxliff = require('xliff/cjs/createxliff');
const createxliff12 = require('xliff/cjs/createxliff12');
const js2resx = require('resx/cjs/js2resx');
const js2ftl = require('fluent_conv/cjs/js2ftl');
const js2tmx = require('tmexchange/cjs/js2tmx');
const js2laravel = require('laravelphp/cjs/js2laravel');
const javaProperties = require('@js.properties/properties');
const unflatten = require('./unflatten');
const getRemoteNamespace = require('./getRemoteNamespace');
const removeUndefinedFromArrays = require('./removeUndefinedFromArrays');
const shouldUnflatten = require('./shouldUnflatten');
const prepareCombinedExport = require('./combineSubkeyPreprocessor').prepareExport;

const convertToDesiredFormat = (
  opt,
  namespace,
  lng,
  data,
  lastModified,
  cb
) => {
  opt.getNamespace = opt.getNamespace || getRemoteNamespace;
  const isEmpty = !data || Object.keys(data).length === 0;
  try {
    if (opt.format === 'json') {
      try {
        data = unflatten(data);
      } catch (err) {}
      cb(null, JSON.stringify(data, null, 2));
      return;
    }
    if (opt.format === 'flat') {
      cb(null, JSON.stringify(flatten(data), null, 2));
      return;
    }
    if (opt.format === 'po' || opt.format === 'gettext') {
      const flatData = flatten(data);

      const gettextOpt = {
        project: 'locize',
        language: lng,
        potCreationDate: lastModified,
        poRevisionDate: lastModified,
        ctxSeparator: '_ is default but we set it to something that is never found!!!',
        persistMsgIdPlural: true
      };
      cb(null, i18next2po(lng, flatData, gettextOpt));
      return;
    }
    if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
      const flatData = flatten(data);
      const compatibilityJSON = !!Object.keys(flatData).find((k) => /_(zero|one|two|few|many|other)/.test(k)) && 'v4';
      const gettextOpt = {
        project: 'locize',
        language: lng,
        potCreationDate: lastModified,
        poRevisionDate: lastModified,
        compatibilityJSON
      };
      cb(null, i18next2po(lng, flatData, gettextOpt));
      return;
    }
    if (opt.format === 'csv') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const js2CsvData = Object.keys(flatten(data)).reduce((mem, k) => {
          const value = data[k] || '';
          const line = {
            // https://en.wikipedia.org/wiki/Delimiter-separated_values
            key: k.replace(/"/g, '""'),
            [opt.referenceLanguage]: refNs[k] || '',
            [lng]: value.replace(/"/g, '""')
          };
          line.key = line.key.replace(/\n/g, '\\NeWlInE\\');
          line[opt.referenceLanguage] = line[opt.referenceLanguage].replace(
            /\n/g,
            '\\NeWlInE\\'
          );
          line[lng] = line[lng].replace(/\n/g, '\\NeWlInE\\');
          mem.push(line);

          return mem;
        }, []);
        const options = {
          delimiter: ',',
          wrap: true,
          headers: 'relative'
          // objectDenote: '.',
          // arrayDenote: '[]'
        };
        cb(
          null,
          `\ufeff${csvjson
            .toCSV(js2CsvData, options)
            .replace(/\\NeWlInE\\/g, '\n')}`
        );
      });
      return;
    }
    if (opt.format === 'xlsx') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const js2XlsxData = Object.keys(flatten(data)).reduce((mem, k) => {
          const value = data[k] || '';
          const line = {
            key: k,
            [opt.referenceLanguage]: refNs[k] || '',
            [lng]: value
          };
          mem.push(line);

          return mem;
        }, []);

        const worksheet = xlsx.utils.json_to_sheet(js2XlsxData);
        const workbook = xlsx.utils.book_new();
        workbook.SheetNames.push(namespace);
        workbook.Sheets[namespace] = worksheet;

        const wbout = xlsx.write(workbook, { type: 'buffer' });

        cb(null, wbout);
      });
      return;
    }
    if (opt.format === 'yaml') {
      if (isEmpty) return cb(null, '');
      cb(null, jsyaml.dump(flatten(data)));
      return;
    }
    if (opt.format === 'yaml-nested') {
      if (isEmpty) return cb(null, '');
      cb(null, jsyaml.dump(shouldUnflatten(data) ? unflatten(data) : data));
      return;
    }
    if (opt.format === 'yaml-rails') {
      if (isEmpty) return cb(null, '');
      var newData = {};
      newData[lng] = {};
      newData[lng][namespace] = shouldUnflatten(data) ? unflatten(data) : data;
      cb(null, jsyaml.dump(removeUndefinedFromArrays(newData)));
      return;
    }
    if (opt.format === 'android') {
      js2asr(flatten(data), cb);
      return;
    }
    if (opt.format === 'strings') {
      Object.keys(data).forEach((k) => {
        if (data[k] === null) delete data[k];
      });
      data = stringsFile.compile(data);
      cb(null, data);
      return;
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
          : createxliff;
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const prepared = prepareCombinedExport(refNs, flatten(data));
        fn(opt.referenceLanguage, lng, prepared.ref, prepared.trg, namespace, cb);
      });
      return;
    }
    if (opt.format === 'resx') {
      js2resx(flatten(data), cb);
      return;
    }
    if (opt.format === 'fluent') {
      Object.keys(data).forEach((k) => {
        if (!data[k] || data[k] === '') delete data[k];
        data[k] = data[k].replace(
          new RegExp(String.fromCharCode(160), 'g'),
          String.fromCharCode(32)
        );
      });
      js2ftl(unflatten(data), cb);
      return;
    }
    if (opt.format === 'tmx') {
      opt.getNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const js = flatten(data);
        const js2TmxData = Object.keys(js).reduce(
          (mem, k) => {
            const refItem = refNs[k];
            if (!refItem) return mem;

            const value = js[k] || '';
            mem.resources[namespace][k] = {};
            mem.resources[namespace][k][opt.referenceLanguage] = refItem;
            mem.resources[namespace][k][lng] = value;

            return mem;
          },
          {
            resources: {
              [namespace]: {}
            },
            sourceLanguage: opt.referenceLanguage
          }
        );
        js2tmx(js2TmxData, cb);
      });
      return;
    }
    if (opt.format === 'laravel') {
      js2laravel(unflatten(data), cb);
      return;
    }
    if (opt.format === 'properties') {
      cb(null, javaProperties.stringifyFromProperties(data, { eol: '\n' }));
      return;
    }
    cb(new Error(`${opt.format} is not a valid format!`));
  } catch (err) {
    cb(err);
  }
};

module.exports = convertToDesiredFormat;
