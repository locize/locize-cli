const gettextToI18next = require('i18next-conv').gettextToI18next;
const csvjson = require('csvjson');
const xlsx = require('xlsx');
const jsyaml = require('js-yaml');
const asr2js = require('android-string-resource/asr2js');
const stringsFile = require('strings-file');
const xliff2js = require('xliff/xliff2js');
const xliff12ToJs = require('xliff/xliff12ToJs');
const targetOfjs = require('xliff/targetOfjs');
const sourceOfjs = require('xliff/sourceOfjs');
const resx2js = require('resx/resx2js');
const ftl2js = require('fluent_conv/ftl2js');
const tmx2js = require('tmexchange/tmx2js');
const laravel2js = require('laravelphp/laravel2js');
const flatten = require('flat');

const convertToFlatFormat = (opt, data, cb) => {
  try {
    if (opt.format === 'json' || opt.format === 'flat') {
      cb(null, flatten(JSON.parse(data.toString())));
      return;
    }
    if (opt.format === 'po' || opt.format === 'gettext') {
      try {
        gettextToI18next(opt.referenceLanguage, data.toString())
          .then((ret) => {
            try {
              cb(null, flatten(JSON.parse(ret.toString())));
            } catch (err) { cb(err); }
          }, cb);
      } catch (err) { cb(err); }
      return;
    }
    if (opt.format === 'csv') {
      const options = {
        delimiter: ',',
        quote: '"'
      };

      // CRLF => LF
      var text = data.toString().replace(/\r\n/g, '\n');

      // handle multiline stuff
      const lines = text.split('\n');
      const toHandle = [];
      lines.forEach((l) => {
        const amountOfOccurrencies = l.split('"').length - 1;
        if (amountOfOccurrencies % 2 === 1) toHandle.push(l);
      });
      while (toHandle.length > 1) {
        var firstToHandle = toHandle.shift();
        const secondToHandle = toHandle.shift();
        const indexOfFirst = lines.indexOf(firstToHandle);
        const indexOfSecond = lines.indexOf(secondToHandle);
        var handlingIndex = indexOfFirst;
        while (handlingIndex < indexOfSecond) {
          firstToHandle += `\\NeWlInE\\${lines[handlingIndex + 1]}`;
          handlingIndex++;
        }
        lines[indexOfFirst] = firstToHandle;
        lines.splice(indexOfFirst + 1, indexOfSecond - indexOfFirst);
      }
      text = lines.join('\n');

      // https://en.wikipedia.org/wiki/Delimiter-separated_values
      // temporary replace "" with \_\" so we can revert this 3 lines after
      const jsonData = csvjson.toObject(text.replace(/""/g, '\\_\\"'), options);
      data = jsonData.reduce((mem, entry) => {
        if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
          mem[entry.key.replace(/\\_\\"/g, '"').replace(/\\NeWlInE\\/g, '\n')] = entry[opt.referenceLanguage].replace(/\\_\\"/g, '"').replace(/\\NeWlInE\\/g, '\n');
        }
        return mem;
      }, {});
      cb(null, data);
      return;
    }
    if (opt.format === 'xlsx') {
      const wb = xlsx.read(data, { type: 'buffer' });
      const jsonData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      data = jsonData.reduce((mem, entry) => {
        if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
          mem[entry.key] = entry[opt.referenceLanguage];
        }
        return mem;
      }, {});
      cb(null, data);
      return;
    }
    if (opt.format === 'yaml') {
      cb(null, flatten(jsyaml.safeLoad(data)));
      return;
    }
    if (opt.format === 'yaml-rails') {
      const jsObj = jsyaml.safeLoad(data);
      cb(null, flatten(jsObj[Object.keys(jsObj)[0]][Object.keys(jsObj[Object.keys(jsObj)[0]])[0]]));
      return;
    }
    if (opt.format === 'android') {
      asr2js(data.toString(), cb);
      return;
    }
    if (opt.format === 'strings') {
      // CRLF => LF
      data = stringsFile.parse(data.toString().replace(/\r\n/g, '\n'), false);
      cb(null, data);
      return;
    }
    if (opt.format === 'xliff2' || opt.format === 'xliff12' || opt.format === 'xlf2' || opt.format === 'xlf12') {
      const fn = (opt.format === 'xliff12' || opt.format === 'xlf12') ? xliff12ToJs : xliff2js;
      fn(data.toString(), (err, res) => {
        if (err) return cb(err);
        if (!res.targetLanguage) {
          sourceOfjs(res, cb);
        } else {
          targetOfjs(res, cb);
        }
      });
      return;
    }
    if (opt.format === 'resx') {
      resx2js(data.toString(), cb);
      return;
    }
    if (opt.format === 'fluent') {
      const fluentJS = ftl2js(data.toString().replace(new RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)));
      Object.keys(fluentJS).forEach((prop) => {
        if (fluentJS[prop] && fluentJS[prop].comment) delete fluentJS[prop].comment;
      });
      cb(null, flatten(fluentJS));
      return;
    }
    if (opt.format === 'tmx') {
      tmx2js(data.toString(), (err, jsonData) => {
        if (err) return cb(err);
        const tmxJsRes = jsonData.resources[Object.keys(jsonData.resources)[0]];
        const res = {};
        if (tmxJsRes) {
          Object.keys(tmxJsRes).forEach((k) => {
            res[k] = tmxJsRes[k][opt.referenceLanguage];
          });
        }
        cb(null, res);
      });
      return;
    }
    if (opt.format === 'laravel') {
      cb(null, flatten(laravel2js(data.toString())));
      return;
    }
    cb(new Error(`${opt.format} is not a valid format!`));
  } catch (err) { cb(err); }
};

module.exports = convertToFlatFormat;
