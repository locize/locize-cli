const package = require('./package.json');
const fetch = require('node-fetch');

module.exports = (url, options, callback) => {
  options.headers = options.headers || {};
  options.headers['User-Agent'] = `${package.name}/${package.version} (node/${process.version}; ${process.platform} ${process.arch})`;
  if (options.body || options.method !== 'get') options.headers['Content-Type'] = 'application/json';
  if (options.body) {
    if (typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }
  }
  if (options.headers['Authorization'] === undefined) delete options.headers['Authorization'];
  fetch(url, options).then((res) => {
    if (res.headers.get('content-type') && res.headers.get('content-type').indexOf('json') > 0) {
      return new Promise((resolve, reject) => res.json().then((obj) => resolve({ res, obj })).catch(reject));
    } else {
      return { res };
    }
  }).then((ret) => callback(null, ret.res, ret.obj)).catch(callback);
};
