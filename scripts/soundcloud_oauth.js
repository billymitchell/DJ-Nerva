#!/usr/bin/env node
/**
 * SoundCloud OAuth helper for local development.
 *
 * Implements the Authorization Code flow with PKCE using the current
 * SoundCloud OAuth endpoints:
 * - Authorize: https://secure.soundcloud.com/authorize
 * - Token:     https://secure.soundcloud.com/oauth/token
 *
 * Expected .env values:
 * - SOUNDCLOUD_CLIENT_ID
 * - SOUNDCLOUD_CLIENT_SECRET
 * - SOUNDCLOUD_REDIRECT_URI (optional, defaults to http://127.0.0.1:8721/callback)
 *
 * On success this script updates .env with:
 * - SOUNDCLOUD_ACCESS_TOKEN
 * - SOUNDCLOUD_REFRESH_TOKEN
 * - SOUNDCLOUD_TOKEN_EXPIRES_AT
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { URL, URLSearchParams } = require('url');
const { spawn } = require('child_process');

const AUTHORIZE_URL = 'https://secure.soundcloud.com/authorize';
const TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';
const ME_URL = 'https://api.soundcloud.com/me';
const ENV_FILE = path.join(process.cwd(), '.env');
const DEFAULT_REDIRECT_URI = 'http://localhost:8721/callback';

function loadDotEnv(dotenvPath = ENV_FILE) {
  try {
    if (!fs.existsSync(dotenvPath)) return;
    const lines = fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      let line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('export ')) line = line.slice('export '.length).trim();
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (err) {
    console.warn(`Could not read .env: ${err.message || err}`);
  }
}

function env(name, def) {
  return process.env[name] || def;
}

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes = 32) {
  return base64UrlEncode(crypto.randomBytes(bytes));
}

function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function redactSecret(value) {
  if (!value) return 'missing';
  if (value.length <= 8) return 'set';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function parseRedirectUri(redirectUri) {
  const url = new URL(redirectUri);
  if (url.protocol !== 'http:') {
    throw new Error('Only http:// redirect URIs are supported by this local helper.');
  }
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('Redirect URI must use localhost or 127.0.0.1 for this helper.');
  }
  return url;
}

function getHostAliases(hostname) {
  if (hostname === '127.0.0.1') return ['127.0.0.1', 'localhost'];
  if (hostname === 'localhost') return ['localhost', '127.0.0.1'];
  return [hostname];
}

function updateEnvFile(updates, dotenvPath = ENV_FILE) {
  let content = '';
  if (fs.existsSync(dotenvPath)) {
    content = fs.readFileSync(dotenvPath, 'utf8');
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const seen = new Set();
  const out = lines.map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;
    const key = match[1];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }

  const normalized = out.join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(dotenvPath, normalized);
}

function tryOpenBrowser(url) {
  const platform = process.platform;
  const candidates = platform === 'darwin'
    ? [['open', [url]]]
    : platform === 'win32'
      ? [['cmd', ['/c', 'start', '', url]]]
      : [['xdg-open', [url]]];

  for (const [cmd, args] of candidates) {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.unref();
      return true;
    } catch {
      // Try next candidate.
    }
  }
  return false;
}

async function postForm(url, data) {
  const body = new URLSearchParams(data).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json; charset=utf-8',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Leave as raw text if not JSON.
  }

  if (!res.ok) {
    const detail = json ? JSON.stringify(json) : text.slice(0, 300);
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${detail}`);
  }

  return json || text;
}

async function fetchAuthenticatedUser(accessToken) {
  const res = await fetch(ME_URL, {
    headers: {
      'Accept': 'application/json; charset=utf-8',
      'Authorization': `OAuth ${accessToken}`,
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Keep raw text for error reporting.
  }
  if (!res.ok) {
    const detail = json ? JSON.stringify(json) : text.slice(0, 300);
    throw new Error(`Failed to verify token with /me (${res.status}): ${detail}`);
  }
  return json;
}

function buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.toString();
}

function waitForOAuthCallback(redirectUrl, expectedState, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url, redirectUrl.origin);
        if (requestUrl.pathname !== redirectUrl.pathname) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }

        const error = requestUrl.searchParams.get('error');
        const errorDescription = requestUrl.searchParams.get('error_description');
        const code = requestUrl.searchParams.get('code');
        const state = requestUrl.searchParams.get('state');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>SoundCloud authorization failed</h1><p>You can close this window.</p>');
          cleanup();
          reject(new Error(`Authorization failed: ${error}${errorDescription ? ` (${errorDescription})` : ''}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Missing code</h1><p>You can close this window.</p>');
          cleanup();
          reject(new Error('Authorization callback did not include a code.'));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>State mismatch</h1><p>You can close this window.</p>');
          cleanup();
          reject(new Error('State mismatch in callback. Aborting for safety.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>SoundCloud authorization complete</h1><p>You can close this window and return to the terminal.</p>');
        cleanup();
        resolve({ code });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    let timeout = null;

    function cleanup() {
      if (timeout) clearTimeout(timeout);
      server.close(() => {});
    }

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });

    server.listen(Number(redirectUrl.port || 80), '0.0.0.0', () => {
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for SoundCloud OAuth callback.'));
      }, timeoutMs);
    });
  });
}

async function exchangeCodeForToken({
  clientId,
  clientSecret,
  redirectUri,
  codeVerifier,
  code,
}) {
  return postForm(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code,
  });
}

async function main() {
  loadDotEnv();

  const clientId = env('SOUNDCLOUD_CLIENT_ID');
  const clientSecret = env('SOUNDCLOUD_CLIENT_SECRET');
  const redirectUri = env('SOUNDCLOUD_REDIRECT_URI', DEFAULT_REDIRECT_URI);

  if (!clientId || !clientSecret) {
    console.error('Missing SOUNDCLOUD_CLIENT_ID or SOUNDCLOUD_CLIENT_SECRET in .env');
    process.exit(2);
  }

  let redirectUrl;
  try {
    redirectUrl = parseRedirectUri(redirectUri);
  } catch (err) {
    console.error(`Invalid SOUNDCLOUD_REDIRECT_URI: ${err.message || err}`);
    process.exit(2);
  }

  const { verifier, challenge } = createPkcePair();
  const state = randomToken(24);
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  console.log('🎵 SoundCloud OAuth Helper');
  console.log('=========================');
  console.log(`Client ID: ${redactSecret(clientId)}`);
  console.log(`Redirect URI: ${redirectUri}`);
  console.log(`Callback path: ${redirectUrl.pathname}`);
  console.log(`Local callback listener: http://127.0.0.1:${redirectUrl.port || 80}${redirectUrl.pathname}`);
  console.log(`Local callback listener: http://localhost:${redirectUrl.port || 80}${redirectUrl.pathname}`);
  console.log('');
  console.log('Make sure this redirect URI exactly matches one of the redirect URIs configured in your SoundCloud app settings.');
  console.log(`Accepted local host aliases for this helper: ${getHostAliases(redirectUrl.hostname).join(', ')}`);
  console.log('The browser should finish on the callback URL above with ?code=...&state=... in the address bar.');
  console.log('');

  const callbackPromise = waitForOAuthCallback(redirectUrl, state);

  const opened = tryOpenBrowser(authorizeUrl);
  if (opened) {
    console.log('Opened SoundCloud authorization page in your browser.');
  } else {
    console.log('Open this URL in your browser:');
    console.log(authorizeUrl);
  }

  console.log('Waiting for OAuth callback...');

  let callback;
  try {
    callback = await callbackPromise;
  } catch (err) {
    console.error(`Authorization failed: ${err.message || err}`);
    process.exit(1);
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForToken({
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier: verifier,
      code: callback.code,
    });
  } catch (err) {
    console.error(`Token exchange failed: ${err.message || err}`);
    process.exit(1);
  }

  const accessToken = tokenResponse && tokenResponse.access_token;
  if (!accessToken) {
    console.error('Token exchange succeeded but no access_token was returned.');
    process.exit(1);
  }

  let me = null;
  try {
    me = await fetchAuthenticatedUser(accessToken);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  const expiresIn = Number(tokenResponse.expires_in || 0);
  const expiresAt = expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : '';

  try {
    updateEnvFile({
      SOUNDCLOUD_ACCESS_TOKEN: accessToken,
      SOUNDCLOUD_REFRESH_TOKEN: tokenResponse.refresh_token || '',
      SOUNDCLOUD_TOKEN_EXPIRES_AT: expiresAt,
      SOUNDCLOUD_REDIRECT_URI: redirectUri,
    });
  } catch (err) {
    console.error(`Failed to update .env: ${err.message || err}`);
    process.exit(1);
  }

  console.log('');
  console.log('Authorization complete.');
  console.log(`Authenticated as: ${me && (me.username || me.permalink || me.id || 'unknown user')}`);
  console.log(`Access token: ${redactSecret(accessToken)}`);
  if (tokenResponse.refresh_token) {
    console.log(`Refresh token: ${redactSecret(tokenResponse.refresh_token)}`);
  }
  if (expiresAt) {
    console.log(`Expires at: ${expiresAt}`);
  }
  console.log(`Updated ${ENV_FILE}`);
  console.log('');
  console.log('Next step:');
  console.log('node scripts/soundcloud_fetch.js');
}

if (require.main === module) {
  if (typeof fetch !== 'function') {
    console.error('This script requires Node 18+ (global fetch).');
    process.exit(1);
  }
  main();
}
