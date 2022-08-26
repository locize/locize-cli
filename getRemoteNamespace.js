const request = require('./request');
const flatten = require('flat');
const sortFlatResources = require('./sortFlatResources');

const getRandomDelay = (delayFrom, delayTo) => Math.floor(Math.random() * delayTo) + delayFrom;

const pullNamespacePaged = (opt, lng, ns, cb, next, retry) => {
  next = next || '';
  request(opt.apiPath + '/pull/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?' + 'next=' + next + '&ts=' + Date.now(), {
    method: 'get',
    headers: {
      'Authorization': opt.apiKey
    }
  }, (err, res, obj) => {
    if (err) return cb(err);
    if (res.status >= 300) {
      retry = retry || 0;
      if (retry < 3 && res.status !== 401) {
        setTimeout(() => {
          pullNamespacePaged(opt, lng, ns, cb, next, retry + 1);
        }, getRandomDelay(3000, 10000));
        return;
      }
      if (obj && (obj.errorMessage || obj.message)) {
        return cb(new Error((obj.errorMessage || obj.message)));
      }
      return cb(new Error(res.statusText + ' (' + res.status + ')'));
    }

    cb(null, {
      result: sortFlatResources(flatten(obj)),
      next: res.headers.get('x-next-page'),
      lastModified: res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined
    });
  });
};

const pullNamespace = (opt, lng, ns, cb) => {
  var ret = {};
  var lastModified = new Date(2000, 0, 1);
  (function nextPage(next) {
    pullNamespacePaged(opt, lng, ns, (err, info) => {
      if (err) return cb(err);

      Object.keys(info.result).forEach((k) => {
        ret[k] = info.result[k];
      });

      if (info.lastModified.getTime() > lastModified.getTime()) {
        lastModified = info.lastModified;
      }

      if (info.next) {
        return nextPage(info.next);
      }
      cb(null, ret, lastModified);
    }, next);
  })();
};

const getRemoteNamespace = (opt, lng, ns, cb) => {
  if (opt.unpublished) return pullNamespace(opt, lng, ns, cb);

  request(opt.apiPath + (opt.isPrivate ? '/private' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?ts=' + Date.now(), {
    method: 'get',
    headers: opt.isPrivate ? {
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
    cb(null, sortFlatResources(flatten(obj)), res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined);
  });
};

module.exports = getRemoteNamespace;
