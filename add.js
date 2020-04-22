const colors = require('colors');
const flatten = require('flat');
const url = require('url');
const async = require('async');
const getRemoteLanguages = require('./getRemoteLanguages');
const request = require('./request');

const _add = (opt, cb) => {
  const url = opt.addPath
    .replace('{{projectId}}', opt.projectId)
    .replace('{{ver}}', opt.version)
    .replace('{{version}}', opt.version)
    .replace('{{language}}', opt.language)
    .replace('{{lng}}', opt.language)
    .replace('{{ns}}', opt.namespace)
    .replace('{{namespace}}', opt.namespace);

  if (!cb) {
    if (!opt.data && (opt.value === undefined || opt.value === null)) {
      console.log(colors.yellow(`removing ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
    } else {
      console.log(colors.yellow(`adding ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
    }
  }

  var data = flatten(opt.data || {});
  if (!opt.data) {
    data[opt.key] = opt.value || null; // null will remove the key
  }

  request(url, {
    method: 'post',
    headers: {
      'Authorization': opt.apiKey
    },
    body: data
  }, (err, res, obj) => {
    if (err) {
      if (!opt.data && (opt.value === undefined || opt.value === null)) {
        console.log(colors.red(`remove failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      } else {
        console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
      }
      if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
      if (cb) cb(err);
      return;
    }
    if (res.status >= 300 && res.status !== 412) {
      if (!opt.data && (opt.value === undefined || opt.value === null)) {
        console.log(colors.red(`remove failed for ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      } else {
        console.log(colors.red(`add failed for ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
      }
      if (obj && (obj.errorMessage || obj.message)) {
        if (!cb) { console.error(colors.red((obj.errorMessage || obj.message))); process.exit(1); }
        if (cb) cb(new Error((obj.errorMessage || obj.message)));
        return;
      } else {
        if (!cb) { console.error(colors.red(res.statusText + ' (' + res.status + ')')); process.exit(1); }
        if (cb) cb(new Error(res.statusText + ' (' + res.status + ')'));
        return;
      }
    }
    if (!cb) {
      if (!opt.data && (opt.value === undefined || opt.value === null)) {
        console.log(colors.green(`removed ${opt.key} from ${opt.version}/${opt.language}/${opt.namespace}...`));
      } else {
        console.log(colors.green(`added ${opt.key} to ${opt.version}/${opt.language}/${opt.namespace}...`));
      }
    }
    if (cb) cb(null);
  });
};

const add = (opt, cb) => {
  if (opt.language) return _add(opt, cb);

  if (!opt.apiPath) {
    opt.apiPath = url.parse(opt.addPath).protocol + '//' + url.parse(opt.addPath).host;
  }

  getRemoteLanguages(opt, (err, lngs) => {
    if (err) {
      if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
      if (cb) cb(err);
      return;
    }

    async.forEachSeries(lngs, (lng, clb) => {
      opt.language = lng;
      _add(opt, clb);
    }, (err) => {
      if (err) {
        if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
        if (cb) cb(err);
        return;
      }
      if (!cb) {
        if (!opt.data && (opt.value === undefined || opt.value === null)) {
          console.log(colors.green(`removed ${opt.namespace}/${opt.key} (${opt.version}) from all languages...`));
        } else {
          console.log(colors.green(`added ${opt.namespace}/${opt.key} (${opt.version}) in all languages...`));
        }
      }
      if (cb) cb(null);
    });
  });
};

module.exports = add;
