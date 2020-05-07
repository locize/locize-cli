const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const async = require('async');
const colors = require('colors');
const request = require('./request');
const flatten = require('flat');
const cloneDeep = require('lodash.clonedeep');
const getRemoteNamespace = require('./getRemoteNamespace');
const getRemoteLanguages = require('./getRemoteLanguages');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const convertToFlatFormat = require('./convertToFlatFormat');
const formats = require('./formats');
const lngCodes = require('./lngs.json');
const fileExtensionsMap = formats.fileExtensionsMap;
const acceptedFileExtensions = formats.acceptedFileExtensions;
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;

const getFiles = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return !fs.statSync(path.join(srcpath, file)).isDirectory();
  }).filter((file) => acceptedFileExtensions.indexOf(path.extname(file)) > -1);
};

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

const parseLocalLanguage = (opt, lng, cb) => {
  const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng);
  var firstPartLngMask, lastPartLngMask;
  if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
    const secondPartMask = opt.pathMask.substring(opt.pathMask.lastIndexOf(path.sep) + 1);
    firstPartLngMask = secondPartMask.substring(0, secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`));
    lastPartLngMask = secondPartMask.substring(secondPartMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`.length);
  }
  var lngPath;
  if (filledLngMask.lastIndexOf(path.sep) > 0) {
    lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep));
  }
  if (!opt.dry && lngPath && lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) < 0) mkdirp.sync(path.join(opt.path, lngPath));
  var files = [];
  try {
    if (lngPath) {
      if (lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1) {
        const firstPart = lngPath.substring(0, lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`));
        const lastPart = lngPath.substring(lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) + `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`.length);
        var additionalSubDirsLeft = '';
        var additionalSubDirs = '';
        var splittedP = lngPath.split(path.sep);
        const foundSplitted = splittedP.find((s) => s.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) > -1);
        const foundSplittedIndex = splittedP.indexOf(foundSplitted);
        if (splittedP.length > 2) {
          additionalSubDirsLeft = splittedP.slice(0, foundSplittedIndex).join(path.sep);
          additionalSubDirs = splittedP.slice(foundSplittedIndex + 1).join(path.sep);
        }
        var dirs = getDirectories(path.join(opt.path, additionalSubDirsLeft));
        if (additionalSubDirs === '') {
          dirs = dirs.filter((d) => d.startsWith(firstPart) && d.endsWith(lastPart));
        }
        dirs.forEach((d) => {
          if (additionalSubDirs && fs.statSync(path.join(opt.path, additionalSubDirsLeft, d)).isDirectory()) {
            var subFls = getFiles(path.join(opt.path, additionalSubDirsLeft, d, additionalSubDirs));
            if (firstPartLngMask || lastPartLngMask) subFls = subFls.filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`);
            files = files.concat(subFls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${additionalSubDirs}${path.sep}${f}`));
          } else {
            const fls = getFiles(path.join(opt.path, additionalSubDirsLeft, d)).filter((f) => path.basename(f, path.extname(f)) === `${firstPartLngMask}${lng}${lastPartLngMask}`);
            files = files.concat(fls.map((f) => `${additionalSubDirsLeft ? additionalSubDirsLeft + path.sep : ''}${d}${path.sep}${f}`));
          }
        });
      } else {
        files = getFiles(path.join(opt.path, lngPath));
      }
    } else {
      files = getFiles(opt.path);
      // filter lng files...
      const lngIndex = filledLngMask.indexOf(lng);
      const lngLeftLength = filledLngMask.length - lngIndex;
      files = files.filter((f) => { // {{language}} can be left or right of {{namespace}}
        if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) < opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`)) {
          return f.indexOf(lng) === lngIndex;
        }
        return (path.basename(f, path.extname(f)).length - f.indexOf(lng)) === lngLeftLength;
      });
    }
  } catch (err) {}
  async.map(files, (file, clb) => {
    var dirPath;
    if (file.lastIndexOf(path.sep) > 0) {
      dirPath = file.substring(0, file.lastIndexOf(path.sep));
      file = file.substring(file.lastIndexOf(path.sep) + 1);
    }
    const fExt = path.extname(file);
    var namespace = path.basename(file, fExt);
    const nsMask = `${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
    const filledNsMask = lngPath && lngPath.indexOf(nsMask) > -1 ? filledLngMask : filledLngMask.substring(filledLngMask.lastIndexOf(path.sep) + 1);
    const startNsIndex = filledNsMask.indexOf(nsMask);
    var restNsMask = filledNsMask.substring((startNsIndex || 0) + nsMask.length);
    namespace = namespace.substring(startNsIndex || 0, namespace.lastIndexOf(restNsMask));
    if (lngPath && lngPath.indexOf(nsMask) > -1) {
      restNsMask = restNsMask.substring(0, restNsMask.lastIndexOf(path.sep));
      if (dirPath.indexOf(restNsMask) > 0) {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask), dirPath.indexOf(restNsMask));
      } else {
        namespace = dirPath.substring(filledNsMask.indexOf(nsMask));
      }
    }
    var fPath = path.join(opt.path, lngPath || '', file);
    if (dirPath && lngPath.indexOf(nsMask) > -1) {
      fPath = path.join(opt.path, dirPath.replace(nsMask, namespace), file);
    }
    if (!namespace) return clb(new Error(`namespace could not be found in ${fPath}`));
    fs.readFile(fPath, (err, data) => {
      if (err) return clb(err);

      if (fileExtensionsMap[fExt].indexOf(opt.format) < 0) {
        return clb(new Error(`Format mismatch! Found ${fileExtensionsMap[fExt][0]} but requested ${opt.format}!`));
      }

      convertToFlatFormat(opt, data, lng, (err, content) => {
        if (err) {
          err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
          err.message += '\n' + fPath;
          return clb(err);
        }

        fs.stat(fPath, (err, stat) => {
          if (err) return clb(err);

          clb(null, {
            namespace: namespace,
            path: fPath,
            extension: fExt,
            content: content,
            language: lng,
            mtime: stat.mtime
          });
        });
      });
    });
  }, cb);
};

const filterNamespaces = (opt, nss) => {
  if (opt.namespace) {
    nss = nss.filter((ns) => ns.namespace === opt.namespace);
  }
  if (opt.namespaces && opt.namespaces.length > 0) {
    nss = nss.filter((ns) => opt.namespaces.indexOf(ns.namespace) > -1);
  }

  return nss;
};

const parseLocalReference = (opt, cb) => parseLocalLanguage(opt, opt.referenceLanguage, (err, nss) => {
  if (err) return cb(err);

  cb(err, filterNamespaces(opt, nss));
});

const parseLocalLanguages = (opt, lngs, cb) => {
  var res = [];
  async.each(lngs, (lng, clb) => {
    if (opt.language && (lng !== opt.language && lng !== opt.referenceLanguage)) {
      return clb();
    }
    parseLocalLanguage(opt, lng, (err, nss) => {
      if (err) return clb(err);
      res = res.concat(filterNamespaces(opt, nss));
      clb();
    });
  }, (err) => {
    if (err) return cb(err);
    cb(null, res);
  });
};

const getDownloads = (opt, cb) => {
  request(opt.apiPath + '/download/' + opt.projectId + '/' + opt.version, {
    method: 'get',
    headers: opt.apiKey ? {
      'Authorization': opt.apiKey
    } : undefined
  }, (err, res, obj) => {
    if (err) return cb(err);
    if (res.status >= 300) {
      if (obj && (obj.errorMessage || obj.message)) {
        return cb(new Error((obj.errorMessage || obj.message)));
      }
      return cb(new Error(res.statusText + ' (' + res.status + ')'));
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
    if (remote[k] === '' && local[k] === '') return;
    if (!remote[k]) {
      if (wasLastChangedRemote) {
        diff.toRemoveLocally.push(k); // will download later
      } else {
        diff.toAdd.push(k);
      }
    }
    if (
      remote[k] && (
        (typeof local[k] === 'object' && local[k].value && remote[k] !== local[k].value) ||
        (typeof local[k] !== 'object' && remote[k] !== local[k])
      )
    ) {
      if (wasLastChangedRemote) {
        diff.toUpdateLocally.push(k); // will download later
      } else {
        diff.toUpdate.push(k);
      }
    }
  });
  Object.keys(remote).forEach((k) => {
    if (local[k] === '' && remote[k] === '') return;
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

      if (opt.language && opt.language !== lng && lng !== opt.referenceLanguage) return clb(null);
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

          const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
          if (opt.dry) return clb(null);
          if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) && filledMask.lastIndexOf(path.sep) > 0) {
            mkdirp.sync(path.join(opt.path, filledMask.substring(0, filledMask.lastIndexOf(path.sep))));
          }
          const parentDir = path.dirname(path.join(opt.path, filledMask));
          mkdirp.sync(parentDir);
          fs.writeFile(path.join(opt.path, filledMask), converted, clb);
        });
      });
    }, cb);
  });
};

const update = (opt, lng, ns, cb) => {
  var data = {};
  if (!opt.skipDelete) {
    ns.diff.toRemove.forEach((k) => data[k] = null);
  }
  ns.diff.toAdd.forEach((k) => data[k] = ns.content[k]);
  if (opt.updateValues) {
    ns.diff.toUpdate.forEach((k) => data[k] = ns.content[k]);
  }

  if (Object.keys(data).length === 0) return cb(null);

  if (opt.dry) return cb(null);

  var payloadKeysLimit = 1000;

  function send(d, clb, isRetrying) {
    request(opt.apiPath + '/update/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace, {
      method: 'post',
      body: d,
      headers: {
        'Authorization': opt.apiKey
      }
    }, (err, res, obj) => {
      if (err) return clb(err);
      if (res.status === 504 && !isRetrying) {
        return setTimeout(() => send(d, clb, true), 3000);
      }
      if (res.status >= 300 && res.status !== 412) {
        if (obj && (obj.errorMessage || obj.message)) {
          return clb(new Error((obj.errorMessage || obj.message)));
        }
        return clb(new Error(res.statusText + ' (' + res.status + ')'));
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
  if (opt.pathMask.lastIndexOf(path.sep) < 0) return;
  const dirs = getDirectories(opt.path).filter((dir) => dir.indexOf('.') !== 0);
  if (!opt.language && !opt.namespace && !opt.namespaces) {
    dirs
      .filter((lng) => {
        const lMask = `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`;
        const startLIndex = opt.pathMask.indexOf(lMask);
        const restLMask = lng.substring((startLIndex || 0) + lMask.length);
        lng = lng.substring(startLIndex || 0, lng.lastIndexOf(restLMask));

        return lng !== opt.referenceLanguage
            && !!lngCodes.find((c) => lng === c || lng.indexOf(c + '-') === 0);
      })
      .forEach((lng) => {
        const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng);
        var lngPath;
        if (filledLngMask.lastIndexOf(path.sep) > 0) {
          lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep));
        }
        rimraf.sync(path.join(opt.path, lngPath));
      });
  }
  remoteLanguages.forEach((lng) => {
    if (opt.language && opt.language !== lng) return;
    const filledLngMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, lng);
    var lngPath;
    if (filledLngMask.lastIndexOf(path.sep) > 0) {
      lngPath = filledLngMask.substring(0, filledLngMask.lastIndexOf(path.sep));
    }
    if (lngPath && lngPath.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) < 0) mkdirp.sync(path.join(opt.path, lngPath));
  });
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
    if (err) return handleError(err);

    opt.isPrivate = downloads.length > 0 && downloads[0].isPrivate;

    compareNamespaces(opt, localNamespaces, (err, compared) => {
      if (err) return handleError(err);

      var wasThereSomethingToUpdate = false;
      async.eachLimit(compared, Math.round(require('os').cpus().length / 2), (ns, clb) => {
        if (!cb) {
          if (ns.diff.toRemove.length > 0) {
            if (opt.skipDelete) {
              console.log(colors.bgRed(`skipping the removal of ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`));
              if (opt.dry) console.log(colors.bgRed(`skipped to remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`));
            } else {
              console.log(colors.red(`removing ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`));
              if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`));
            }
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

  if (opt.namespace && opt.namespace.indexOf(',') > 0) {
    opt.namespaces = opt.namespace.split(',');
    delete opt.namespace;
  }

  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{';
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}';
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`);

  getRemoteLanguages(opt, (err, remoteLanguages) => {
    if (err) return handleError(err);

    if (opt.referenceLanguageOnly && opt.language && opt.referenceLanguage !== opt.language) {
      opt.referenceLanguage = opt.language;
    }

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
