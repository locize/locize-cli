module.exports = (data, testNatural) => {
  const result = {};
  const shouldConvertArray = {};
  for (const i in data) {
    let keys = [];
    if (testNatural && /( |,|\?)/.test(i)) {
      keys = [i];
    } else {
      keys = i.split('.');
    }
    keys.reduce((r, e, j) => {
      const isNumber = !isNaN(Number(keys[j + 1]));
      const hasLeadingZero = isNumber && keys[j + 1].length > 1 && keys[j + 1][0] === '0';
      const tooHighNumberToBeAnArrayIndex = isNumber && Number(keys[j + 1]) > 1000;
      // if assumed to be an array, but now see a key wih non number value => transform to an object
      if (Array.isArray(r[e]) && (!isNumber || hasLeadingZero || tooHighNumberToBeAnArrayIndex)) {
        r[e] = r[e].reduce((mem, item, ind) => {
          mem[ind] = item;
          return mem;
        }, {});
      }
      if (Array.isArray(r[e]) && r[e].length > 50) {
        const base = i.substring(0, i.indexOf(e) + e.length);
        if (Object.values(r[e]).length < (r[e].length / 2)) {
          shouldConvertArray[base] = true;
        } else if (shouldConvertArray[base]) {
          delete shouldConvertArray[base];
        }
      }
      if (typeof r === 'string') {
        if (e === '' && keys.length > 2) {
          const lastPart = keys[keys.length - 2] + '.';
          const firstParts = keys.slice(0, keys.length - 2);
          let obj;
          try {
            obj = firstParts.reduce((acc, p) => acc[p], result);
          } catch (err) {
            if (firstParts.indexOf('') < 0) throw err;

            let navRes = result;
            for (let ind = 0; ind < firstParts.length; ind++) {
              const p = firstParts[ind];
              if (typeof navRes[p] === 'object') {
                navRes = navRes[p];
              } else {
                const rest = firstParts.slice(ind).map((c) => (c === '' ? '.' : c)).join('.');
                navRes[rest] = data[i];
                break;
              }
            }
          }
          if (obj && typeof obj !== 'string' && obj[lastPart] === undefined) {
            obj[lastPart] = data[i];
          }
        }
        return r;
      }
      return r[e] || (r[e] = (!isNumber || hasLeadingZero || tooHighNumberToBeAnArrayIndex) ? (keys.length - 1 === j ? data[i] : {}) : []);
    }, result);
  }
  const arrsToConvert = Object.keys(shouldConvertArray);
  arrsToConvert.forEach((arrToConvert) => {
    const parts = arrToConvert.split('.');
    let pr = result;
    parts.forEach((part, ind) => {
      if (ind === parts.length - 1 && Array.isArray(pr[part])) {
        pr[part] = pr[part].reduce((mem, item, ind) => {
          mem[ind] = item;
          return mem;
        }, {});
      } else {
        pr = pr[part];
      }
    });
  });
  return result;
};
