#!/usr/bin/env node
/** Fetch public profile mixes using SoundCloud's documented OAuth API.
 * Credentials and rotated tokens are kept in the gitignored .env file.
 * https://developers.soundcloud.com/docs/api/guide#authentication
 */
const fs = require('fs');
const path = require('path');
const { updateEnvFile } = require('./soundcloud_oauth');
const API_BASE = 'https://api.soundcloud.com';
const TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';
const DEFAULT_PROFILE_URL = 'https://soundcloud.com/dj-nerva';
const OUTPUT_FILE = path.join(process.cwd(), 'soundcloud_tracks.json');
const INDEX_HTML = path.join(process.cwd(), 'index.html');
const AUTO_START = '<!-- AUTO-SC-START -->';
const AUTO_END = '<!-- AUTO-SC-END -->';

function loadDotEnv(dotenvPath = path.join(process.cwd(), '.env')) {
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
  } catch { /* ignore */ }
}

function env(name, def) {
  return process.env[name] || def;
}

async function renewToken() {
  const clientId = env('SOUNDCLOUD_CLIENT_ID');
  const clientSecret = env('SOUNDCLOUD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET in .env to obtain or renew an API token.');
  }
  const refreshToken = env('SOUNDCLOUD_REFRESH_TOKEN');
  const headers = {
    Accept: 'application/json; charset=utf-8',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const body = refreshToken
    ? { grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }
    : { grant_type: 'client_credentials' };
  if (!refreshToken) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }
  const res = await fetch(TOKEN_URL, { method: 'POST', headers, body: new URLSearchParams(body) });
  if (!res.ok) {
    throw new Error(`SoundCloud ${body.grant_type} exchange failed (HTTP ${res.status}). Check your app credentials${refreshToken ? ' or reauthorize with node scripts/soundcloud_oauth.js' : ''}.`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Token exchange returned no access token.');
  const updates = {
    SOUNDCLOUD_ACCESS_TOKEN: data.access_token,
    SOUNDCLOUD_REFRESH_TOKEN: data.refresh_token || '',
    SOUNDCLOUD_TOKEN_EXPIRES_AT: Number(data.expires_in) > 0
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : '',
  };
  // Save the replacement immediately: refresh tokens are single-use.
  updateEnvFile(updates);
  Object.assign(process.env, updates);
  console.log('Saved renewed SoundCloud tokens to .env');
  return data.access_token;
}

async function apiGet(url, token) {
  const target = new URL(url);
  if (target.origin !== API_BASE) throw new Error('Unexpected SoundCloud API pagination origin.');
  const res = await fetch(target, { headers: {
    Accept: 'application/json; charset=utf-8', Authorization: `OAuth ${token}`,
  } });
  if (!res.ok) {
    const error = new Error(`SoundCloud API request failed (HTTP ${res.status}).`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function fetchProfileTracks(profileUrl, token) {
  const user = await apiGet(`${API_BASE}/resolve?${new URLSearchParams({ url: profileUrl })}`, token);
  const id = user.urn || user.id;
  if (!id || (user.kind && user.kind !== 'user')) throw new Error('Configured profile did not resolve to a SoundCloud user.');
  let next = `${API_BASE}/users/${encodeURIComponent(id)}/tracks?limit=200&linked_partitioning=true`;
  const tracks = [];
  const visited = new Set();
  while (next) {
    if (visited.has(next)) throw new Error('SoundCloud returned a repeated pagination URL.');
    visited.add(next);
    const data = await apiGet(next, token);
    const page = Array.isArray(data) ? data : data.collection;
    if (!Array.isArray(page)) throw new Error('Unexpected SoundCloud tracks response.');
    tracks.push(...page.filter(t => t && t.permalink_url && t.sharing !== 'private'));
    next = Array.isArray(data) ? null : data.next_href;
  }
  return tracks;
}

function mapTrack(item) {
  const duration = item.full_duration || item.duration || 0;
  return {
    title: item.title || 'Untitled',
    permalink_url: item.permalink_url || (item.permalink && item.user && item.user.permalink ? `https://soundcloud.com/${item.user.permalink}/${item.permalink}` : null),
    duration,
    genre: item.genre || '',
    tags: [...new Set(Array.from((item.tag_list || '').matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|(\S+)/g), match => (match[1] || match[2]).replace(/\\"/g, '"').trim()).filter(Boolean))],
    artwork_url: item.artwork_url || item.display_artwork || null,
    created_at: item.created_at || null,
    playback_count: item.playback_count,
    likes_count: item.likes_count,
  };
}

function saveOutput(profileUrl, method, tracks) {
  const doc = {
    profile_url: profileUrl,
    scraped_at: new Date().toISOString(),
    scraping_method: method,
    total_tracks: tracks.length,
    tracks: tracks.map(mapTrack),
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(doc, null, 2));
  console.log(`✅ Wrote ${tracks.length} tracks to ${path.basename(OUTPUT_FILE)}`);
}

function buildEmbedItem(permalinkUrl, colorHex = 'ff5500') {
  // Keep parameters aligned with your static tiles; color will be updated by main.js at runtime
  const url = `https://w.soundcloud.com/player/?url=${encodeURIComponent(permalinkUrl)}&color=%23${colorHex}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
  return [
    '                <div class="embed-item">',
    `                    <iframe class="soundcloud" width="250" height="250" scrolling="no" frameborder="no" loading="lazy" allow="autoplay"`,
    `                        src="${url}">`,
    '                    </iframe>',
    '                </div>'
  ].join('\n');
}

function injectEmbedsIntoIndex(tracks, maxEmbeds) {
  try {
    if (!fs.existsSync(INDEX_HTML)) {
      console.warn('ℹ️ index.html not found; skipping embed injection');
      return;
    }
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    // Sort newest→oldest when created_at is available; otherwise keep original order
    const hasDates = Array.isArray(tracks) && tracks.some(t => t && t.created_at);
    const sorted = hasDates
      ? [...tracks].sort((a, b) => {
          const ad = a && a.created_at ? Date.parse(a.created_at) : 0;
          const bd = b && b.created_at ? Date.parse(b.created_at) : 0;
          return bd - ad; // descending
        })
      : tracks;

    // Prepare embed items from first N tracks with a permalink
    const items = [];
    const seen = new Set();
    const limit = Number.isFinite(maxEmbeds) ? maxEmbeds : (sorted ? sorted.length : 0);
    for (const t of sorted) {
      const u = t && (t.permalink_url || t.url);
      if (!u || seen.has(u)) continue;
      seen.add(u);
      items.push(buildEmbedItem(u));
      if (items.length >= limit) break;
    }
    if (items.length === 0) {
      console.warn('ℹ️ No tracks available to inject into index.html');
      return;
    }

    const block = [AUTO_START, ...items, AUTO_END].join('\n');

    // If markers exist, replace contents; else insert after the first <div class="embed-grid"> tag
    let output = html;
    const startIdx = html.indexOf(AUTO_START);
    if (startIdx !== -1) {
      const endIdx = html.indexOf(AUTO_END, startIdx);
      if (endIdx !== -1) {
        output = html.slice(0, startIdx) + block + html.slice(endIdx + AUTO_END.length);
      } else {
        // Start without end; remove from start and reinsert block
        output = html.slice(0, startIdx) + block;
      }
    } else {
      const gridOpenTagRe = /<div\s+class=["']embed-grid["'][^>]*>/i;
      const m = html.match(gridOpenTagRe);
      if (!m) {
        console.warn('ℹ️ .embed-grid container not found in index.html; skipping embed injection');
        return;
      }
      const insertPos = (m.index || 0) + m[0].length;
      const indent = '\n'; // start on a new line after the tag
      output = html.slice(0, insertPos) + indent + block + html.slice(insertPos);
    }

    fs.writeFileSync(INDEX_HTML, output);
    console.log(`🧩 Injected ${items.length} SoundCloud embed tile(s) into index.html`);
  } catch (err) {
    console.warn(`⚠️ Failed to inject embeds into index.html: ${err.message || err}`);
  }
}

async function main() {
  loadDotEnv();
  const profileUrl = env('SOUNDCLOUD_PROFILE_URL', DEFAULT_PROFILE_URL);
  let token = env('SOUNDCLOUD_ACCESS_TOKEN');
  const expiresAt = Date.parse(env('SOUNDCLOUD_TOKEN_EXPIRES_AT', ''));
  let renewed = false;
  if (!token || (Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60000)) {
    token = await renewToken();
    renewed = true;
  }
  let tracks;
  try {
    tracks = await fetchProfileTracks(profileUrl, token);
  } catch (err) {
    if (err.status !== 401 || renewed) throw err;
    token = await renewToken();
    tracks = await fetchProfileTracks(profileUrl, token);
  }
  if (!tracks.length) throw new Error('No public tracks returned; existing data and embeds preserved.');
  saveOutput(profileUrl, 'api', tracks);
  injectEmbedsIntoIndex(tracks);
}

module.exports = { renewToken, apiGet, fetchProfileTracks, main };
if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exitCode = 1; });
}
