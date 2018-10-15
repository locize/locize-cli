const colors = require('colors');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const request = require('request');
const fs = require('fs');
const path = require('path');
const async = require('async');
const flatten = require('flat');
const getRemoteNamespace = require('./getRemoteNamespace');
const getRemoteLanguages = require('./getRemoteLanguages');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const formats = require('./formats');
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;

function handleDownload(opt, url, err, res, downloads, cb) {
  if (err || (downloads && (downloads.errorMessage || downloads.message))) {
    if (!cb) console.log(colors.red(`download failed for ${url} to ${opt.path}...`));

    if (err) {
      if (!cb) { console.error(colors.red(err.message)); process.exit(1); }
      if (cb) cb(err);
      return;
    }
    if (downloads && (downloads.errorMessage || downloads.message)) {
      if (!cb) { console.error(colors.red((downloads.errorMessage || downloads.message))); process.exit(1); }
      if (cb) cb(new Error((downloads.errorMessage || downloads.message)));
      return;
    }
  }
  if (res.statusCode >= 300) {
    if (!cb) { console.error(colors.red(res.statusMessage + ' (' + res.statusCode + ')')); process.exit(1); }
    if (cb) cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
    return;
  }

  async.each(downloads, (download, clb) => {
    const splitted = download.key.split('/');
    const version = splitted[download.isPrivate ? 2 : 1];
    const lng = splitted[download.isPrivate ? 3 : 2];
    const namespace = splitted[download.isPrivate ? 4 : 3];
    opt.isPrivate = download.isPrivate;

    if (opt.namespace && opt.namespace !== namespace) return clb(null);
    if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return clb(null);

    getRemoteNamespace(opt, lng, namespace, (err, ns, lastModified) => {
      if (err) return clb(err);

      if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
        return clb(null);
      }

      convertToDesiredFormat(opt, namespace, lng, ns, lastModified, (err, converted) => {
        if (err) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
          return clb(err);
        }

        if (!opt.version) {
          mkdirp.sync(path.join(opt.path, version, lng));
          fs.writeFile(path.join(opt.path, version, lng, namespace + reversedFileExtensionsMap[opt.format]), converted, clb);
          return;
        }
        if (!opt.language) {
          mkdirp.sync(path.join(opt.path, lng));
          fs.writeFile(path.join(opt.path, lng, namespace + reversedFileExtensionsMap[opt.format]), converted, clb);
          return;
        }

        fs.writeFile(path.join(opt.path, namespace + reversedFileExtensionsMap[opt.format]), converted, clb);
      });
    });
  }, (err) => {
    if (err) {
      if (!cb) {
        console.error(colors.red(err.message));
        process.exit(1);
      }
      if (cb) cb(err);
      return;
    }

    if (!cb) console.log(colors.green(`downloaded ${url} to ${opt.path}...`));
    if (cb) cb(null);
  });
}

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.message));
    process.exit(1);
  }
  if (cb) cb(err);
};

const download = (opt, cb) => {
  if (!reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`));
  }

  if (opt.skipEmpty === undefined) opt.skipEmpty = true;
  opt.format = opt.format || 'json';
  opt.apiPath = opt.apiPath || 'https://api.locize.io/{{projectId}}/{{version}}/{{lng}}/{{ns}}';
  opt.languageFolderPrefix = opt.languageFolderPrefix || '';
  opt.path = opt.path || opt.target;

  var url = opt.apiPath + '/download/' + opt.projectId;

  if (opt.namespace && opt.namespace.indexOf(',') > 0) {
    opt.namespaces = opt.namespace.split(',');
    delete opt.namespace;
  }

  if (opt.version) {
    url += '/' + opt.version;
    if (opt.language) {
      url += '/' + opt.language;
      if (opt.namespace) {
        url += '/' + opt.namespace;
      }
    }
  }

  if (opt.clean) rimraf.sync(path.join(opt.path, '*'));

  if (!cb) console.log(colors.yellow(`downloading ${url} to ${opt.path}...`));

  getRemoteLanguages(opt, (err) => {
    if (err) return handleError(err);

    request({
      method: 'GET',
      json: true,
      url: url,
      headers: opt.apiKey ? {
        'Authorization': opt.apiKey
      } : undefined
    }, (err, res, obj) => {
      if (res && res.statusCode === 401) {
        opt.apiKey = null;
        request({
          method: 'GET',
          json: true,
          url: url
        }, (err, res, obj) => handleDownload(opt, url, err, res, obj, cb));
        return;
      }

      handleDownload(opt, url, err, res, obj, cb);
    });
  });
};

module.exports = download;
