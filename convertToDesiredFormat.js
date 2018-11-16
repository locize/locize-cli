const flatten = require('flat');
const i18nextToPo = require('i18next-conv').i18nextToPo;
const csvjson = require('csvjson');
const xlsx = require('xlsx');
const jsyaml = require('js-yaml');
const js2asr = require('android-string-resource/js2asr');
const stringsFile = require('strings-file');
const createxliff = require('xliff/createxliff');
const createxliff12 = require('xliff/createxliff12');
const js2resx = require('resx/js2resx');
const js2ftl = require('fluent_conv/js2ftl');
const js2tmx = require('tmexchange/js2tmx');
const js2laravel = require('laravelphp/js2laravel');
const unflatten = require('./unflatten');
const getRemoteNamespace = require('./getRemoteNamespace');
const removeUndefinedFromArrays = require('./removeUndefinedFromArrays');

const convertToDesiredFormat = (opt, namespace, lng, data, lastModified, cb) => {
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
      i18nextToPo(lng, JSON.stringify(flatten(data)), { project: 'locize', language: lng, potCreationDate: lastModified, poRevisionDate: lastModified, ctxSeparator: '_ is default but we set it to something that is never found!!!', ignorePlurals: true })
        .then((ret) => {
          cb(null, ret.toString());
        }, cb);
      return;
    }
    if (opt.format === 'po_i18next' || opt.format === 'gettext_i18next') {
      i18nextToPo(lng, JSON.stringify(flatten(data)), { project: 'locize', language: lng, potCreationDate: lastModified, poRevisionDate: lastModified })
        .then((ret) => {
          cb(null, ret.toString());
        }, cb);
      return;
    }
    if (opt.format === 'csv') {
      getRemoteNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const js2CsvData = Object.keys(flatten(data)).reduce((mem, k) => {
          const value = data[k] || '';
          const line = { // https://en.wikipedia.org/wiki/Delimiter-separated_values
            key: k.replace(/"/g, '""'),
            [opt.referenceLanguage]: refNs[k] || '',
            [lng]: value.replace(/"/g, '""')
          };
          mem.push(line);

          return mem;
        }, []);
        const options = {
          delimiter: ',',
          wrap: true,
          headers: 'relative',
          // objectDenote: '.',
          // arrayDenote: '[]'
        };
        cb(null, csvjson.toCSV(js2CsvData, options));
      });
      return;
    }
    if (opt.format === 'xlsx') {
      getRemoteNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
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
      cb(null, jsyaml.safeDump(flatten(data)));
      return;
    }
    if (opt.format === 'yaml-rails') {
      var newData = {};
      newData[lng] = {};
      newData[lng][namespace] = unflatten(data);
      cb(null, jsyaml.safeDump(removeUndefinedFromArrays(newData)));
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
    if (opt.format === 'xliff2' || opt.format === 'xliff12') {
      const fn = opt.format === 'xliff12' ? createxliff12 : createxliff;
      getRemoteNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        fn(
          opt.referenceLanguage,
          lng,
          refNs,
          flatten(data),
          namespace,
          cb
        );
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
        data[k] = data[k].replace(new RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32));
      });
      js2ftl(unflatten(data), cb);
      return;
    }
    if (opt.format === 'tmx') {
      getRemoteNamespace(opt, opt.referenceLanguage, namespace, (err, refNs) => {
        if (err) return cb(err);

        const js = flatten(data);
        const js2TmxData = Object.keys(js).reduce((mem, k) => {
          const refItem = refNs[k];
          if (!refItem) return mem;

          const value = js[k] || '';
          mem.resources[namespace][k] = {};
          mem.resources[namespace][k][opt.referenceLanguage] = refItem;
          mem.resources[namespace][k][lng] = value;

          return mem;
        }, {
          resources: {
            [namespace]: {}
          },
          sourceLanguage: opt.referenceLanguage
        });
        js2tmx(js2TmxData, cb);
      });
      return;
    }
    if (opt.format === 'laravel') {
      js2laravel(flatten(data), cb);
      return;
    }
    cb(new Error(`${opt.format} is not a valid format!`));
  } catch (err) { cb(err); }
};

module.exports = convertToDesiredFormat;
