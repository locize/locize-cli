const shouldUnflatten = (json) => {
  const keys = Object.keys(json);
  var shouldUnflatten = true;
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i];

    if (shouldUnflatten && /( |,|\?)/.test(key)) {
      shouldUnflatten = false;
      return shouldUnflatten;
    } else if (shouldUnflatten && key.indexOf('.') > -1 && keys.indexOf(key.substring(0, key.lastIndexOf('.'))) > -1) {
      shouldUnflatten = false;
      return shouldUnflatten;
    }
  }

  return shouldUnflatten;
};

module.exports = shouldUnflatten;
