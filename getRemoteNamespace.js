const request = require('request');
const flatten = require('flat');
const sortFlatResources = require('./sortFlatResources');

const getRemoteNamespace = (opt, lng, ns, cb) => {
  request({
    method: 'GET',
    json: true,
    url: opt.apiPath + (opt.isPrivate ? '/private' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns,
    headers: opt.isPrivate ? {
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
    cb(null, sortFlatResources(flatten(obj)), res.headers['last-modified'] ? new Date(res.headers['last-modified']) : undefined);
  });
};

module.exports = getRemoteNamespace;
