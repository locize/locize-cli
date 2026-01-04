const sortFlatResources = (resources) => {
  const keys = Object.keys(resources).sort()
  const cleaned = {}
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]
    cleaned[key] = resources[key]
  }
  return cleaned
}
export default sortFlatResources
