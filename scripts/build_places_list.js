#!/usr/bin/env node
// Writes a plain-HTML list of every venue in places_played.json into index.html
// between the AUTO-PLACES markers (below the map), grouped by city.
// Run after editing places_played.json or syncing from Google My Maps.
const fs = require('fs');
const START = '<!-- AUTO-PLACES-START -->';
const END = '<!-- AUTO-PLACES-END -->';
const HOME = 'Baltimore, MD';
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const data = JSON.parse(fs.readFileSync('places_played.json', 'utf8'));
const places = Array.isArray(data) ? data : data.places;
const byCity = new Map();
for (const p of places) {
    const city = p.city || 'Other';
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(p);
}
// Home city first, then by number of venues, then alphabetically.
const cities = [...byCity.keys()].sort((a, b) =>
    (b === HOME) - (a === HOME) || byCity.get(b).length - byCity.get(a).length || a.localeCompare(b));

const groups = cities.map(city => {
    const items = byCity.get(city)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        .map(p => p.link
            ? `                    <li><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.name)}</a></li>`
            : `                    <li>${esc(p.name)}</li>`)
        .join('\n');
    return `            <div class="places-group">
                <h3 class="places-city">${esc(city)} <span class="places-count">${byCity.get(city).length}</span></h3>
                <ul>
${items}
                </ul>
            </div>`;
}).join('\n');

const block = `${START}
        <div class="places-list" aria-label="List of venues and places I've played">
${groups}
        </div>
        ${END}`;

let html = fs.readFileSync('index.html', 'utf8');
if (html.includes(START)) {
    html = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
} else {
    const anchor = '<div id="places-map" aria-label="Map of venues and places I\'ve played" role="region"></div>\n        </div>';
    if (!html.includes(anchor)) throw new Error('Could not find the map container in index.html');
    html = html.replace(anchor, `${anchor}\n        ${block}`);
}
fs.writeFileSync('index.html', html);
console.log(`Places list: ${places.length} venues in ${cities.length} cities`);
