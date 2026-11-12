#!/usr/bin/env node
// Stamp ?v=<content hash> onto the CSS/JS links in index.html so browsers and
// Cloudflare pick up changes immediately. Run before every deploy that touches
// simplified-style.css, main.js or places-map.js.
const fs = require('fs');
const crypto = require('crypto');
const files = ['simplified-style.css', 'main.js', 'motion.js', 'places-map.js', 'gear3d.min.js'];
let html = fs.readFileSync('index.html', 'utf8');
for (const file of files) {
    const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
    const pattern = new RegExp(`(["'])${file.replace('.', '\\.')}(?:\\?v=[^"']*)?\\1`, 'g');
    const before = html;
    html = html.replace(pattern, `$1${file}?v=${hash}$1`);
    console.log(`${file} -> ?v=${hash}${before === html ? ' (unchanged)' : ''}`);
}
fs.writeFileSync('index.html', html);
