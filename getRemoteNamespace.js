const request = require('./request');
const flatten = require('flat');
const sortFlatResources = require('./sortFlatResources');

const getRandomDelay = (delayFrom, delayTo) => Math.floor(Math.random() * delayTo) + delayFrom;

const getRemoteNamespace = (opt, lng, ns, cb, retry) => {
  request(opt.apiPath + (opt.isPrivate ? '/private' : opt.unpublished ? '/pull' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?ts=' + Date.now(), {
    method: 'get',
    headers: (opt.isPrivate || opt.unpublished) ? {
      'Authorization': opt.apiKey
    } : undefined
  }, (err, res, obj) => {
    if (err) return cb(err);
    if (res.status >= 300) {
      retry = retry || 0;
      if (retry < 3 && res.status !== 401) {
        setTimeout(() => {
          getRemoteNamespace(opt, lng, ns, cb, retry + 1);
        }, opt.unpublished ? getRandomDelay(3000, 10000) : getRandomDelay(100, 1000));
        return;
      }
      if (obj && (obj.errorMessage || obj.message)) {
        return cb(new Error((obj.errorMessage || obj.message)));
      }
      return cb(new Error(res.statusText + ' (' + res.status + ')'));
    }
    cb(null, sortFlatResources(flatten(obj)), res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')) : undefined);
  });
};

module.exports = getRemoteNamespace;
