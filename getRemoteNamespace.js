const request = require('./request');
const flatten = require('flat');
const sortFlatResources = require('./sortFlatResources');

const getRemoteNamespace = (opt, lng, ns, cb) => {
  request(opt.apiPath + (opt.isPrivate ? '/private' : opt.unpublished ? '/pull' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns + '?ts=' + Date.now(), {
    method: 'get',
    headers: (opt.isPrivate || opt.unpublished) ? {
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
