module.exports = (data) => {
  const result = {};
  for (var i in data) {
    const keys = i.split('.');
    keys.reduce((r, e, j) => {
      const isNumber = !isNaN(Number(keys[j + 1]));
      const hasLeadingZero = isNumber && keys[j + 1].length > 1 && keys[j + 1][0] === '0';
      const tooHighNumberToBeAnArrayIndex = isNumber && Number(keys[j + 1]) > 1000000;
      // if assumed to be an array, but now see a key wih non number value => transform to an object
      if (Array.isArray(r[e]) && (!isNumber || hasLeadingZero || tooHighNumberToBeAnArrayIndex)) {
        r[e] = r[e].reduce((mem, item, ind) => {
          mem[ind] = item;
          return mem;
        }, {});
      }
      return r[e] || (r[e] = (!isNumber || hasLeadingZero || tooHighNumberToBeAnArrayIndex) ? (keys.length - 1 === j ? data[i] : {}) : []);
    }, result);
  }
  return result;
};
