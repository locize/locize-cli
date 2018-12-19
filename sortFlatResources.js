module.exports = (resources) => {
  const keys = Object.keys(resources).sort();
  var cleaned = {};
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i];
    cleaned[key] = resources[key];
  }
  return cleaned;
};
