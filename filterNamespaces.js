const filterNamespaces = (opt, nss) => {
  if (opt.namespace) {
    nss = nss.filter((ns) => ns.namespace === opt.namespace);
  }
  if (opt.namespaces && opt.namespaces.length > 0) {
    nss = nss.filter((ns) => opt.namespaces.indexOf(ns.namespace) > -1);
  }
  return nss;
};

module.exports = filterNamespaces;
