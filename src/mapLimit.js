export default async function mapLimit (arr, limit, asyncFn) {
  const ret = []
  let i = 0
  let active = 0
  return new Promise((resolve, reject) => {
    function next () {
      if (i === arr.length && active === 0) return resolve(ret)
      while (active < limit && i < arr.length) {
        const cur = i++
        active++
        Promise.resolve(asyncFn(arr[cur], cur, arr))
          .then((res) => { ret[cur] = res; active--; next() })
          .catch(reject)
      }
    }
    next()
  })
}
