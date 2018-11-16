const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const async = require('async');
const colors = require('colors');
const request = require('request');
const flatten = require('flat');
const cloneDeep = require('lodash.clonedeep');
const gettextToI18next = require('i18next-conv').gettextToI18next;
const csvjson = require('csvjson');
const xlsx = require('xlsx');
const jsyaml = require('js-yaml');
const asr2js = require('android-string-resource/asr2js');
const stringsFile = require('strings-file');
const xliff2js = require('xliff/xliff2js');
const xliff12ToJs = require('xliff/xliff12ToJs');
const targetOfjs = require('xliff/targetOfjs');
const resx2js = require('resx/resx2js');
const ftl2js = require('fluent_conv/ftl2js');
const tmx2js = require('tmexchange/tmx2js');
const laravel2js = require('laravelphp/laravel2js');
const getRemoteNamespace = require('./getRemoteNamespace');
const getRemoteLanguages = require('./getRemoteLanguages');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const formats = require('./formats');
const fileExtensionsMap = formats.fileExtensionsMap;
const acceptedFileExtensions = formats.acceptedFileExtensions;
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function(file) {
    return !fs.statSync(path.join(srcpath, file)).isDirectory();
  }).filter((file) => acceptedFileExtensions.indexOf(path.extname(file)) > -1);
};

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

const convertToFlatFormat = (opt, data, cb) => {
  try {
    if (opt.format === 'json' || opt.format === 'flat') {
      cb(null, flatten(JSON.parse(data.toString())));
      return;
    }
    if (opt.format === 'po' || opt.format === 'gettext') {
      gettextToI18next(opt.referenceLanguage, data.toString())
        .then((ret) => {
          try {
            cb(null, flatten(JSON.parse(ret.toString())));
          } catch (err) { cb(err); }
        }, cb);
      return;
    }
    if (opt.format === 'csv') {
      const options = {
        delimiter: ',',
        quote: '"'
      };
      // https://en.wikipedia.org/wiki/Delimiter-separated_values
      // temporary replace "" with \_\" so we can revert this 3 lines after
      const jsonData = csvjson.toObject(data.toString().replace(/""/g, '\\_\\"'), options);
      data = jsonData.reduce((mem, entry) => {
        if (entry.key && typeof entry[opt.referenceLanguage] === 'string') {
          mem[entry.key.replace(/\\_\\"/g, '"')] = entry[opt.referenceLanguage].replace(/\\_\\"/g, '"');
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
    if (opt.format === 'xliff2' || opt.format === 'xliff12') {
      const fn = opt.format === 'xliff12' ? xliff12ToJs : xliff2js;
      fn(data.toString(), (err, res) => {
        if (err) return cb(err);
        targetOfjs(res, cb);
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
      laravel2js(data.toString(), cb);
      return;
    }
    cb(new Error(`${opt.format} is not a valid format!`));
  } catch (err) { cb(err); }
};

const parseLocalLanguage = (opt, lng, cb) => {
  if (!opt.dry) mkdirp.sync(path.join(opt.path, opt.languageFolderPrefix + lng));

  var files = [];
  try {
    files = getFiles(path.join(opt.path, opt.languageFolderPrefix + lng));
  } catch (err) {}
  async.map(files, (file, clb) => {
    fs.readFile(path.join(opt.path, opt.languageFolderPrefix + lng, file), (err, data) => {
      if (err) return clb(err);

      if (fileExtensionsMap[path.extname(file)].indexOf(opt.format) < 0) {
        return clb(new Error(`Format mismatch! Found ${fileExtensionsMap[path.extname(file)][0]} but requested ${opt.format}!`));
      }

      convertToFlatFormat(opt, data, (err, content) => {
        if (err) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
          err.message += '\n' + path.join(opt.path, opt.languageFolderPrefix + lng, file);
          return clb(err);
        }

        fs.stat(path.join(opt.path, opt.languageFolderPrefix + lng, file), (err, stat) => {
          if (err) return clb(err);

          clb(null, {
            namespace: path.basename(file, path.extname(file)),
            path: path.join(opt.path, opt.languageFolderPrefix + lng, file),
            extension: path.extname(file),
            content: content,
            language: lng,
            mtime: stat.mtime
          });
        });
      });
    });
  }, cb);
};

const parseLocalReference = (opt, cb) => parseLocalLanguage(opt, opt.referenceLanguage, cb);

const parseLocalLanguages = (opt, lngs, cb) => {
  var res = [];
  async.each(lngs, (lng, clb) => {
    parseLocalLanguage(opt, lng, (err, nss) => {
      if (err) return clb(err);
      res = res.concat(nss);
      clb();
    });
  }, (err) => {
    if (err) return cb(err);
    cb(null, res);
  });
};

const getDownloads = (opt, cb) => {
  request({
    method: 'GET',
    json: true,
    url: opt.apiPath + '/download/' + opt.projectId + '/' + opt.version,
    headers: opt.apiKey ? {
      'Authorization': opt.apiKey
    } : undefined
  }, (err, res, obj) => {
    if (err) return cb(err);
    if (res.statusCode >= 300) {
      if (obj && (obj.errorMessage || obj.message)) {
        return cb(new Error((obj.errorMessage || obj.message)));
      }
      return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
    }
    cb(null, obj);
  });
};

const compareNamespace = (local, remote, lastModifiedLocal, lastModifiedRemote) => {
  const wasLastChangedRemote = lastModifiedLocal && lastModifiedRemote && lastModifiedLocal.getTime() < lastModifiedRemote.getTime();
  const diff = {
    toAdd: [],
    toAddLocally: [],
    toUpdate: [],
    toUpdateLocally: [],
    toRemove: [],
    toRemoveLocally: []
  };
  local = local || {};
  remote = remote || {};
  Object.keys(local).forEach((k) => {
    if (!remote[k]) {
      if (wasLastChangedRemote) {
        diff.toRemoveLocally.push(k); // will download later
      } else {
        diff.toAdd.push(k);
      }
    }
    if (remote[k] && remote[k] !== local[k]) {
      if (wasLastChangedRemote) {
        diff.toUpdateLocally.push(k); // will download later
      } else {
        diff.toUpdate.push(k);
      }
    }
  });
  Object.keys(remote).forEach((k) => {
    if (!local[k]) {
      if (wasLastChangedRemote) {
        diff.toAddLocally.push(k); // will download later
      } else {
        diff.toRemove.push(k);
      }
    }
  });
  return diff;
};

const compareNamespaces = (opt, localNamespaces, cb) => {
  async.map(localNamespaces, (ns, clb) => {
    getRemoteNamespace(opt, ns.language, ns.namespace, (err, remoteNamespace, lastModified) => {
      if (err) return clb(err);

      const diff = compareNamespace(ns.content, remoteNamespace, opt.compareModificationTime ? ns.mtime : undefined, opt.compareModificationTime ? lastModified : undefined);
      ns.diff = diff;
      ns.remoteContent = remoteNamespace;
      clb(null, ns);
    });
  }, cb);
};

const getNamespaceNamesAvailableInReference = (opt, downloads) => {
  var nsNames = [];
  downloads.forEach((d) => {
    const splitted = d.key.split('/');
    const lng = splitted[2];
    const ns = splitted[3];
    if (lng === opt.referenceLanguage) {
      nsNames.push(ns);
    }
  });
  return nsNames;
};

const ensureAllNamespacesInLanguages = (opt, remoteLanguages, downloads) => {
  const namespaces = getNamespaceNamesAvailableInReference(opt, downloads);

  remoteLanguages.forEach((lng) => {
    namespaces.forEach((n) => {
      const found = downloads.find((d) => d.key === `${opt.projectId}/${opt.version}/${lng}/${n}`);
      if (!found) {
        downloads.push({
          key: `${opt.projectId}/${opt.version}/${lng}/${n}`,
          lastModified: '1960-01-01T00:00:00.000Z',
          size: 0,
          url: `${opt.apiPath}/${opt.projectId}/${opt.version}/${lng}/${n}`
        });
      }
    });
  });
};

const downloadAll = (opt, remoteLanguages, omitRef, cb) => {
  if (!cb) {
    cb = omitRef;
    omitRef = false;
  }

  if (!opt.dry) cleanupLanguages(opt, remoteLanguages);

  getDownloads(opt, (err, downloads) => {
    if (err) return cb(err);

    ensureAllNamespacesInLanguages(opt, remoteLanguages, downloads);

    if (omitRef) {
      downloads = downloads.filter((d) => {
        const splitted = d.key.split('/');
        const lng = splitted[d.isPrivate ? 3 : 2];
        return lng !== opt.referenceLanguage;
      });
    }
    async.each(downloads, (download, clb) => {
      const splitted = download.key.split('/');
      const lng = splitted[download.isPrivate ? 3 : 2];
      const namespace = splitted[download.isPrivate ? 4 : 3];
      opt.isPrivate = download.isPrivate;
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

          if (opt.dry) return clb(null);
          fs.writeFile(path.join(opt.path, opt.languageFolderPrefix + lng, namespace + reversedFileExtensionsMap[opt.format]), converted, clb);
        });
      });
    }, cb);
  });
};

const update = (opt, lng, ns, cb) => {
  var data = {};
  ns.diff.toRemove.forEach((k) => data[k] = null);
  ns.diff.toAdd.forEach((k) => data[k] = ns.content[k]);
  if (opt.updateValues) {
    ns.diff.toUpdate.forEach((k) => data[k] = ns.content[k]);
  }

  if (Object.keys(data).length === 0) return cb(null);

  if (opt.dry) return cb(null);

  var payloadKeysLimit = 1000;

  function send(d, clb, isRetrying) {
    request({
      method: 'POST',
      json: true,
      url: opt.apiPath + '/update/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace,
      body: d,
      headers: {
        'Authorization': opt.apiKey
      }
    }, (err, res, obj) => {
      if (err) return clb(err);
      if (res.statusCode === 504 && !isRetrying) {
        return setTimeout(() => send(d, clb, true), 3000);
      }
      if (res.statusCode >= 300) {
        if (obj && (obj.errorMessage || obj.message)) {
          return clb(new Error((obj.errorMessage || obj.message)));
        }
        return clb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
      }
      setTimeout(() => clb(null), 1000);
    });
  }

  if (Object.keys(data).length > payloadKeysLimit) {
    var tasks = [];
    var keysInObj = Object.keys(data);

    while (keysInObj.length > payloadKeysLimit) {
      (function() {
        var pagedData = {};
        keysInObj.splice(0, payloadKeysLimit).forEach((k) => pagedData[k] = data[k]);
        tasks.push((c) => send(pagedData, c));
      })();
    }

    if (keysInObj.length === 0) return cb(null);

    var finalPagedData = {};
    keysInObj.splice(0, keysInObj.length).forEach((k) => finalPagedData[k] = data[k]);
    tasks.push((c) => send(finalPagedData, c));

    async.series(tasks, cb);
    return;
  }

  send(data, cb);
};

const cleanupLanguages = (opt, remoteLanguages) => {
  const dirs = getDirectories(opt.path).filter((dir) => dir.indexOf('.') !== 0);
  dirs.filter((lng) => lng !== opt.referenceLanguage).forEach((lng) => rimraf.sync(path.join(opt.path, opt.languageFolderPrefix + lng)));
  remoteLanguages.forEach((lng) => mkdirp.sync(path.join(opt.path, opt.languageFolderPrefix + lng)));
};

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.stack));
    process.exit(1);
  }
  if (cb) cb(err);
};

const handleSync = (opt, remoteLanguages, localNamespaces, cb) => {
  if (!localNamespaces || localNamespaces.length === 0) {
    downloadAll(opt, remoteLanguages, (err) => {
      if (err) return handleError(err);
      if (!cb) console.log(colors.green('FINISHED'));
      if (cb) cb(null);
    });
    return;
  }

  getDownloads(opt, (err, downloads) => {
    if (err) return cb(err);

    opt.isPrivate = downloads.length > 0 && downloads[0].isPrivate;

    compareNamespaces(opt, localNamespaces, (err, compared) => {
      if (err) return handleError(err);

      var wasThereSomethingToUpdate = false;
      async.eachLimit(compared, Math.round(require('os').cpus().length / 2), (ns, clb) => {
        if (!cb) {
          if (ns.diff.toRemove.length > 0) {
            console.log(colors.red(`removing ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`));
            if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`));
          }
          if (ns.diff.toRemoveLocally.length > 0) {
            console.log(colors.red(`removing ${ns.diff.toRemoveLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
            if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemoveLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
          }
          if (ns.diff.toAdd.length > 0) {
            console.log(colors.green(`adding ${ns.diff.toAdd.length} keys in ${ns.language}/${ns.namespace}...`));
            if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAdd.join(', ')} in ${ns.language}/${ns.namespace}...`));
          }
          if (ns.diff.toAddLocally.length > 0) {
            console.log(colors.green(`adding ${ns.diff.toAddLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
            if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAddLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
          }
          if (opt.updateValues) {
            if (ns.diff.toUpdate.length > 0) {
              console.log(colors.yellow(`updating ${ns.diff.toUpdate.length} keys in ${ns.language}/${ns.namespace}...`));
              if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdate.join(', ')} in ${ns.language}/${ns.namespace}...`));
            }
            if (ns.diff.toUpdateLocally.length > 0) {
              console.log(colors.yellow(`updating ${ns.diff.toUpdateLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
              if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdateLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
            }
          }
          const somethingToUpdate = ns.diff.toAdd.concat(ns.diff.toRemove)/*.concat(ns.diff.toUpdate)*/.length > 0;
          if (!somethingToUpdate) console.log(colors.grey(`nothing to update for ${ns.language}/${ns.namespace}`));
          if (!wasThereSomethingToUpdate && somethingToUpdate) wasThereSomethingToUpdate = true;
        }
        update(opt, ns.language, ns, (err) => {
          if (err) return clb(err);
          if (ns.diff.toRemove.length === 0 || ns.language !== opt.referenceLanguage) return clb();
          const nsOnlyRemove = cloneDeep(ns);
          nsOnlyRemove.diff.toAdd = [];
          nsOnlyRemove.diff.toUpdate = [];
          async.eachLimit(remoteLanguages, Math.round(require('os').cpus().length / 2), (lng, clb) => update(opt, lng, nsOnlyRemove, clb), clb);
        });
      }, (err) => {
        if (err) return handleError(err);

        if (!cb) console.log(colors.grey('syncing...'));
        setTimeout(() => {
          downloadAll(opt, remoteLanguages, wasThereSomethingToUpdate, (err) => {
            if (err) return handleError(err);
            if (!cb) console.log(colors.green('FINISHED'));
            if (cb) cb(null);
          });
        }, wasThereSomethingToUpdate && !opt.dry ? 5000 : 0);
      }); // wait a bit before downloading... just to have a chance to get the newly published files
    });
  });
};

const sync = (opt, cb) => {
  if (!reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`));
  }

  if (!opt.dry && opt.clean) rimraf.sync(path.join(opt.path, '*'));
  if (!opt.dry) mkdirp.sync(opt.path);

  getRemoteLanguages(opt, (err, remoteLanguages) => {
    if (err) return handleError(err);

    if (opt.referenceLanguageOnly) {
      parseLocalReference(opt, (err, localNamespaces) => {
        if (err) return handleError(err);
        handleSync(opt, remoteLanguages, localNamespaces, cb);
      });
      return;
    }

    parseLocalLanguages(opt, remoteLanguages, (err, localNamespaces) => {
      if (err) return handleError(err);
      handleSync(opt, remoteLanguages, localNamespaces, cb);
    });
  });
};

module.exports = sync;
