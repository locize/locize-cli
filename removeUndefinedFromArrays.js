// rails seems to start date relevant information in an array with 1 instead of 0
function removeUndefinedFromArrays(obj) {
  if (!obj) return obj;

  const propNames = Object.keys(obj);
  propNames.forEach((propName) => {
    if (Array.isArray(obj[propName]) && obj[propName][0] === undefined) {
      obj[propName].shift();
    } else if (typeof obj[propName] === 'object') {
      removeUndefinedFromArrays(obj[propName]);
    }
  });

  return obj;
}

module.exports = removeUndefinedFromArrays;
