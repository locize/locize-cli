const neostandard = require('neostandard')
const importPlugin = require('eslint-plugin-import')

module.exports = [
  // — your neostandard base —
  ...neostandard({
    // ts: true,
    ignores: ['build/**/*'],
    env: ['mocha']
  }),

  // — add import-plugin + import/no-unresolved —
  {
    // target all JS/TS files
    files: ['**/*.{js,jsx,ts,tsx}'],

    // register the import plugin
    plugins: {
      import: importPlugin
    },

    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'], // any extensions you use
          moduleDirectory: ['node_modules'] // adjust if you alias
        }
        // If you use webpack or TypeScript paths, you can swap in those resolvers here
      }
    }
  }
]
