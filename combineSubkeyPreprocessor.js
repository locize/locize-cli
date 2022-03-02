const jsyaml = require('js-yaml');

const delimiter = {
  i18next: '_',
  i18njs: '.'
};

const detectFormat = (keys) => {
  const i18nextMatches = keys.filter((k) => k.indexOf(delimiter.i18next) > 0).length;
  const i18njsMatches = keys.filter((k) => k.indexOf(delimiter.i18njs) > 0).length;
  if (i18nextMatches > i18njsMatches) {
    return 'i18next';
  }
  if (i18nextMatches < i18njsMatches) {
    return 'i18njs';
  }
};

const getBaseKey = (delimiter) => (k) => {
  const parts = k.split(delimiter);
  parts.pop();
  const baseKey = parts.join(delimiter);
  return baseKey;
};

const uniq = (value, index, self) => self.indexOf(value) === index;

const stringify = (o) => {
  let str = jsyaml.dump(o);
  const subKeys = Object.keys(o);
  subKeys.forEach((sk) => {
    if (isNaN(sk)) {
      str = str.replace(new RegExp(`^(?:${sk}: )+`, 'm'), `{${sk}}: `);
    } else {
      str = str.replace(new RegExp(`^(?:'${sk}': )+`, 'm'), `{${sk}}: `);
    }
  });
  return str;
};

const transformKeys = (segments, baseKeys, toMerge, deli) => {
  baseKeys.forEach((bk) => {
    const asObj = toMerge[bk].reduce((mem, k) => {
      const subKey = k.substring((bk + deli).length);
      // special handling for i18next v3
      if (deli === delimiter.i18next && subKey === 'plural' && segments[bk]) {
        mem['__'] = segments[bk];
        delete segments[bk];
      }
      mem[subKey] = segments[k];
      return mem;
    }, {});
    if (Object.keys(asObj).length > 0) {
      const value = stringify(asObj);
      segments[`${bk}__#locize.com/combinedSubkey`] = value;
      toMerge[bk].forEach((k) => {
        delete segments[k];
      });
    }
  });
  return segments;
};

// CLDR
const pluralForms = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other'
];

const endsWithPluralForm = (k) => !!pluralForms.find((f) => k.endsWith(`.${f}`)) || !!pluralForms.find((f) => k.endsWith(`_${f}`)) || /_\d+$/.test(k) || k.endsWith('_plural');

const prepareExport = (refRes, trgRes) => {
  const refLngKeys = Object.keys(refRes);
  const trgLngKeys = Object.keys(trgRes);

  const nonMatchInRef = refLngKeys.filter((k) => trgLngKeys.indexOf(k) < 0 && endsWithPluralForm(k));
  const nonMatchInTrg = trgLngKeys.filter((k) => refLngKeys.indexOf(k) < 0 && endsWithPluralForm(k));

  const allMatches = nonMatchInRef.concat(nonMatchInTrg);

  const format = detectFormat(allMatches);
  if (!format) return { ref: refRes, trg: trgRes };

  const nonMatchBaseKeysInRef = nonMatchInRef.map(getBaseKey(delimiter[format])).filter(uniq);
  const nonMatchBaseKeysInTrg = nonMatchInTrg.map(getBaseKey(delimiter[format])).filter(uniq);
  const nonMatchBaseKeys = nonMatchBaseKeysInRef.concat(nonMatchBaseKeysInTrg).filter(uniq);

  const toMergeInRef = nonMatchBaseKeys.reduce((mem, bk) => {
    mem[bk] = refLngKeys.filter((k) => k.indexOf(bk + delimiter[format]) === 0);
    return mem;
  }, {});
  const toMergeInTrg = nonMatchBaseKeys.reduce((mem, bk) => {
    mem[bk] = trgLngKeys.filter((k) => k.indexOf(bk + delimiter[format]) === 0);
    return mem;
  }, {});

  let falseFlags = nonMatchBaseKeysInRef.filter((k) => toMergeInRef[k].length < 2 && (!toMergeInTrg[k] || toMergeInTrg[k].length < 2));
  falseFlags = falseFlags.concat(nonMatchBaseKeysInTrg.filter((k) => toMergeInTrg[k].length < 2 && (!toMergeInRef[k] || toMergeInRef[k].length < 2)));
  falseFlags.forEach((k) => {
    delete toMergeInRef[k];
    delete toMergeInTrg[k];
    nonMatchBaseKeys.splice(nonMatchBaseKeys.indexOf(k), 1);
  });

  const transformedRef = transformKeys(refRes, nonMatchBaseKeys, toMergeInRef, delimiter[format]);
  const transformedTrg = transformKeys(trgRes, nonMatchBaseKeys, toMergeInTrg, delimiter[format]);
  return { ref: transformedRef, trg: transformedTrg };
};

const skRegex = new RegExp('^(?:{(.+)})+', 'gm');
const parse = (s) => {
  let matchArray;
  while ((matchArray = skRegex.exec(s)) !== null) {
    const [match, sk] = matchArray;
    if (isNaN(sk)) {
      s = s.replace(new RegExp(`^(?:${match}: )+`, 'm'), `${sk}: `);
    } else {
      const escapedMatch = match.replace('{', '\\{').replace('}', '\\}');
      s = s.replace(new RegExp(`^(?:${escapedMatch}: )+`, 'm'), `${sk}: `);
    }
  }
  return jsyaml.load(s);
};

const prepareImport = (resources) => {
  const keys = Object.keys(resources);
  keys.forEach((k) => {
    if (k.indexOf('__#locize.com/combinedSubkey') > -1) {
      const baseKey = k.substring(0, k.indexOf('__#locize.com/combinedSubkey'));
      if (resources[k]) {
        const parsed = parse(resources[k]);
        Object.keys(parsed).map((sk) => {
          const skVal = parsed[sk];
          resources[`${baseKey}_${sk}`] = skVal;
          if (sk === '__') {
            resources[baseKey] = resources[`${baseKey}_${sk}`];
            delete resources[`${baseKey}_${sk}`];
          }
        });
        delete resources[k];
      }
    }
  });
  return resources;
};

module.exports = {
  prepareExport,
  prepareImport
};
