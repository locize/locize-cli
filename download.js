const colors = require('colors');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const request = require('./request');
const fs = require('fs');
const path = require('path');
const async = require('async');
const flatten = require('flat');
const getRemoteNamespace = require('./getRemoteNamespace');
const getRemoteLanguages = require('./getRemoteLanguages');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const formats = require('./formats');
const getProjectStats = require('./getProjectStats');
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
  if (res.status >= 300) {
    if (!cb) { console.error(colors.red(res.statusText + ' (' + res.status + ')')); process.exit(1); }
    if (cb) cb(new Error(res.statusText + ' (' + res.status + ')'));
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
        var filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
        var mkdirPath;
        if (filledMask.lastIndexOf(path.sep) > 0) {
          mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep));
        }
        if (!opt.version) {
          if (mkdirPath) mkdirp.sync(path.join(opt.path, version, mkdirPath));
          fs.writeFile(path.join(opt.path, version, filledMask), converted, clb);
          return;
        }
        if (!opt.language) {
          if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
          fs.writeFile(path.join(opt.path, filledMask), converted, clb);
          return;
        }

        if (filledMask.indexOf(path.sep) > 0) filledMask = filledMask.replace(opt.languageFolderPrefix + lng, '');
        const parentDir = path.dirname(path.join(opt.path, filledMask));
        mkdirp.sync(parentDir);
        fs.writeFile(path.join(opt.path, filledMask), converted, clb);
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

function handlePull(opt, toDownload, cb) {
  const url = opt.apiPath + '/pull/' + opt.projectId + '/' + opt.version;
  async.each(toDownload, (download, clb) => {
    const lng = download.language;
    const namespace = download.namespace;

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
        var filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
        var mkdirPath;
        if (filledMask.lastIndexOf(path.sep) > 0) {
          mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep));
        }
        if (!opt.language) {
          if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
          fs.writeFile(path.join(opt.path, filledMask), converted, clb);
          return;
        }

        if (filledMask.indexOf(path.sep) > 0) filledMask = filledMask.replace(opt.languageFolderPrefix + lng, '');
        const parentDir = path.dirname(path.join(opt.path, filledMask));
        mkdirp.sync(parentDir);
        fs.writeFile(path.join(opt.path, filledMask), converted, clb);
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
  opt.format = opt.format || 'json';
  if (!reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`), cb);
  }

  if (opt.skipEmpty === undefined) opt.skipEmpty = true;
  opt.apiPath = opt.apiPath || 'https://api.locize.app';
  opt.version = opt.version || 'latest';
  opt.languageFolderPrefix = opt.languageFolderPrefix || '';
  opt.path = opt.path || opt.target;
  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{';
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}';
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`);
  if (opt.unpublished && !opt.apiKey) {
    return handleError(new Error('Please provide also an api-key!'), cb);
  }

  var url = opt.apiPath + '/download/' + opt.projectId;

  if (opt.namespace && opt.namespace.indexOf(',') > 0 && opt.namespace.indexOf(' ') < 0) {
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

  mkdirp.sync(opt.path);

  if (!cb) console.log(colors.yellow(`downloading ${url} to ${opt.path}...`));

  getRemoteLanguages(opt, (err) => {
    if (err) return handleError(err, cb);

    if (!opt.unpublished) {
      request(url, {
        method: 'get',
        headers: opt.apiKey ? {
          'Authorization': opt.apiKey
        } : undefined
      }, (err, res, obj) => {
        if (res && res.status === 401) {
          opt.apiKey = null;
          request(url, {
            method: 'get',
          }, (err, res, obj) => {
            if (opt.skipEmpty) obj = obj.filter((d) => d.size > 2);
            handleDownload(opt, url, err, res, obj, cb);
          });
          return;
        }

        if (opt.skipEmpty) obj = obj.filter((d) => d.size > 2);
        handleDownload(opt, url, err, res, obj, cb);
      });
      return;
    }

    getProjectStats(opt, (err, res) => {
      if (err) return handleError(err, cb);
      if (!res || !res[opt.version]) return handleError(new Error('Nothing found!'), cb);

      const toDownload = [];
      const lngsToCheck = opt.language ? [opt.language] : Object.keys(res[opt.version]);
      lngsToCheck.forEach((l) => {
        if (opt.namespaces) {
          opt.namespaces.forEach((n) => {
            if (!res[opt.version][l][n]) return;
            if (opt.skipEmpty && res[opt.version][l][n].segmentsTranslated === 0) return;
            toDownload.push({ language: l, namespace: n });
          });
        } else if (opt.namespace) {
          if (!res[opt.version][l][opt.namespace]) return;
          if (opt.skipEmpty && res[opt.version][l][opt.namespace].segmentsTranslated === 0) return;
          toDownload.push({ language: l, namespace: opt.namespace });
        } else {
          Object.keys(res[opt.version][l]).forEach((n) => {
            if (opt.skipEmpty && res[opt.version][l][n].segmentsTranslated === 0) return;
            toDownload.push({ language: l, namespace: n });
          });
        }
      });
      handlePull(opt, toDownload, cb);
    });
  });
};

module.exports = download;
