import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ini from 'ini'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import login, { logout, pkce, authorizeUrl, startCallbackServer, exchangeCode, saveToken, removeToken, loginTokenOf, CLIENT_ID, SCOPE, DEFAULT_OAUTH_ENDPOINT } from '../src/login.js'

const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url))

// a request to the callback server that bypasses the mocked global fetch
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let body = ''
    res.on('data', (c) => { body += c })
    res.on('end', () => resolve({ status: res.statusCode, body }))
  }).on('error', reject)
})

const jsonResponse = (status, obj) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => obj
})

describe('login', () => {
  let tempDir, configPath, origFetch

  beforeEach(() => {
    origFetch = global.fetch
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-login-test-'))
    configPath = path.join(tempDir, '.locize')
  })

  afterEach(() => {
    global.fetch = origFetch
    vi.restoreAllMocks()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('builds an S256 PKCE pair and the authorize URL of the CLI client', () => {
    const { verifier, challenge } = pkce()
    expect(challenge).toBe(crypto.createHash('sha256').update(verifier).digest('base64url'))
    const url = new URL(authorizeUrl({ oauthEndpoint: 'https://app.example', redirectUri: 'http://127.0.0.1:5000/callback', challenge, state: 'st' }))
    expect(`${url.origin}${url.pathname}`).toBe('https://app.example/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: 'http://127.0.0.1:5000/callback',
      scope: 'read write manage',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'st'
    })
    expect(SCOPE).not.toContain('admin')
  })

  it('takes the code from the callback only with the right state', async () => {
    const ok = await startCallbackServer('right')
    expect((await get(`http://127.0.0.1:${ok.port}/other`)).status).toBe(404)
    expect((await get(`http://127.0.0.1:${ok.port}/callback?code=c1&state=right`)).status).toBe(200)
    await expect(ok.code).resolves.toBe('c1')
    ok.close()

    const wrong = await startCallbackServer('right')
    expect((await get(`http://127.0.0.1:${wrong.port}/callback?code=c1&state=forged`)).status).toBe(400)
    await expect(wrong.code).rejects.toThrow('does not belong to this login')
    wrong.close()

    const denied = await startCallbackServer('right')
    await get(`http://127.0.0.1:${denied.port}/callback?error=access_denied&error_description=User+denied+access&state=right`)
    await expect(denied.code).rejects.toThrow('User denied access')
    denied.close()
  })

  it('exchanges the code at the token endpoint and reports its error', async () => {
    let sent
    global.fetch = vi.fn(async (url, options) => {
      sent = { url, body: JSON.parse(options.body) }
      return jsonResponse(200, { access_token: 'lz_pat_abc', token_type: 'Bearer', expires_in: 7776000 })
    })
    await expect(exchangeCode({ oauthEndpoint: 'https://app.example', code: 'c1', verifier: 'v1', redirectUri: 'http://127.0.0.1:5000/callback' })).resolves.toEqual({ token: 'lz_pat_abc', expiresIn: 7776000 })
    expect(sent.url).toBe('https://app.example/oauth/token')
    expect(sent.body).toEqual({ grant_type: 'authorization_code', code: 'c1', code_verifier: 'v1', redirect_uri: 'http://127.0.0.1:5000/callback', client_id: CLIENT_ID })

    global.fetch = vi.fn(async () => jsonResponse(400, { error: 'invalid_grant', error_description: 'PKCE verification failed.' }))
    await expect(exchangeCode({ oauthEndpoint: 'https://app.example', code: 'c1', verifier: 'v1', redirectUri: 'x' })).rejects.toThrow('PKCE verification failed.')
  })

  it('keeps the token as loginToken beside the other settings, readable by the owner only', () => {
    fs.writeFileSync(configPath, ini.stringify({ projectId: 'pid', apiKey: 'a-project-api-key' }))
    saveToken(configPath, 'lz_pat_new', Date.parse('2027-01-22T10:00:00.000Z'))
    expect(ini.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({ projectId: 'pid', apiKey: 'a-project-api-key', loginToken: 'lz_pat_new', loginTokenExpiresAt: '2027-01-22T10:00:00.000Z' })
    if (process.platform !== 'win32') expect(fs.statSync(configPath).mode & 0o777).toBe(0o600)

    // the default app is not written down
    saveToken(configPath, 'lz_pat_new', undefined, DEFAULT_OAUTH_ENDPOINT)
    expect(ini.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({ projectId: 'pid', apiKey: 'a-project-api-key', loginToken: 'lz_pat_new' })

    // logout takes only the login token, a project's api key stays
    expect(removeToken(configPath)).toBe(true)
    expect(ini.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({ projectId: 'pid', apiKey: 'a-project-api-key' })
    expect(removeToken(configPath)).toBe(false)
    expect(removeToken(path.join(tempDir, 'missing'))).toBe(false)
  })

  it('uses a login token until its expiry, then names the date', () => {
    expect(loginTokenOf({ loginToken: 'lz_pat_a', loginTokenExpiresAt: new Date(Date.now() + 60000).toISOString() })).toEqual({ token: 'lz_pat_a' })
    expect(loginTokenOf({ loginToken: 'lz_pat_a', loginTokenExpiresAt: '2026-01-02T03:04:05.000Z' })).toEqual({ expired: '2026-01-02' })
    expect(loginTokenOf({ loginToken: 'lz_pat_a' })).toEqual({ token: 'lz_pat_a' }) // no expiry stored: the server decides
    expect(loginTokenOf(undefined)).toEqual({ token: undefined })
  })

  it('signs in end to end: callback, exchange, token saved; logout removes it', async () => {
    const lines = []
    vi.spyOn(console, 'log').mockImplementation((line) => lines.push(String(line)))
    global.fetch = vi.fn(async () => jsonResponse(200, { access_token: 'lz_pat_e2e', expires_in: 7776000 }))

    const done = login({ oauthEndpoint: 'https://app.example', browser: false, port: 0, configPath })
    // the printed URL carries the redirect and the state the browser would bring back
    await vi.waitFor(() => expect(lines.some((l) => l.includes('/oauth/authorize?'))).toBe(true))
    const url = new URL(lines.find((l) => l.includes('/oauth/authorize?')).trim())
    const res = await get(`${url.searchParams.get('redirect_uri')}?code=c-e2e&state=${url.searchParams.get('state')}`)
    expect(res.body).toContain('Signed in')
    await done

    const saved = ini.parse(fs.readFileSync(configPath, 'utf-8'))
    expect(saved.loginToken).toBe('lz_pat_e2e')
    expect(Math.abs(Date.parse(saved.loginTokenExpiresAt) - (Date.now() + 7776000 * 1000))).toBeLessThan(60000)
    expect(saved.loginTokenEndpoint).toBe('https://app.example') // not the default: remembered for logout
    const tokenRequest = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(tokenRequest.code).toBe('c-e2e')
    expect(crypto.createHash('sha256').update(tokenRequest.code_verifier).digest('base64url')).toBe(url.searchParams.get('code_challenge'))

    // logout revokes where it signed in (no endpoint given), then removes
    global.fetch = vi.fn(async () => jsonResponse(200, {}))
    await logout({ configPath })
    expect(global.fetch.mock.calls[0][0]).toBe('https://app.example/oauth/revoke')
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ token: 'lz_pat_e2e', client_id: CLIENT_ID })
    expect(ini.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({})
    expect(lines.some((l) => l.includes('revoked and removed'))).toBe(true)
  })

  it('logs out on this machine even when revoking fails, and says where to revoke', async () => {
    const lines = []
    vi.spyOn(console, 'log').mockImplementation((line) => lines.push(String(line)))
    fs.writeFileSync(configPath, ini.stringify({ projectId: 'pid', loginToken: 'lz_pat_x' }))
    global.fetch = vi.fn(async () => jsonResponse(503, {}))
    await logout({ oauthEndpoint: 'https://app.example', configPath })
    expect(ini.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({ projectId: 'pid' })
    expect(lines.some((l) => l.includes('revoking it failed'))).toBe(true)
    expect(lines.some((l) => l.includes('Locize CLI (OAuth)'))).toBe(true)
  })
})

// the order of the keys, through the real cli: --api-key, a config's apiKey, LOCIZE_API_KEY, the login token
describe('cli api key order with a login token', () => {
  let home, server, seen

  const run = (args, env = {}) => new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: home,
      env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, ...env },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', (c) => { stderr += c })
    child.on('exit', () => resolve(stderr))
  })

  beforeEach(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'locize-login-order-'))
    fs.writeFileSync(path.join(home, '.locize'), ini.stringify({ loginToken: 'lz_pat_login' }))
    seen = []
    server = http.createServer((req, res) => {
      seen.push(req.headers.authorization)
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end('{}')
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(home, { recursive: true, force: true })
  })

  it.skipIf(process.platform === 'win32')('uses the login token only when nothing else gives a key', async () => {
    const args = ['remove-version', 'v1', '--project-id', 'pid', '--api-endpoint', `http://127.0.0.1:${server.address().port}`]
    await run(args)
    await run(args, { LOCIZE_API_KEY: 'env-key' })
    await run([...args, '--api-key', 'option-key'], { LOCIZE_API_KEY: 'env-key' })
    fs.writeFileSync(path.join(home, '.locize'), ini.stringify({ loginToken: 'lz_pat_login', apiKey: 'config-key' }))
    await run(args, { LOCIZE_API_KEY: 'env-key' })
    expect(seen).toEqual(['lz_pat_login', 'env-key', 'option-key', 'config-key'])
  })

  it.skipIf(process.platform === 'win32')('accepts the hidden --oauth-endpoint and keeps it out of the help', async () => {
    fs.writeFileSync(path.join(home, '.locize'), ini.stringify({ loginToken: 'lz_pat_dev', loginTokenEndpoint: `http://127.0.0.1:${server.address().port}` }))
    const stderr = await run(['logout', '--oauth-endpoint', `http://127.0.0.1:${server.address().port}`])
    expect(stderr).not.toContain('unknown option')
    expect(seen).toEqual([undefined]) // the revoke request reached our server (no Authorization header)
    const help = await new Promise((resolve) => {
      const child = spawn(process.execPath, [cliPath, 'login', '--help'], { cwd: home, env: { PATH: process.env.PATH, HOME: home } })
      let out = ''
      child.stdout.on('data', (c) => { out += c })
      child.on('exit', () => resolve(out))
    })
    expect(help).toContain('--no-browser')
    expect(help).not.toContain('--oauth-endpoint')
  })

  it.skipIf(process.platform === 'win32')('does not send an expired login token and says when it expired', async () => {
    fs.writeFileSync(path.join(home, '.locize'), ini.stringify({ loginToken: 'lz_pat_old', loginTokenExpiresAt: '2026-01-02T03:04:05.000Z' }))
    const stderr = await run(['remove-version', 'v1', '--project-id', 'pid', '--api-endpoint', `http://127.0.0.1:${server.address().port}`])
    expect(seen).toEqual([])
    expect(stderr).toContain('your locize login expired on 2026-01-02')
  })
})
