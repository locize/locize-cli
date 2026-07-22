# Vendored SheetJS (xlsx) 0.20.3

- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (`xlsx.mjs` + `LICENSE`, tarball sha512-verified against the former package-lock integrity entry)
- Why: SheetJS stopped publishing to npm (last npm release 0.18.5 has known CVEs), and npm 12 blocks remote tarball dependencies by default (`allow-remote=none`), which broke installing locize-cli ([#117](https://github.com/locize/locize-cli/issues/117))
- License: Apache-2.0, see `LICENSE` (must stay shipped alongside the compiled bundle; rollup copies it into `dist/`)
- Update: download the new tarball from cdn.sheetjs.com, verify its published hash, replace `xlsx.mjs` and `LICENSE`
