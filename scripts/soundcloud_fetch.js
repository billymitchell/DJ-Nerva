#!/usr/bin/env node
/**
 * SoundCloud fetcher in Node.js (no dependencies)
 * - Reads .env for SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_ACCESS_TOKEN
 * - Resolves user ID (v1 → v2 → search fallback)
 * - Fetches tracks and writes soundcloud_tracks.json
 */

const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');

const API_V2_BASE = 'https://api-v2.soundcloud.com';
const API_V1_BASE = 'https://api.soundcloud.com';
const RESOLVE_V2 = `${API_V2_BASE}/resolve`;
const RESOLVE_V1 = `${API_V1_BASE}/resolve`;
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

async function httpGet(url, params, headers) {
  const u = new URL(url);
  if (params) {
    const sp = new URLSearchParams(params);
    sp.forEach((v, k) => u.searchParams.set(k, v));
  }
  const res = await fetch(u.toString(), {
    headers: Object.assign({
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      'Origin': 'https://soundcloud.com',
      'Referer': 'https://soundcloud.com/'
    }, headers || {}),
  });
  return res;
}

function extractSlug(profileUrl) {
  try {
    const u = new URL(profileUrl);
    if (!u.hostname.includes('soundcloud.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

async function resolveUserId(profileUrl, clientId, accessToken) {
  // v1 resolve (oauth_token or client_id)
  let res = await httpGet(RESOLVE_V1, Object.fromEntries(
    Object.entries({ url: profileUrl, oauth_token: accessToken, client_id: clientId }).filter(([, v]) => !!v)
  ), accessToken ? { Authorization: `OAuth ${accessToken}` } : undefined);
  if (res.ok) {
    const data = await res.json();
    if (data && data.id) return String(data.id);
  } else {
    const txt = await res.text().catch(() => '');
    console.warn(`resolve(v1) failed: ${res.status} ${res.statusText} ${txt.slice(0,200)}`);
  }
  // v2 resolve with client_id
  if (clientId) {
    const res2 = await httpGet(RESOLVE_V2, { url: profileUrl, client_id: clientId });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.id) return String(data2.id);
      if (data2 && data2.location) {
        const res3 = await fetch(data2.location);
        if (res3.ok) {
          const j3 = await res3.json();
          if (j3 && j3.id) return String(j3.id);
        } else {
          const t3 = await res3.text().catch(() => '');
          console.warn(`resolve(v2->location) failed: ${res3.status} ${res3.statusText} ${t3.slice(0,200)}`);
        }
      }
    } else {
      const t2 = await res2.text().catch(() => '');
      console.warn(`resolve(v2) failed: ${res2.status} ${res2.statusText} ${t2.slice(0,200)}`);
    }
    // search fallback
    const slug = extractSlug(profileUrl);
    if (slug) {
      const res4 = await httpGet(`${API_V2_BASE}/search/users`, { q: slug, client_id: clientId, limit: 10 });
      if (res4.ok) {
        const data4 = await res4.json();
        const items = Array.isArray(data4) ? data4 : (data4 && data4.collection) || [];
        const exact = items.find(u => String(u.permalink || '').toLowerCase() === slug.toLowerCase());
        if (exact && exact.id) return String(exact.id);
        if (items.length && items[0].id) return String(items[0].id);
      } else {
        const t4 = await res4.text().catch(() => '');
        console.warn(`search(users) failed: ${res4.status} ${res4.statusText} ${t4.slice(0,200)}`);
      }
    }
    throw new Error('Resolve failed via v1, v2, and search fallback');
  }
  throw new Error('Could not resolve user ID (missing client_id and token insufficient)');
}

async function fetchTracksForUser(userId, clientId, accessToken, limit = 200) {
  const useV1 = !!accessToken;
  const headers = accessToken ? { Authorization: `OAuth ${accessToken}` } : undefined;
  let url = useV1 ? `${API_V1_BASE}/users/${userId}/tracks` : `${API_V2_BASE}/users/${userId}/tracks`;
  let params = useV1 ? { limit: Math.min(limit, 200), linked_partitioning: 1 } : { client_id: clientId, limit: Math.min(limit, 200) };

  const tracks = [];
  let nextHref = null;
  for (;;) {
    const res = nextHref ? await fetch(nextHref, { headers }) : await httpGet(url, params, headers);
    if (!res.ok) throw new Error(`Tracks fetch failed (${res.status}): ${await res.text().then(t=>t.slice(0,200)).catch(()=>res.statusText)}`);
    const data = await res.json();
    let page = [];
    if (Array.isArray(data)) {
      page = data;
      nextHref = null;
    } else {
      page = data.collection || [];
      nextHref = data.next_href || null;
    }
    for (const item of page) {
      if (item && (item.kind === 'track' || 'title' in item)) tracks.push(item);
    }
    if (!nextHref) break;
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
    `                    <iframe class="soundcloud" width="250" height="250" scrolling="no" frameborder="no" allow="autoplay"`,
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

function slugFromUrl(profileUrl) {
  const slug = extractSlug(profileUrl);
  if (!slug) throw new Error('Could not extract profile slug from URL');
  return slug;
}

async function scrapeTracksFromProfile(profileUrl, max = 20) {
  const slug = slugFromUrl(profileUrl);
  const url = `https://soundcloud.com/${slug}/tracks`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      'Referer': `https://soundcloud.com/${slug}`,
    }
  });
  if (!res.ok) throw new Error(`Profile page fetch failed (${res.status})`);
  const html = await res.text();

  // Try to parse window.__sc_hydration JSON blob if present
  let candidates = [];
  try {
    const m = html.match(/__sc_hydration\s*=\s*(\[.*?\]);/s);
    if (m) {
      const hydra = JSON.parse(m[1]);
      for (const entry of hydra) {
        const data = entry && entry.data;
        if (!data) continue;
        const arr = Array.isArray(data.tracks) ? data.tracks : (Array.isArray(data.collection) ? data.collection : []);
        for (const t of arr) {
          const url = t && (t.permalink_url || (t.user && t.permalink ? `https://soundcloud.com/${t.user.permalink}/${t.permalink}` : null));
          const title = t && t.title;
          if (url && title) candidates.push({ title, permalink_url: url, duration: t.full_duration || t.duration || null, genre: t.genre || '' });
        }
      }
    }
  } catch {/* ignore */}

  // Fallback: regex anchor extraction for track links on the /tracks page
  if (candidates.length === 0) {
    const hrefs = new Set();
    const re = new RegExp(`https://soundcloud.com/${slug}/[a-zA-Z0-9\-_%]+`, 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[0];
      if (u.endsWith('/tracks') || u.includes('/sets/') || u.includes('/likes')) continue;
      hrefs.add(u);
    }
    for (const u of hrefs) {
      candidates.push({ title: u.split('/').pop().replace(/[-_]/g, ' '), permalink_url: u, duration: null, genre: '' });
    }
  }

  // De-duplicate by permalink_url and limit
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (!c || !c.permalink_url || seen.has(c.permalink_url)) continue;
    seen.add(c.permalink_url);
    unique.push(c);
    if (unique.length >= max) break;
  }

  // Map into the expected output structure (minimal fields used by the site)
  const tracks = unique.map(t => ({
    title: t.title || 'Untitled',
    permalink_url: t.permalink_url,
    duration: t.duration || null,
    genre: t.genre || ''
  }));
  return tracks;
}

async function extractUserIdFromProfileHtml(profileUrl) {
  const res = await fetch(profileUrl, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
  const html = await res.text();
  const m = html.match(/soundcloud:users:(\d+)/);
  if (m) return m[1];
  // Try JSON-LD user id
  const m2 = html.match(/"urn":"soundcloud:users:(\d+)"/);
  if (m2) return m2[1];
  throw new Error('Could not locate user id on profile page');
}

function parseRssItems(xml, max = 20) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/g;
  const titleRe = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>([^<]+)<\/title>/i;
  const linkRe = /<link>([^<]+)<\/link>/i;
  const durRe = /<itunes:duration>([^<]+)<\/itunes:duration>/i;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const t = block.match(titleRe);
    const l = block.match(linkRe);
    const d = block.match(durRe);
    const title = t ? (t[1] || t[2] || 'Untitled') : 'Untitled';
    const link = l ? l[1] : null;
    if (!link) continue;
    let ms = null;
    if (d && d[1]) {
      // itunes:duration may be HH:MM:SS or MM:SS
      const parts = d[1].trim().split(':').map(n => parseInt(n, 10));
      if (parts.every(n => Number.isFinite(n))) {
        if (parts.length === 3) ms = ((parts[0]*3600 + parts[1]*60 + parts[2]) * 1000);
        if (parts.length === 2) ms = ((parts[0]*60 + parts[1]) * 1000);
      }
    }
    items.push({ title, permalink_url: link, duration: ms, genre: '' });
    if (items.length >= max) break;
  }
  return items;
}

async function fetchTracksFromRss(profileUrl, max = 20) {
  const userId = await extractUserIdFromProfileHtml(profileUrl);
  const rssUrl = `https://feeds.soundcloud.com/users/soundcloud:users:${userId}/sounds.rss`;
  const res = await fetch(rssUrl, {
    headers: {
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status})`);
  const xml = await res.text();
  const items = parseRssItems(xml, max);
  return items;
}

async function main() {
  console.log('🎵 SoundCloud API Fetch (Node)');
  console.log('==============================');
  loadDotEnv();
  const clientId = env('SOUNDCLOUD_CLIENT_ID');
  const accessToken = env('SOUNDCLOUD_ACCESS_TOKEN');
  const profileUrl = env('SOUNDCLOUD_PROFILE_URL', DEFAULT_PROFILE_URL);
  console.log(`🎯 Profile: ${profileUrl}`);

  if (!clientId && !accessToken) {
    console.error('❌ Neither SOUNDCLOUD_CLIENT_ID nor SOUNDCLOUD_ACCESS_TOKEN is set.');
    process.exit(2);
  }
  try {
    console.log('🔎 Resolving user ID...');
    const userId = await resolveUserId(profileUrl, clientId, accessToken);
    console.log(`✅ Resolved user ID: ${userId}`);

    console.log('📥 Fetching tracks...');
    const tracks = await fetchTracksForUser(userId, clientId, accessToken, 200);
    console.log(`🎵 Found ${tracks.length} tracks`);
    saveOutput(profileUrl, 'api', tracks);
    injectEmbedsIntoIndex(tracks);
  } catch (e) {
    console.error(`❌ API fetch failed: ${e.message || e}`);
    console.log('🌐 Falling back to public page scraping...');
    try {
      const tracks = await scrapeTracksFromProfile(profileUrl, 20);
      if (!tracks.length) throw new Error('No tracks found via scraping');
      console.log(`🧩 Scraped ${tracks.length} public tracks`);
      saveOutput(profileUrl, 'scrape', tracks);
      injectEmbedsIntoIndex(tracks);
    } catch (scrapeErr) {
      console.error(`❌ Scrape fallback failed: ${scrapeErr.message || scrapeErr}`);
      console.log('📰 Trying RSS feed fallback...');
      try {
        const tracks = await fetchTracksFromRss(profileUrl, 20);
        if (!tracks.length) throw new Error('No items in RSS');
        console.log(`📻 Pulled ${tracks.length} tracks from RSS`);
        saveOutput(profileUrl, 'rss', tracks);
        injectEmbedsIntoIndex(tracks);
      } catch (rssErr) {
        console.error(`❌ RSS fallback failed: ${rssErr.message || rssErr}`);
        process.exit(1);
      }
    }
  }
}

if (require.main === module) {
  // Node 18+ has global fetch
  if (typeof fetch !== 'function') {
    console.error('This script requires Node 18+ (global fetch).');
    process.exit(1);
  }
  main();
}
