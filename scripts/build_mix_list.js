#!/usr/bin/env node
// Writes a plain-HTML list of every mix into index.html between the
// AUTO-MIXLIST markers, so search engines can see every mix title even though
// the players themselves load on demand. Run after soundcloud_fetch.js /
// mixcloud_fetch.js.
const fs = require('fs');
const START = '<!-- AUTO-MIXLIST-START -->';
const END = '<!-- AUTO-MIXLIST-END -->';
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parseDate = d => Date.parse(String(d || '').replace(/^(\d{4})\/(\d{2})\/(\d{2}) /, '$1-$2-$3T').replace(' +0000', 'Z'));

const sc = JSON.parse(fs.readFileSync('soundcloud_tracks.json', 'utf8')).tracks || [];
const mc = JSON.parse(fs.readFileSync('mixcloud_cloudcasts.json', 'utf8')).cloudcasts || [];
const mixes = [
    ...sc.map(t => ({ title: t.title, url: t.permalink_url.split('?')[0], date: parseDate(t.created_at), platform: 'SoundCloud' })),
    ...mc.map(c => ({ title: c.name, url: c.url, date: parseDate(c.created_time), platform: 'Mixcloud' }))
].sort((a, b) => (b.date || 0) - (a.date || 0));

const fmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
const items = mixes.map(m => {
    const when = Number.isFinite(m.date) ? ` <time datetime="${new Date(m.date).toISOString().slice(0, 10)}">${fmt.format(m.date)}</time>` : '';
    return `                <li><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a> <span class="all-mixes-meta">${m.platform}${when ? ' ·' : ''}${when}</span></li>`;
}).join('\n');
const block = `${START}
        <details class="all-mixes">
            <summary>Browse all ${mixes.length} mixes</summary>
            <ul>
${items}
            </ul>
        </details>
        ${END}`;

let html = fs.readFileSync('index.html', 'utf8');
if (html.includes(START)) {
    html = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
} else {
    const anchor = '<div class="flex-wrap"><div class="embed-grid" id="other-mixes-grid"></div></div>';
    if (!html.includes(anchor)) throw new Error('Could not find the Other Mixes grid in index.html');
    html = html.replace(anchor, `${anchor}\n        ${block}`);
}
fs.writeFileSync('index.html', html);
console.log(`Mix list: ${mixes.length} mixes`);
