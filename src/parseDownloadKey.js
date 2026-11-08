// A key of the API's /download listing, as stored (never URL-encoded): [private/]<projectId>/<version>/<language>/<namespace>.
// A legacy namespace may contain '/', so the namespace is everything after the language.
// ponytail: the version is one segment, which holds for every listing of a requested version (the API refuses '/' in
// it); a whole-project listing of a legacy slashed version would need the project's version names.
export default function parseDownloadKey (key) {
  const [projectId, version, language, ...namespace] = key.replace(/^private\//, '').split('/')
  return { projectId, version, language, namespace: namespace.join('/') }
}

// A key with an empty, '.' or '..' segment in its version, language or namespace would write outside the target
// folder (names from before the API refused '..'): such a key is skipped.
export const isWritableKey = (key) => {
  const { version, language, namespace } = parseDownloadKey(key)
  return [version, language, ...namespace.split('/')].every((s) => s && s !== '.' && s !== '..')
}
