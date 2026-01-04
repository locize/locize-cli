const shouldUnflatten = (json) => {
  const keys = Object.keys(json)
  let shouldUnflatten = true
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]

    if (shouldUnflatten && /( |,|\?)/.test(key)) {
      shouldUnflatten = false
      return shouldUnflatten
    } else if (shouldUnflatten && key.indexOf('.') > -1 && keys.indexOf(key.substring(0, key.lastIndexOf('.'))) > -1) {
      shouldUnflatten = false
      return shouldUnflatten
    }
  }

  return shouldUnflatten
}

export default shouldUnflatten
