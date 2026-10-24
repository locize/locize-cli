import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import ini from 'ini'
import colors from 'colors'
import request from './request.js'

// The CLI's OAuth client, built into the server (locize-app oauth/routes.js CLI_CLIENT): a loopback
// redirect on a free port and PKCE, no secret (RFC 8252). The server leaves its tokens without the
// agent mark, so they act like a token made in the profile.
export const CLIENT_ID = 'locize-cli'
// what the commands need: read and write for download/sync/migrate, manage for versions, languages
// and branches; never admin. The user's role caps it anyway.
export const SCOPE = 'read write manage'
const TIMEOUT_MS = 5 * 60 * 1000

export const pkce = () => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') }
}

export const authorizeUrl = ({ oauthEndpoint, redirectUri, challenge, state }) => `${oauthEndpoint}/oauth/authorize?${new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: redirectUri,
  scope: SCOPE,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state
})}`

const page = (text) => `<!doctype html><meta charset="utf-8"><title>Locize CLI</title><body style="font-family:sans-serif;margin:3em"><p>${text}</p></body>`

// listens on 127.0.0.1 for the browser's redirect; `code` resolves with the authorization code
export const startCallbackServer = (state, port = 0) => new Promise((resolve, reject) => {
  let settle
  const code = new Promise((resolve, reject) => { settle = { resolve, reject } })
  code.catch(() => {}) // a rejection before anyone awaits it is not a crash; login awaits it
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname !== '/callback') {
      res.writeHead(404)
      return res.end()
    }
    const error = url.searchParams.get('error')
    const ok = !error && url.searchParams.get('state') === state && url.searchParams.get('code')
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page(ok ? 'Signed in. You can close this tab and go back to the terminal.' : 'The sign-in did not work. Go back to the terminal for the details.'))
    if (ok) return settle.resolve(url.searchParams.get('code'))
    settle.reject(new Error(error ? `sign-in failed: ${url.searchParams.get('error_description') || error}` : 'sign-in failed: the answer does not belong to this login'))
  })
  server.on('error', reject)
  server.listen(port, '127.0.0.1', () => resolve({ port: server.address().port, code, close: () => server.close() }))
})

export const exchangeCode = async ({ oauthEndpoint, code, verifier, redirectUri }) => {
  const { res, obj = {} } = await request(`${oauthEndpoint}/oauth/token`, {
    method: 'post',
    body: { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: CLIENT_ID }
  })
  if (!res.ok || !obj.access_token) throw new Error(`sign-in failed: ${obj.error_description || obj.error || res.statusText || res.status}`)
  return { token: obj.access_token, expiresIn: obj.expires_in }
}

// RFC 7009 at the server (locize-app oauth/routes.js): the token itself is the authorization
export const revokeToken = async ({ oauthEndpoint, token }) => {
  const { res } = await request(`${oauthEndpoint}/oauth/revoke`, {
    method: 'post',
    body: { token, client_id: CLIENT_ID }
  })
  if (!res.ok) throw new Error(res.statusText || String(res.status))
}

export const readConfig = (configPath) => {
  try {
    return ini.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (e) {
    return undefined
  }
}

const writeConfig = (configPath, config) => {
  fs.writeFileSync(configPath, ini.stringify(config), { mode: 0o600 })
  fs.chmodSync(configPath, 0o600) // an existing file keeps its mode on write
}

// the token goes into ~/.locize as loginToken, beside whatever else is there (an apiKey stays
// untouched), with its expiry, so the cli can say when a login has run out
export const saveToken = (configPath, token, expiresAt) => {
  const config = readConfig(configPath) || {}
  config.loginToken = token
  if (expiresAt) config.loginTokenExpiresAt = new Date(expiresAt).toISOString()
  else delete config.loginTokenExpiresAt
  writeConfig(configPath, config)
}

// the login token of a config, unless it has expired (then `expired` names the date)
export const loginTokenOf = (config = {}) => {
  const expiresAt = Date.parse(config.loginTokenExpiresAt)
  if (config.loginToken && expiresAt < Date.now()) return { expired: config.loginTokenExpiresAt.slice(0, 10) }
  return { token: config.loginToken }
}

export const removeToken = (configPath) => {
  const config = readConfig(configPath)
  if (!config || !config.loginToken) return false
  delete config.loginToken
  delete config.loginTokenExpiresAt
  writeConfig(configPath, config)
  return true
}

const openBrowser = (url) => {
  const [cmd, args] = process.platform === 'darwin'
    ? ['open', [url]]
    : process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]] // no cmd.exe: & in the URL stays intact
      : ['xdg-open', [url]]
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {}) // no browser here: the printed URL is the way
    child.unref()
  } catch (e) {}
}

export default async function login (opt) {
  const { verifier, challenge } = pkce()
  const state = crypto.randomBytes(16).toString('base64url')
  const callback = await startCallbackServer(state, opt.port)
  const redirectUri = `http://127.0.0.1:${callback.port}/callback`
  const url = authorizeUrl({ oauthEndpoint: opt.oauthEndpoint, redirectUri, challenge, state })

  console.log(colors.yellow(`  sign in to Locize in the browser (waiting on port ${callback.port}):`))
  console.log(`  ${url}`)
  if (opt.browser !== false) openBrowser(url)

  let timer
  try {
    const timeout = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('sign-in failed: no answer within 5 minutes')), TIMEOUT_MS) })
    const code = await Promise.race([callback.code, timeout])
    const { token, expiresIn } = await exchangeCode({ oauthEndpoint: opt.oauthEndpoint, code, verifier, redirectUri })
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined
    saveToken(opt.configPath, token, expiresAt)
    console.log(colors.green(`  signed in; the token is kept in ${opt.configPath} and used whenever no api key is given${expiresAt ? `, until ${new Date(expiresAt).toISOString().slice(0, 10)}` : ''}`))
  } finally {
    clearTimeout(timer)
    callback.close()
  }
}

export async function logout (opt) {
  const token = (readConfig(opt.configPath) || {}).loginToken
  if (!token) {
    console.log(`  no token from locize login in ${opt.configPath}`)
    return
  }
  let failure
  try {
    await revokeToken({ oauthEndpoint: opt.oauthEndpoint, token })
  } catch (err) {
    failure = err.message
  }
  // removed in any case: an offline logout still ends the sign-in on this machine
  removeToken(opt.configPath)
  if (!failure) {
    console.log(colors.green(`  signed out: the token is revoked and removed from ${opt.configPath}`))
    return
  }
  console.log(colors.yellow(`  signed out here: the token is removed from ${opt.configPath}, but revoking it failed (${failure})`))
  console.log('  revoke it in your profile: personal access tokens, "Locize CLI (OAuth)"')
}
