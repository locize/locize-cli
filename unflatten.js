const unflatten = (data) => {
  const result = {};
  for (var i in data) {
    const keys = i.split('.');
    keys.reduce((r, e, j) => {
      const isNumber = !isNaN(Number(keys[j + 1]));
      // if assumed to be an array, but now see a key wih non number value => transform to an object
      if (Array.isArray(r[e]) && !isNumber) {
        r[e] = r[e].reduce((mem, item, ind) => {
          mem[ind] = item;
          return mem;
        }, {});
      }
      return r[e] || (r[e] = !isNumber ? (keys.length - 1 == j ? data[i] : {}) : []);
    }, result);
  }
  return result;
};

module.exports = unflatten;
