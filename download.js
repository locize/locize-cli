const colors = require('colors');
const { mkdirp } = require('mkdirp');
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
const locize2xcstrings = require('locize-xcstrings/cjs/locize2xcstrings');

function getInfosInUrl(download) {
  const splitted = download.key.split('/');
  const version = splitted[download.isPrivate ? 2 : 1];
  const language = splitted[download.isPrivate ? 3 : 2];
  const namespace = splitted[download.isPrivate ? 4 : 3];
  return { version, language, namespace };
}

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

  if (opt.format === 'xcstrings') { // 1 file per namespace including all languages
    const downloadsByNamespace = {};
    downloads.forEach((download) => {
      const { version, namespace } = getInfosInUrl(download);
      opt.isPrivate = download.isPrivate;

      downloadsByNamespace[version] = downloadsByNamespace[version] || {};
      downloadsByNamespace[version][namespace] = downloadsByNamespace[version][namespace] || [];
      downloadsByNamespace[version][namespace].push(download);
    });

    async.eachSeries(Object.keys(downloadsByNamespace), (version, clb) => {
      async.eachLimit(Object.keys(downloadsByNamespace[version]), 20, (ns, clb) => {
        if (opt.namespace && opt.namespace !== ns) return clb(null);
        if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(ns) < 0) return clb(null);

        const locizeData = {
          sourceLng: opt.referenceLanguage,
          resources: {}
        };
        async.eachLimit(downloadsByNamespace[version][ns], 20, (download, clb2) => {
          const { language } = getInfosInUrl(download);
          getRemoteNamespace(opt, language, ns, (err, ns, lastModified) => {
            if (err) return clb2(err);

            if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
              return clb2(null);
            }

            locizeData.resources[language] = ns;
            clb2();
          });
        }, (err) => {
          if (err) return clb(err);

          try {
            const converted = locize2xcstrings(locizeData);

            var filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, ns) + reversedFileExtensionsMap[opt.format];
            var mkdirPath;
            if (filledMask.lastIndexOf(path.sep) > 0) {
              mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep));
            }

            function logAndClb(err) {
              if (err) return clb(err);
              if (!cb) console.log(colors.green(`downloaded ${version}/${ns} to ${opt.path}...`));
              if (clb) clb(null);
            }

            const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
            if (!opt.version) {
              if (mkdirPath) mkdirp.sync(path.join(opt.path, version, mkdirPath));
              fs.writeFile(path.join(opt.path, version, filledMask), fileContent, logAndClb);
              return;
            }

            if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
            fs.writeFile(path.join(opt.path, filledMask), converted, logAndClb);
          } catch (e) {
            err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
            return clb(err);
          }
        });
      }, clb);
    }, (err) => {
      if (err) {
        if (!cb) {
          console.error(colors.red(err.message));
          process.exit(1);
        }
        if (cb) cb(err);
        return;
      }

      if (cb) cb(null);
    });
  } else { // 1 file per namespace/lng
    async.eachLimit(downloads, 20, (download, clb) => {
      const { version, language, namespace } = getInfosInUrl(download);
      opt.isPrivate = download.isPrivate;

      if (opt.namespace && opt.namespace !== namespace) return clb(null);
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return clb(null);

      getRemoteNamespace(opt, language, namespace, (err, ns, lastModified) => {
        if (err) return clb(err);

        if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
          return clb(null);
        }

        convertToDesiredFormat(opt, namespace, language, ns, lastModified, (err, converted) => {
          if (err) {
            err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
            return clb(err);
          }
          var filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, language).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
          var mkdirPath;
          if (filledMask.lastIndexOf(path.sep) > 0) {
            mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep));
          }
          const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
          if (!opt.version) {
            if (mkdirPath) mkdirp.sync(path.join(opt.path, version, mkdirPath));
            fs.writeFile(path.join(opt.path, version, filledMask), fileContent, clb);
            return;
          }
          if (!opt.language) {
            if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
            fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
            return;
          }

          if (filledMask.indexOf(path.sep) > 0) filledMask = filledMask.replace(opt.languageFolderPrefix + language, '');
          const parentDir = path.dirname(path.join(opt.path, filledMask));
          mkdirp.sync(parentDir);
          fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
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
}

function handlePull(opt, toDownload, cb) {
  const url = opt.apiPath + '/pull/' + opt.projectId + '/' + opt.version;

  if (opt.format === 'xcstrings') { // 1 file per namespace including all languages
    const downloadsByNamespace = {};
    toDownload.forEach((download) => {
      const { namespace } = download;
      downloadsByNamespace[namespace] = downloadsByNamespace[namespace] || [];
      downloadsByNamespace[namespace].push(download);
    });

    async.eachLimit(Object.keys(downloadsByNamespace), 5, (namespace, clb) => {
      if (opt.namespace && opt.namespace !== namespace) return clb(null);
      if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return clb(null);

      const locizeData = {
        sourceLng: opt.referenceLanguage,
        resources: {}
      };

      async.eachLimit(downloadsByNamespace[namespace], 5, (download, clb2) => {
        const { language } = download;
        opt.raw = true;
        getRemoteNamespace(opt, language, namespace, (err, ns, lastModified) => {
          if (err) return clb2(err);

          if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
            return clb2(null);
          }

          locizeData.resources[language] = ns;
          clb2();
        });
      }, (err) => {
        if (err) return clb(err);

        try {
          const result = locize2xcstrings(locizeData);
          const converted = JSON.stringify(result, null, 2);

          var filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
          var mkdirPath;
          if (filledMask.lastIndexOf(path.sep) > 0) {
            mkdirPath = filledMask.substring(0, filledMask.lastIndexOf(path.sep));
          }

          function logAndClb(err) {
            if (err) return clb(err);
            if (!cb) console.log(colors.green(`downloaded ${opt.version}/${namespace} to ${opt.path}...`));
            if (clb) clb(null);
          }

          if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
          const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
          fs.writeFile(path.join(opt.path, filledMask), fileContent, logAndClb);
        } catch (e) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
          return clb(err);
        }
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

      if (cb) cb(null);
    });
  } else { // 1 file per namespace/lng
    async.eachLimit(toDownload, 5, (download, clb) => {
      const lng = download.language;
      const namespace = download.namespace;

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
          const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
          if (!opt.language) {
            if (mkdirPath) mkdirp.sync(path.join(opt.path, mkdirPath));
            fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
            return;
          }

          if (filledMask.indexOf(path.sep) > 0) filledMask = filledMask.replace(opt.languageFolderPrefix + lng, '');
          const parentDir = path.dirname(path.join(opt.path, filledMask));
          mkdirp.sync(parentDir);
          fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
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
}

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.message));
    process.exit(1);
  }
  if (cb) cb(err);
};

const filterDownloadsLanguages = (opt, downloads) => {
  if (opt.languages) {
    downloads = downloads.filter((d) => {
      const splitted = d.key.split('/');
      // const p = splitted[d.isPrivate ? 1 : 0];
      // const v = splitted[d.isPrivate ? 2 : 1];
      const l = splitted[d.isPrivate ? 3 : 2];
      const n = splitted[d.isPrivate ? 4 : 3];
      return opt.languages.indexOf(l) > -1 && (!opt.namespace || opt.namespace === n);
    });
  }
  return downloads;
};

const filterDownloads = (opt, downloads) => {
  if (opt.skipEmpty) return filterDownloadsLanguages(opt, downloads.filter((d) => d.size > 2));
  if (downloads.length < 1) return downloads;

  const allNamespaces = [];
  const downloadMap = {};
  downloads.forEach((d) => {
    const splitted = d.key.split('/');
    const p = splitted[d.isPrivate ? 1 : 0];
    const v = splitted[d.isPrivate ? 2 : 1];
    const l = splitted[d.isPrivate ? 3 : 2];
    const n = splitted[d.isPrivate ? 4 : 3];
    downloadMap[p] = downloadMap[p] || {};
    downloadMap[p][v] = downloadMap[p][v] || {};
    downloadMap[p][v][l] = downloadMap[p][v][l] || {};
    downloadMap[p][v][l][n] = d;
    if (allNamespaces.indexOf(n) < 0) allNamespaces.push(n);
  });
  Object.keys(downloadMap).forEach((projectId) => {
    Object.keys(downloadMap[projectId]).forEach((version) => {
      Object.keys(downloadMap[projectId][version]).forEach((language) => {
        allNamespaces.forEach((namespace) => {
          if (!downloadMap[projectId][version][language][namespace]) {
            downloads.push({
              url: `${opt.apiPath}/${projectId}/${version}/${language}/${namespace}`,
              key: `${projectId}/${version}/${language}/${namespace}`,
              lastModified: '1960-01-01T00:00:00.000Z',
              size: 0
            });
          }
        });
      });
    });
  });
  return filterDownloadsLanguages(opt, downloads);
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
    if (!opt.languages && opt.language) {
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
            obj = filterDownloads(opt, obj || []);
            handleDownload(opt, url, err, res, obj, cb);
          });
          return;
        }

        obj = filterDownloads(opt, obj || []);
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
