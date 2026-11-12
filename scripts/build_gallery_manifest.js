#!/usr/bin/env node
// Rebuild gallery_images.json from optimized photos and gallery videos.
// - Collapses "X" and "X-converted" (HEIC conversions) into one entry so the
//   same photo can't appear twice.
// - Fails loudly on visually identical photos is NOT possible here; run
//   `python3 scripts/optimize_gallery.py --check-duplicates` for that.
// - Adds a 600px "small" variant (from optimize_gallery.py) and alt text from
//   DJ-images/alt-text.json.
const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'DJ-images');
const altFile = path.join(root, 'alt-text.json');
const alts = fs.existsSync(altFile) ? JSON.parse(fs.readFileSync(altFile, 'utf8')) : {};
const list = dir => fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile() && !f.name.startsWith('.')).map(f => f.name).sort()
    : [];
const version = relative => Math.round(fs.statSync(path.join(root, relative)).mtimeMs);

// Key photos by their base name without "-converted" / extension noise.
const baseKey = file => file.replace(/\.webp$/i, '').replace(/\.(jpe?g|png|gif|heic)$/i, '').replace(/-converted$/i, '').toLowerCase();

const photos = new Map();
for (const file of list(path.join(root, 'optimized'))) {
    if (!/\.(jpe?g|png|gif|webp)$/i.test(file)) continue;
    const key = baseKey(file);
    const existing = photos.get(key);
    // Prefer the "-converted" copy (correct orientation/colour from HEIC).
    if (existing && !/-converted/i.test(file)) continue;
    if (existing) console.warn(`Skipping duplicate photo: ${existing.filename} (kept ${file})`);
    const entry = { filename: file, path: `DJ-images/optimized/${file}`, type: 'image', version: version(`optimized/${file}`) };
    const small = `optimized/600/${file}`;
    if (fs.existsSync(path.join(root, small))) entry.small = `DJ-images/${small}`;
    if (alts[file]) entry.alt = alts[file];
    else console.warn(`No alt text for ${file} — add it to DJ-images/alt-text.json`);
    photos.set(key, entry);
}

const entries = [...photos.values()];
for (const file of list(path.join(root, 'video'))) {
    if (!/\.(mp4|webm)$/i.test(file)) continue;
    const video = { filename: file, path: `DJ-images/video/${file}`, type: 'video', version: version(`video/${file}`) };
    const poster = `video/posters/${file}.jpg`;
    if (fs.existsSync(path.join(root, poster))) {
        video.poster = `DJ-images/${poster}`;
        video.posterVersion = version(poster); // posters can change without the video changing
    }
    entries.push(video);
}

// Every path in the manifest must exist, or the live site serves HTML in its place.
for (const e of entries) {
    for (const p of [e.path, e.small, e.poster].filter(Boolean)) {
        if (!fs.existsSync(path.join(process.cwd(), p))) throw new Error(`Missing file: ${p}`);
    }
}
fs.writeFileSync('gallery_images.json', JSON.stringify(entries, null, 2) + '\n');
console.log(`Gallery: ${photos.size} photos, ${entries.length - photos.size} videos`);
