#!/usr/bin/env node
/**
 * Replace the Google Maps API key placeholder in index.html using .env
 * Safe for local use; recommend restricting key by domain and not committing .env
 */

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const ENV_FILE = path.join(CWD, '.env');
const INDEX_HTML = path.join(CWD, 'index.html');

function loadDotEnv(dotenvPath = ENV_FILE) {
  try {
    if (!fs.existsSync(dotenvPath)) return {};
    const out = {};
    const lines = fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/);
    for (let raw of lines) {
      let line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('export ')) line = line.slice(7).trim();
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch (e) {
    console.error('Failed to read .env:', e.message || e);
    return {};
  }
}

function main() {
  const env = loadDotEnv();
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.error('GOOGLE_MAPS_API_KEY not found in .env');
    process.exit(2);
  }
  if (!fs.existsSync(INDEX_HTML)) {
    console.error('index.html not found');
    process.exit(2);
  }
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const placeholder = 'YOUR_GOOGLE_MAPS_API_KEY';
  if (!html.includes(placeholder)) {
    console.log('No placeholder found; nothing to replace.');
    process.exit(0);
  }
  const updated = html.replace(new RegExp(placeholder, 'g'), key);
  fs.writeFileSync(INDEX_HTML, updated);
  console.log('Replaced Google Maps API key placeholder in index.html');
}

if (require.main === module) {
  main();
}
