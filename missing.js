const colors = require('colors');
const async = require('async');
const path = require('path');
const request = require('./request');
const formats = require('./formats');
const reversedFileExtensionsMap = formats.reversedFileExtensionsMap;
const getRemoteLanguages = require('./getRemoteLanguages');
const parseLocalReference = require('./parseLocalReference');
const parseLocalLanguages = require('./parseLocalLanguages');
const getRemoteNamespace = require('./getRemoteNamespace');

const compareNamespace = (local, remote) => {
  const diff = {
    toAdd: []
  };
  local = local || {};
  remote = remote || {};
  Object.keys(local).forEach((k) => {
    if (remote[k] === '' && local[k] === '') return;
    if (!remote[k]) {
      diff.toAdd.push(k);
    }
  });
  return diff;
};

const compareNamespaces = (opt, localNamespaces, cb) => {
  async.map(localNamespaces, (ns, clb) => {
    getRemoteNamespace(opt, ns.language, ns.namespace, (err, remoteNamespace) => {
      if (err) return clb(err);

      const diff = compareNamespace(ns.content, remoteNamespace);
      ns.diff = diff;
      ns.remoteContent = remoteNamespace;
      clb(null, ns);
    });
  }, cb);
};

const saveMissing = (opt, lng, ns, cb) => {
  var data = {};
  ns.diff.toAdd.forEach((k) => data[k] = ns.content[k]);

  if (Object.keys(data).length === 0) return cb(null);

  if (opt.dry) return cb(null);

  var payloadKeysLimit = 1000;

  function send(d, clb, isRetrying) {
    request(opt.apiPath + '/missing/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns.namespace, {
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

const handleError = (err, cb) => {
  if (!cb && err) {
    console.error(colors.red(err.stack));
    process.exit(1);
  }
  if (cb) cb(err);
};

const handleMissing = (opt, localNamespaces, cb) => {
  if (!localNamespaces || localNamespaces.length === 0) {
    return handleError(new Error('No local namespaces found!'));
  }

  compareNamespaces(opt, localNamespaces, (err, compared) => {
    if (err) return handleError(err);

    async.eachLimit(compared, Math.round(require('os').cpus().length / 2), (ns, clb) => {
      if (!cb) {
        if (ns.diff.toAdd.length > 0) {
          console.log(colors.green(`adding ${ns.diff.toAdd.length} keys in ${ns.language}/${ns.namespace}...`));
          if (opt.dry) console.log(colors.green(`would add ${ns.diff.toAdd.join(', ')} in ${ns.language}/${ns.namespace}...`));
        }
      }
      saveMissing(opt, ns.language, ns, clb);
    }, (err) => {
      if (err) return handleError(err);
      if (!cb) console.log(colors.green('FINISHED'));
      if (cb) cb(null);
    });
  });
};

const missing = (opt, cb) => {
  if (!reversedFileExtensionsMap[opt.format]) {
    return handleError(new Error(`${opt.format} is not a valid format!`));
  }

  if (opt.namespace && opt.namespace.indexOf(',') > 0) {
    opt.namespaces = opt.namespace.split(',');
    delete opt.namespace;
  }

  opt.pathMaskInterpolationPrefix = opt.pathMaskInterpolationPrefix || '{{';
  opt.pathMaskInterpolationSuffix = opt.pathMaskInterpolationSuffix || '}}';
  opt.pathMask = opt.pathMask || `${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}${path.sep}${opt.pathMaskInterpolationPrefix}namespace${opt.pathMaskInterpolationSuffix}`;
  opt.languageFolderPrefix = opt.languageFolderPrefix || '';
  opt.pathMask = opt.pathMask.replace(`${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`, `${opt.languageFolderPrefix}${opt.pathMaskInterpolationPrefix}language${opt.pathMaskInterpolationSuffix}`);

  getRemoteLanguages(opt, (err, remoteLanguages) => {
    if (err) return handleError(err);

    if (opt.referenceLanguageOnly && opt.language && opt.referenceLanguage !== opt.language) {
      opt.referenceLanguage = opt.language;
    }

    if (opt.referenceLanguageOnly) {
      parseLocalReference(opt, (err, localNamespaces) => {
        if (err) return handleError(err);

        handleMissing(opt, localNamespaces, cb);
      });
      return;
    }

    parseLocalLanguages(opt, remoteLanguages, (err, localNamespaces) => {
      if (err) return handleError(err);

      handleMissing(opt, localNamespaces, cb);
    });
  });
};

module.exports = missing;
