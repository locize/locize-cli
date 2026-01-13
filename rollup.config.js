import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import replace from '@rollup/plugin-replace'
// import terser from '@rollup/plugin-terser'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default {
  input: {
    index: 'src/index.js',
    cli: 'src/cli.js'
  },
  output: [
    {
      dir: 'dist/cjs',
      preserveModules: true,
      // file: pkg.main,
      format: 'cjs'
    },
    {
      dir: 'dist/esm',
      preserveModules: true,
      // file: pkg.module,
      format: 'es' // the preferred format
    },
    // {
    //   file: pkg.browser,
    //   format: 'iife',
    //   name: pkg.globalName // the global which can be used in a browser
    // }
  ],
  external: [
    ...Object.keys(pkg.dependencies || {})
  ],
  plugins: [
    replace({
      __packageName__: pkg.name,
      __packageVersion__: pkg.version,
      __v_packageVersion__: `v${pkg.version}`,
      preventAssignment: true
    }),
    // terser(), // minifies generated bundles
    {
      name: 'post-build-steps',
      writeBundle () {
        // Make CLI files executable
        try { chmodSync('dist/esm/cli.js', 0o755) } catch {}
        try { chmodSync('dist/cjs/cli.js', 0o755) } catch {}
        // Write CJS package.json with name, version, and type
        const cjsPkg = {
          name: pkg.name,
          version: pkg.version,
          type: 'commonjs'
        }
        writeFileSync('dist/cjs/package.json', JSON.stringify(cjsPkg, null, 2) + '\n')
      }
    }
  ]
}
