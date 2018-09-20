const request = require('request');
const flatten = require('flat');

const getRemoteNamespace = (opt, lng, ns, cb) => {
  request({
    method: 'GET',
    json: true,
    url: opt.apiPath + (opt.isPrivate ? '/private' : '') + '/' + opt.projectId + '/' + opt.version + '/' + lng + '/' + ns,
    headers: opt.isPrivate ? {
      'Authorization': opt.apiKey
    } : undefined
  }, (err, res, obj) => {
    if (err || (obj && (obj.errorMessage || obj.message))) {
      if (err) return cb(err);
      if (obj && (obj.errorMessage || obj.message)) return cb(new Error((obj.errorMessage || obj.message)));
    }
    if (res.statusCode >= 300) return cb(new Error(res.statusMessage + ' (' + res.statusCode + ')'));
    cb(null, flatten(obj), res.headers['last-modified'] ? new Date(res.headers['last-modified']) : undefined);
  });
};

module.exports = getRemoteNamespace;
