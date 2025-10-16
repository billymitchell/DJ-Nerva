#!/usr/bin/env node
/**
 * Mixcloud fetcher in Node.js (no external deps)
 * - Reads .env for MIXCLOUD_CLIENT_ID / MIXCLOUD_CLIENT_SECRET (optional for public endpoints)
 * - Fetches latest cloudcasts for a profile and writes mixcloud_cloudcasts.json
 * - Injects embed tiles into index.html between AUTO-MC markers inside the first .embed-grid
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PROFILE_URL = 'https://www.mixcloud.com/dj-nerva/';
const API_BASE = 'https://api.mixcloud.com';

const CWD = process.cwd();
const ENV_FILE = path.join(CWD, '.env');
const OUTPUT_FILE = path.join(CWD, 'mixcloud_cloudcasts.json');
const INDEX_HTML = path.join(CWD, 'index.html');

const AUTO_START = '<!-- AUTO-MC-START -->';
const AUTO_END = '<!-- AUTO-MC-END -->';

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
  } catch { /* ignore */ }
}

function env(name, def) {
  return process.env[name] || def;
}

function extractSlugFromProfileUrl(profileUrl) {
  try {
    const u = new URL(profileUrl);
    if (!u.hostname.includes('mixcloud.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || null; // e.g., 'dj-nerva'
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0,200)}`);
  }
  return res.json();
}

async function fetchCloudcastsForUser(slug, limit = 100) {
  let url = `${API_BASE}/${slug}/cloudcasts/?limit=${Math.min(limit, 100)}`;
  const items = [];
  for (;;) {
    const data = await fetchJson(url);
    const page = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    for (const it of page) items.push(it);
    const next = data?.paging?.next;
    if (next && items.length < limit) {
      url = next;
    } else {
      break;
    }
  }
  return items;
}

function mapCloudcast(item) {
  // item.key like '/dj-nerva/mix-slug/' suitable for widget feed param
  return {
    name: item.name || item.slug || 'Untitled',
    key: item.key, // leading slash path
    url: item.url, // web URL
    created_time: item.created_time || null,
    pictures: item.pictures || null,
    audio_length: item.audio_length || null,
  };
}

function saveOutput(profileUrl, items) {
  const doc = {
    profile_url: profileUrl,
    scraped_at: new Date().toISOString(),
    total_cloudcasts: items.length,
    cloudcasts: items.map(mapCloudcast),
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(doc, null, 2));
  console.log(`✅ Wrote ${items.length} cloudcasts to ${path.basename(OUTPUT_FILE)}`);
}

function buildEmbedItem(feedPath, light = false) {
  // feedPath includes leading slash e.g. '/dj-nerva/mix-name/'
  const url = new URL('https://player-widget.mixcloud.com/widget/iframe/');
  url.searchParams.set('feed', feedPath);
  if (light) url.searchParams.set('light', '1');
  // Drop 'encrypted-media' to avoid Permissions-Policy violations; it's not needed for Mixcloud embeds
  const allow = 'fullscreen; autoplay; idle-detection; speaker-selection; web-share;';
  return [
    '                <div class="embed-item">',
    `                    <iframe class="mixcloud" width="250" height="250" scrolling="no" frameborder="no"`,
    `                        src="${url.toString()}"`,
    `                        allow="${allow}">`,
    '                    </iframe>',
    '                </div>'
  ].join('\n');
}

function injectEmbedsIntoIndex(cloudcasts) {
  try {
    if (!fs.existsSync(INDEX_HTML)) {
      console.warn('ℹ️ index.html not found; skipping Mixcloud embed injection');
      return;
    }
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    // Sort newest→oldest if created_time is available
    const hasDates = Array.isArray(cloudcasts) && cloudcasts.some(c => c && c.created_time);
    const sorted = hasDates
      ? [...cloudcasts].sort((a, b) => {
          const ad = a?.created_time ? Date.parse(a.created_time) : 0;
          const bd = b?.created_time ? Date.parse(b.created_time) : 0;
          return bd - ad;
        })
      : cloudcasts;

    // Build embed items
    const items = [];
    const seen = new Set();
    for (const c of sorted) {
      const feed = c?.key; // '/dj-nerva/slug/'
      if (!feed || seen.has(feed)) continue;
      seen.add(feed);
      items.push(buildEmbedItem(feed));
    }
    if (items.length === 0) {
      console.warn('ℹ️ No Mixcloud items available to inject');
      return;
    }

    const block = [AUTO_START, ...items, AUTO_END].join('\n');

    // Remove any existing AUTO-MC blocks (cleanup duplicates/stale attributes)
    let output = html;
    for (;;) {
      const s = output.indexOf(AUTO_START);
      if (s === -1) break;
      const e = output.indexOf(AUTO_END, s);
      if (e === -1) {
        // Remove from start marker to end of file if no closing marker
        output = output.slice(0, s);
        break;
      }
      output = output.slice(0, s) + output.slice(e + AUTO_END.length);
    }

    // Prefer to insert after AUTO-SC-END to keep SoundCloud then Mixcloud grouping
    const scEndIdx = output.indexOf('<!-- AUTO-SC-END -->');
    if (scEndIdx !== -1) {
      const insertPos = scEndIdx + '<!-- AUTO-SC-END -->'.length;
      output = output.slice(0, insertPos) + '\n' + block + output.slice(insertPos);
    } else {
      // Else insert right after first <div class="embed-grid">
      const gridOpenTagRe = /<div\s+class=["']embed-grid["'][^>]*>/i;
      const m = output.match(gridOpenTagRe);
      if (!m) {
        console.warn('ℹ️ .embed-grid container not found; skipping Mixcloud injection');
        return;
      }
      const pos = (m.index || 0) + m[0].length;
      output = output.slice(0, pos) + '\n' + block + output.slice(pos);
    }

    fs.writeFileSync(INDEX_HTML, output);
    console.log(`🧩 Injected ${items.length} Mixcloud embed tile(s) into index.html`);
  } catch (err) {
    console.warn(`⚠️ Failed to inject Mixcloud embeds: ${err.message || err}`);
  }
}

async function main() {
  console.log('🎧 Mixcloud Fetch (Node)');
  console.log('=======================');
  loadDotEnv();
  const profileUrl = env('MIXCLOUD_PROFILE_URL', DEFAULT_PROFILE_URL);
  const useLight = /^(1|true|yes)$/i.test(env('MIXCLOUD_LIGHT_WIDGET', '0') || '0');
  console.log(`🎯 Profile: ${profileUrl}`);

  const slug = extractSlugFromProfileUrl(profileUrl);
  if (!slug) {
    console.error('❌ Could not determine Mixcloud user slug from profile URL');
    process.exit(2);
  }

  try {
    console.log('📥 Fetching cloudcasts...');
    const cloudcasts = await fetchCloudcastsForUser(slug, 100);
    console.log(`🎵 Found ${cloudcasts.length} cloudcasts`);
    saveOutput(profileUrl, cloudcasts);
    // Rebuild embeds with optional light mode
    // Map the cloudcasts to minimal objects with key only for embed builder
    const embeds = cloudcasts.map(c => ({ key: c.key }));
    // Monkey-patch build for light mode by temporarily wrapping buildEmbedItem
    const originalBuild = buildEmbedItem;
    try {
      global.buildEmbedItem = (feedPath) => originalBuild(feedPath, useLight);
      injectEmbedsIntoIndex(cloudcasts);
    } finally {
      global.buildEmbedItem = originalBuild;
    }
  } catch (e) {
    console.error(`❌ Mixcloud fetch failed: ${e.message || e}`);
    process.exit(1);
  }
}

if (require.main === module) {
  if (typeof fetch !== 'function') {
    console.error('This script requires Node 18+ (global fetch).');
    process.exit(1);
  }
  main();
}
