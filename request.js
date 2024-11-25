const package = require('./package.json');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');
const CacheableLookup = require('cacheable-lookup');
const cacheable = new CacheableLookup();
cacheable.install(https.globalAgent);

const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY || process.env.https_proxy || process.env.HTTPS_PROXY;

const isRetriableError = (err) => {
  return err && err.message && (
    err.message.indexOf('ETIMEDOUT') > -1 || // on timeout retry
    err.message.indexOf('FetchError') > -1 ||
    err.code === 'ETIMEDOUT' ||
    // on dns errors
    err.message.indexOf('ENOTFOUND') > -1 ||
    err.message.indexOf('ENODATA') > -1 ||
    err.message.indexOf('ENOENT') > -1 // Windows: name exists, but not this record type
  );
};

const isJSONResponse = (res) => res.headers.get('content-type') && res.headers.get('content-type').indexOf('json') > 0;

const handleResponse = (res) => {
  if (isJSONResponse(res)) {
    return new Promise((resolve, reject) => res.json().then((obj) => resolve({ res, obj })).catch(reject));
  } else {
    return { res };
  }
};

const handleSuccessful = (callback) => (ret) => callback(null, ret.res, ret.obj);

module.exports = (url, options, callback) => {
  if (httpProxy) {
    const httpsProxyAgent = new HttpsProxyAgent(httpProxy);
    cacheable.install(httpsProxyAgent);
    options.agent = httpsProxyAgent;
  }

  options.headers = options.headers || {};
  options.headers['User-Agent'] = `${package.name}/v${package.version} (node/${process.version}; ${process.platform} ${process.arch})`;
  options.headers['X-User-Agent'] = options.headers['User-Agent'];
  if (options.body || options.method !== 'get') options.headers['Content-Type'] = 'application/json';
  if (options.body) {
    if (typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }
  }
  if (options.headers['Authorization'] === undefined) delete options.headers['Authorization'];

  function retriableFetch(maxRetries) {
    fetch(url, options).then(handleResponse).then(handleSuccessful(callback)).catch((err) => {
      if (maxRetries < 1) return callback(err);
      if (!isRetriableError(err)) return callback(err);
      setTimeout(() => {
        retriableFetch(--maxRetries);
      }, 5000);
    });
  }

  retriableFetch(3);
};
