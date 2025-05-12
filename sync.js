const fs = require('fs');
const path = require('path');
const { mkdirp } = require('mkdirp');
const rimraf = require('rimraf');
const async = require('async');
const colors = require('colors');
const request = require('./request');
const flatten = require('flat');
const cloneDeep = require('lodash.clonedeep');
const getRemoteNamespace = require('./getRemoteNamespace');
const getRemoteLanguages = require('./getRemoteLanguages');
const convertToDesiredFormat = require('./convertToDesiredFormat');
const parseLocalLanguages = require('./parseLocalLanguages');
const parseLocalReference = require('./parseLocalReference');
const formats = require('./formats');
const lngCodes = require('./lngs.json');
const deleteNamespace = require('./deleteNamespace');
const getProjectStats = require('./getProjectStats');
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;
const locize2xcstrings = require('locize-xcstrings/cjs/locize2xcstrings');

const getDirectories = (srcpath) => {
  return fs.readdirSync(srcpath).filter((file) => {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
};

function getInfosInUrl(download) {
  const splitted = download.key.split('/');
  const version = splitted[download.isPrivate ? 2 : 1];
  const language = splitted[download.isPrivate ? 3 : 2];
  const namespace = splitted[download.isPrivate ? 4 : 3];
  return { version, language, namespace };
}

const getDownloads = (opt, cb) => {
  if (!opt.unpublished) {
    request(opt.apiPath + '/download/' + opt.projectId + '/' + opt.version, {
      method: 'get',
      headers: opt.apiKey ? {
        'Authorization': opt.apiKey
      } : undefined
    }, (err, res, obj) => {
      if (err) return cb(err);
      if (res.status >= 300) {
        if (obj && (obj.errorMessage || obj.message)) {
          if (res.statusText && res.status) {
            return cb(new Error(res.statusText + ' (' + res.status + ') | ' + (obj.errorMessage || obj.message)));
          }
          return cb(new Error((obj.errorMessage || obj.message)));
        }
        return cb(new Error(res.statusText + ' (' + res.status + ')'));
      }
      if (opt.skipEmpty) obj = obj.filter((d) => d.size > 2);
      cb(null, obj);
    });
  } else {
    getProjectStats(opt, (err, res) => {
      if (err) return handleError(err, cb);
      if (!res || !res[opt.version]) return handleError(new Error('Nothing found!'), cb);

      const toDownload = [];
      const lngsToCheck = opt.language ? [opt.language] : (opt.languages && opt.languages.length > 0) ? opt.languages : Object.keys(res[opt.version]);
      lngsToCheck.forEach((l) => {
        if (opt.namespaces) {
          opt.namespaces.forEach((n) => {
            if (!res[opt.version][l][n]) return;
            if (opt.skipEmpty && res[opt.version][l][n].segmentsTranslated === 0) return;
            toDownload.push({
              url: `${opt.apiPath}/${opt.projectId}/${opt.version}/${l}/${n}`,
              key: `${opt.projectId}/${opt.version}/${l}/${n}`,
              lastModified: '1960-01-01T00:00:00.000Z',
              size: 0
            });
          });
        } else if (opt.namespace) {
          if (!res[opt.version][l][opt.namespace]) return;
          if (opt.skipEmpty && res[opt.version][l][opt.namespace].segmentsTranslated === 0) return;
          toDownload.push({
            url: `${opt.apiPath}/${opt.projectId}/${opt.version}/${l}/${opt.namespace}`,
            key: `${opt.projectId}/${opt.version}/${l}/${opt.namespace}`,
            lastModified: '1960-01-01T00:00:00.000Z',
            size: 0
          });
        } else {
          Object.keys(res[opt.version][l]).forEach((n) => {
            if (opt.skipEmpty && res[opt.version][l][n].segmentsTranslated === 0) return;
            toDownload.push({
              url: `${opt.apiPath}/${opt.projectId}/${opt.version}/${l}/${n}`,
              key: `${opt.projectId}/${opt.version}/${l}/${n}`,
              lastModified: '1960-01-01T00:00:00.000Z',
              size: 0
            });
          });
        }
      });
      cb(null, toDownload);
    });
  }
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
        (typeof local[k] === 'object' && local[k] && local[k].value && remote[k] !== local[k].value) ||
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
  async.mapLimit(localNamespaces, 20, (ns, clb) => {
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

const downloadAll = (opt, remoteLanguages, omitRef, manipulate, cb) => {
  if (typeof cb !== 'function') {
    if (typeof manipulate === 'function') {
      cb = manipulate;
      manipulate = undefined;
    }
    if (typeof omitRef === 'function') {
      cb = omitRef;
      manipulate = undefined;
      omitRef = false;
    }
  }

  if (!opt.dry && opt.format !== 'xcstrings') cleanupLanguages(opt, remoteLanguages);

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

    if (opt.format === 'xcstrings') { // 1 file per namespace including all languages
      const downloadsByNamespace = {};
      downloads.forEach((download) => {
        const { namespace } = getInfosInUrl(download);
        downloadsByNamespace[namespace] = downloadsByNamespace[namespace] || [];
        downloadsByNamespace[namespace].push(download);
      });

      async.eachLimit(Object.keys(downloadsByNamespace), opt.unpublished ? 5 : 20, (namespace, clb) => {
        const locizeData = {
          sourceLng: opt.referenceLanguage,
          resources: {}
        };

        async.eachLimit(downloadsByNamespace[namespace], opt.unpublished ? 5 : 20, (download, clb) => {
          const { language } = getInfosInUrl(download);
          opt.isPrivate = download.isPrivate;

          if (opt.language && opt.language !== language && language !== opt.referenceLanguage) return clb(null);
          if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(language) < 0 && language !== opt.referenceLanguage) return clb(null);
          if (opt.namespace && opt.namespace !== namespace) return clb(null);
          if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return clb(null);

          if (opt.unpublished) opt.raw = true;
          getRemoteNamespace(opt, language, namespace, (err, ns, lastModified) => {
            if (err) return clb(err);

            if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
              return clb(null);
            }

            if (manipulate && typeof manipulate == 'function') manipulate(language, namespace, ns);

            locizeData.resources[language] = ns;
            clb();
          });
        }, (err) => {
          if (err) return clb(err);

          try {
            const converted = locize2xcstrings(locizeData);

            const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, '').replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
            if (opt.dry) return clb(null);
            if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) && filledMask.lastIndexOf(path.sep) > 0) {
              mkdirp.sync(path.join(opt.path, filledMask.substring(0, filledMask.lastIndexOf(path.sep))));
            }
            const parentDir = path.dirname(path.join(opt.path, filledMask));
            mkdirp.sync(parentDir);
            const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
            fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
          } catch (e) {
            err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
            return clb(err);
          }
        });
      }, cb);
    } else { // 1 file per namespace/lng
      async.eachLimit(downloads, opt.unpublished ? 5 : 20, (download, clb) => {
        const { language, namespace } = getInfosInUrl(download);
        opt.isPrivate = download.isPrivate;

        if (opt.language && opt.language !== language && language !== opt.referenceLanguage) return clb(null);
        if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(language) < 0 && language !== opt.referenceLanguage) return clb(null);
        if (opt.namespace && opt.namespace !== namespace) return clb(null);
        if (opt.namespaces && opt.namespaces.length > 0 && opt.namespaces.indexOf(namespace) < 0) return clb(null);

        getRemoteNamespace(opt, language, namespace, (err, ns, lastModified) => {
          if (err) return clb(err);

          if (opt.skipEmpty && Object.keys(flatten(ns)).length === 0) {
            return clb(null);
          }

          if (manipulate && typeof manipulate == 'function') manipulate(language, namespace, ns);

          convertToDesiredFormat(opt, namespace, language, ns, lastModified, (err, converted) => {
            if (err) {
              err.message = 'Invalid content for "' + opt.format + '" format!\n' + (err.message || '');
              return clb(err);
            }

            const filledMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, language).replace(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`, namespace) + reversedFileExtensionsMap[opt.format];
            if (opt.dry) return clb(null);
            if (opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`) > opt.pathMask.indexOf(`${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`) && filledMask.lastIndexOf(path.sep) > 0) {
              mkdirp.sync(path.join(opt.path, filledMask.substring(0, filledMask.lastIndexOf(path.sep))));
            }
            const parentDir = path.dirname(path.join(opt.path, filledMask));
            mkdirp.sync(parentDir);
            const fileContent = (opt.format !== 'xlsx' && !converted.endsWith('\n')) ? (converted + '\n') : converted;
            fs.writeFile(path.join(opt.path, filledMask), fileContent, clb);
          });
        });
      }, cb);
    }
  });
};

const update = (opt, lng, ns, shouldOmit, cb) => {
  var data = {};
  if (!opt.skipDelete) {
    ns.diff.toRemove.forEach((k) => data[k] = null);
  }
  ns.diff.toAdd.forEach((k) => data[k] = ns.content[k]);
  if (opt.updateValues) {
    ns.diff.toUpdate.forEach((k) => data[k] = ns.content[k]);
  }

  var keysToSend = Object.keys(data).length;
  if (keysToSend === 0) return cb(null);

  if (opt.dry) return cb(null);

  var payloadKeysLimit = 1000;

  function send(d, so, clb, isRetrying) {
    const queryParams = new URLSearchParams();
    if (opt.autoTranslate && lng === opt.referenceLanguage) {
      /** @See https://www.locize.com/docs/api#optional-autotranslate */
      queryParams.append('autotranslate', 'true');
    }
    if (so) {
      queryParams.append('omitstatsgeneration', 'true');
    }

    const queryString = queryParams.size > 0 ? '?' + queryParams.toString() : '';

    request(opt.apiPath + '/update/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace + queryString, {
      method: 'post',
      body: d,
      headers: {
        'Authorization': opt.apiKey
      }
    }, (err, res, obj) => {
      if (err) return clb(err);
      const cliInfo = res.headers.get('x-cli-info');
      if (cliInfo && cliInfo !== opt.lastShownCliInfo) {
        console.log(colors.yellow(cliInfo));
        opt.lastShownCliInfo = cliInfo;
      }
      if (res.status === 504 && !isRetrying) {
        return setTimeout(() => send(d, so, clb, true), 3000);
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

  if (keysToSend > payloadKeysLimit) {
    var tasks = [];
    var keysInObj = Object.keys(data);

    while (keysInObj.length > payloadKeysLimit) {
      (function() {
        var pagedData = {};
        keysInObj.splice(0, payloadKeysLimit).forEach((k) => pagedData[k] = data[k]);
        var hasMoreKeys = keysInObj.length > 0;
        tasks.push((c) => send(pagedData, hasMoreKeys ? true : shouldOmit, c));
      })();
    }

    if (keysInObj.length === 0) return cb(null);

    var finalPagedData = {};
    keysInObj.splice(0, keysInObj.length).forEach((k) => finalPagedData[k] = data[k]);
    tasks.push((c) => send(finalPagedData, shouldOmit, c));

    async.series(tasks, cb);
    return;
  }

  send(data, shouldOmit, cb);
};

const doesDirectoryExist = (p) => {
  var directoryExists = false;
  try {
    directoryExists = fs.statSync(p).isDirectory();
  } catch (e) {}
  return directoryExists;
};

const cleanupLanguages = (opt, remoteLanguages) => {
  if (opt.pathMask.lastIndexOf(path.sep) < 0) return;
  const dirs = getDirectories(opt.path).filter((dir) => dir.indexOf('.') !== 0);
  if (!opt.language && (!opt.languages || opt.languages.length === 0) && !opt.namespace && !opt.namespaces) {
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
        if (doesDirectoryExist(path.join(opt.path, lngPath, 'CVS'))) return; // special hack for CVS
        rimraf.sync(path.join(opt.path, lngPath));
      });
  }
  remoteLanguages.forEach((lng) => {
    if (opt.language && opt.language !== lng) return;
    if (opt.languages && opt.languages.length > 0 && opt.languages.indexOf(lng) < 0) return;
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

const checkForMissingLocalNamespaces = (downloads, localNamespaces, opt) => {
  const localMissingNamespaces = [];
  downloads.forEach((d) => {
    const splitted = d.url.split('/');
    const namespace = splitted.pop();
    const language = splitted.pop();
    // if (!opt.referenceLanguageOnly || (opt.referenceLanguageOnly && language === opt.referenceLanguage)) {
    if (language === opt.referenceLanguage) {
      const foundLocalNamespace = localNamespaces.find((n) => n.namespace === namespace && n.language === language);
      if (!foundLocalNamespace) {
        localMissingNamespaces.push({
          language,
          namespace
        });
      }
    }
  });
  return localMissingNamespaces;
};

const backupDeleted = (opt, ns, now) => {
  if (opt.dry || ns.diff.toRemove.length === 0) return;
  var m = now.getMonth() + 1;
  if (m < 10) m = `0${m}`;
  var d = now.getDate();
  if (d < 10) d = `0${d}`;
  var h = now.getHours();
  if (h < 10) h = `0${h}`;
  var mi = now.getMinutes();
  if (mi < 10) mi = `0${mi}`;
  var s = now.getSeconds();
  if (s < 10) s = `0${s}`;
  const currentBackupPath = path.join(opt.backupDeletedPath, `${now.getFullYear()}${m}${d}-${h}${mi}${s}`);
  mkdirp.sync(currentBackupPath);
  const removingRemote = ns.diff.toRemove.reduce((prev, k) => {
    prev[k] = ns.remoteContent[k];
    return prev;
  }, {});
  mkdirp.sync(path.join(currentBackupPath, ns.language));
  const content = JSON.stringify(removingRemote, null, 2);
  const fileContent = (opt.format !== 'xlsx' && !content.endsWith('\n')) ? (content + '\n') : content;
  fs.writeFileSync(path.join(currentBackupPath, ns.language, `${ns.namespace}.json`), fileContent);
};

const handleSync = (opt, remoteLanguages, localNamespaces, cb) => {
  if (!localNamespaces || localNamespaces.length === 0) {
    downloadAll(opt, remoteLanguages, (err) => {
      if (err) return handleError(err, cb);
      if (!cb) console.log(colors.green('FINISHED'));
      if (cb) cb(null);
    });
    return;
  }

  getDownloads(opt, (err, downloads) => {
    if (err) return handleError(err, cb);

    opt.isPrivate = downloads.length > 0 && downloads[0].isPrivate;

    const localMissingNamespaces = checkForMissingLocalNamespaces(downloads, localNamespaces, opt);

    compareNamespaces(opt, localNamespaces, (err, compared) => {
      if (err) return handleError(err, cb);

      const onlyToUpdate = compared.filter((ns) => ns.diff.toAdd.concat(opt.skipDelete ? [] : ns.diff.toRemove).concat(ns.diff.toUpdate).length > 0);

      const lngsInReqs = [];
      const nsInReqs = [];
      onlyToUpdate.forEach((n) => {
        if (lngsInReqs.indexOf(n.language) < 0) {
          lngsInReqs.push(n.language);
        }
        if (nsInReqs.indexOf(n.namespace) < 0) {
          nsInReqs.push(n.namespace);
        }
      });
      const shouldOmit = lngsInReqs.length > 5 || nsInReqs.length > 5;

      var wasThereSomethingToUpdate = opt.autoTranslate || false;

      function updateComparedNamespaces() {
        const now = new Date();
        async.eachLimit(compared, Math.round(require('os').cpus().length / 2), (ns, clb) => {
          if (!cb) {
            if (ns.diff.toRemove.length > 0) {
              if (opt.skipDelete) {
                console.log(colors.bgRed(`skipping the removal of ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`));
                if (opt.dry) console.log(colors.bgRed(`skipped to remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`));
              } else {
                console.log(colors.red(`removing ${ns.diff.toRemove.length} keys in ${ns.language}/${ns.namespace}...`));
                if (opt.dry) console.log(colors.red(`would remove ${ns.diff.toRemove.join(', ')} in ${ns.language}/${ns.namespace}...`));
                if (!opt.dry && opt.backupDeletedPath) backupDeleted(opt, ns, now);
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
              if (opt.skipDelete) {
                console.log(colors.bgGreen(`skipping the addition of ${ns.diff.toAddLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
                if (opt.dry) console.log(colors.bgGreen(`skipped the addition of ${ns.diff.toAddLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
              } else {
                console.log(colors.green(`adding ${ns.diff.toAddLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
                if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAddLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
              }
            }
            if (opt.updateValues) {
              if (ns.diff.toUpdate.length > 0) {
                console.log(colors.yellow(`updating ${ns.diff.toUpdate.length} keys in ${ns.language}/${ns.namespace}${opt.autoTranslate ? ' with automatic translation' : ''}...`));
                if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdate.join(', ')} in ${ns.language}/${ns.namespace}...`));
              }
              if (ns.diff.toUpdateLocally.length > 0) {
                console.log(colors.yellow(`updating ${ns.diff.toUpdateLocally.length} keys in ${ns.language}/${ns.namespace} locally...`));
                if (opt.dry) console.log(colors.yellow(`would update ${ns.diff.toUpdateLocally.join(', ')} in ${ns.language}/${ns.namespace} locally...`));
              }
            }
            const somethingToUpdate = ns.diff.toAdd.concat(opt.skipDelete ? [] : ns.diff.toRemove)/*.concat(ns.diff.toUpdate)*/.length > 0;
            if (!somethingToUpdate) console.log(colors.grey(`nothing to update for ${ns.language}/${ns.namespace}`));
            if (!wasThereSomethingToUpdate && somethingToUpdate) wasThereSomethingToUpdate = true;
          }
          update(opt, ns.language, ns, shouldOmit, (err) => {
            if (err) return clb(err);
            if (ns.diff.toRemove.length === 0 || ns.language !== opt.referenceLanguage) return clb();
            const nsOnlyRemove = cloneDeep(ns);
            nsOnlyRemove.diff.toAdd = [];
            nsOnlyRemove.diff.toUpdate = [];
            async.eachLimit(remoteLanguages, Math.round(require('os').cpus().length / 2), (lng, clb) => update(opt, lng, nsOnlyRemove, shouldOmit, clb), clb);
          });
        }, (err) => {
          if (err) return handleError(err, cb);
          if (!cb) console.log(colors.grey('syncing...'));

          function down() {
            setTimeout(() => { // wait a bit before downloading... just to have a chance to get the newly published files
              downloadAll(opt, remoteLanguages, false, opt.skipDelete ? (lng, namespace, ns) => {
                const found = compared.find((n) => n.namespace === namespace && n.language === lng);
                if (found && found.diff) {
                  if (found.diff.toAddLocally && found.diff.toAddLocally.length > 0) {
                    found.diff.toAddLocally.forEach((k) => {
                      delete ns[k];
                    });
                  }
                  if (found.diff.toRemove && found.diff.toRemove.length > 0) {
                    found.diff.toRemove.forEach((k) => {
                      delete ns[k];
                    });
                  }
                }
              } : undefined, (err) => {
                if (err) return handleError(err, cb);
                if (!cb) console.log(colors.green('FINISHED'));
                if (cb) cb(null);
              });
            }, wasThereSomethingToUpdate && !opt.dry ? (opt.autoTranslate ? 10000 : 5000) : 0);
          }

          if (!shouldOmit) return down();
          if (opt.dry) return down();

          // optimize stats generation...
          request(opt.apiPath + '/stats/project/regenerate/' + opt.projectId + '/' + opt.version + (lngsInReqs.length === 1 ? `/${lngsInReqs[0]}` : '') + (nsInReqs.length === 1 ? `?namespace=${nsInReqs[0]}` : ''), {
            method: 'post',
            body: {},
            headers: {
              'Authorization': opt.apiKey
            }
          }, (err, res, obj) => {
            if (err) return handleError(err, cb);
            if (res.status >= 300 && res.status !== 412) {
              if (obj && (obj.errorMessage || obj.message)) {
                return handleError(new Error((obj.errorMessage || obj.message)), cb);
              }
              return handleError(new Error(res.statusText + ' (' + res.status + ')'), cb);
            }
            down();
          });
        });
      }

      if (opt.deleteRemoteNamespace && localMissingNamespaces.length > 0) {
        wasThereSomethingToUpdate = true;
        async.eachLimit(localMissingNamespaces, 20, (n, clb) => {
          if (opt.dry) {
            console.log(colors.red(`would delete complete namespace ${n.namespace}...`));
            return clb();
          }
          console.log(colors.red(`deleting complete namespace ${n.namespace}...`));
          deleteNamespace({
            apiPath: opt.apiPath,
            apiKey: opt.apiKey,
            projectId: opt.projectId,
            version: opt.version,
            namespace: n.namespace
          }, clb);
        }, (err) => {
          if (err) return handleError(err, cb);
          updateComparedNamespaces();
        });
        return;
      }
      updateComparedNamespaces();
    });
  });
};

const sync = (opt, cb) => {
  opt.format = opt.format || 'json';
  if (!reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`), cb);
  }

  if (opt.autoTranslate && !opt.referenceLanguageOnly) {
    console.log(colors.yellow('Using the "--auto-translate true" option together with the "--reference-language-only false" option might result in inconsistent target language translations (automatic translation vs. what is sent direcly to locize).'));
  }

  opt.version = opt.version || 'latest';
  opt.apiPath = opt.apiPath || 'https://api.locize.app';

  if (!opt.dry && opt.clean) rimraf.sync(path.join(opt.path, '*'));

  if (opt.autoCreatePath === false) {
    if (!doesDirectoryExist(opt.path)) {
      return handleError(new Error(`${opt.path} does not exist!`), cb);
    }
  }
  if (!opt.dry) mkdirp.sync(opt.path);

  if (opt.namespace && opt.namespace.indexOf(',') > 0) {
    opt.namespaces = opt.namespace.split(',');
    delete opt.namespace;
  }

  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{';
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}';
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
  opt.languageFolderPrefix = opt.languageFolderPrefix || '';
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`);
  if (opt.unpublished && !opt.apiKey) {
    return handleError(new Error('Please provide also an api-key!'), cb);
  }

  console.log(colors.grey('checking remote (locize)...'));
  getRemoteLanguages(opt, (err, remoteLanguages) => {
    if (err) return handleError(err, cb);

    if (opt.referenceLanguageOnly && opt.language && opt.referenceLanguage !== opt.language) {
      opt.referenceLanguage = opt.language;
    }
    if (opt.referenceLanguageOnly && !opt.language && opt.languages && opt.languages.length > 0 && opt.languages.indexOf(opt.referenceLanguage) < 0) {
      opt.referenceLanguage = opt.languages[0];
    }

    if (opt.referenceLanguageOnly) {
      console.log(colors.grey(`checking local${opt.path !== process.cwd() ? ` (${opt.path})` : ''} only reference language...`));
      parseLocalReference(opt, (err, localNamespaces) => {
        if (err) return handleError(err, cb);

        if (!opt.dry && opt.cleanLocalFiles) {
          localNamespaces.forEach((ln) => fs.unlinkSync(ln.path));
          localNamespaces = [];
        }

        console.log(colors.grey('calculate diffs...'));
        handleSync(opt, remoteLanguages, localNamespaces, cb);
      });
      return;
    }

    console.log(colors.grey(`checking local${opt.path !== process.cwd() ? ` (${opt.path})` : ''}...`));
    parseLocalLanguages(opt, remoteLanguages, (err, localNamespaces) => {
      if (err) return handleError(err, cb);

      if (!opt.dry && opt.cleanLocalFiles) {
        localNamespaces.forEach((ln) => fs.unlinkSync(ln.path));
        localNamespaces = [];
      }

      console.log(colors.grey('calculate diffs...'));
      handleSync(opt, remoteLanguages, localNamespaces, cb);
    });
  });
};

module.exports = sync;
