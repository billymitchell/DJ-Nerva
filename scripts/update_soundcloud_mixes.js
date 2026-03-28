#!/usr/bin/env node
/**
 * Refresh SoundCloud data in one command.
 *
 * Behavior:
 * - If a non-expired SOUNDCLOUD_ACCESS_TOKEN is present, skip OAuth
 * - Otherwise run scripts/soundcloud_oauth.js
 * - Then run scripts/soundcloud_fetch.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env');
const OAUTH_SCRIPT = path.join(ROOT, 'scripts', 'soundcloud_oauth.js');
const FETCH_SCRIPT = path.join(ROOT, 'scripts', 'soundcloud_fetch.js');

function loadDotEnv(dotenvPath = ENV_FILE) {
  const out = {};
  if (!fs.existsSync(dotenvPath)) return out;

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
    out[key] = val;
  }
  return out;
}

function hasUsableToken(env) {
  const token = env.SOUNDCLOUD_ACCESS_TOKEN;
  if (!token) return false;

  const expiresAt = env.SOUNDCLOUD_TOKEN_EXPIRES_AT;
  if (!expiresAt) return true;

  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;

  // Refresh a minute early to avoid racey near-expiration failures.
  return ts > Date.now() + 60_000;
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const env = loadDotEnv();
  const useExistingToken = hasUsableToken(env);

  console.log('🎧 Update SoundCloud Mixes');
  console.log('=========================');

  if (useExistingToken) {
    console.log('Using existing SoundCloud access token from .env');
  } else {
    console.log('No usable SoundCloud access token found. Starting OAuth flow...');
    await runNodeScript(OAUTH_SCRIPT);
  }

  console.log('Refreshing SoundCloud track data...');
  await runNodeScript(FETCH_SCRIPT);
  console.log('SoundCloud mixes updated.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
