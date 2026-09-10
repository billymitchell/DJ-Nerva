#!/usr/bin/env node
// Rebuild the gallery from optimized photos, source photos, and gallery videos.
const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'DJ-images');
const photos = new Map();
const entries = [];
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name).sort() : [];
function entry(relative, type) {
    return { filename: path.basename(relative), path: `DJ-images/${relative}`, type,
        version: fs.statSync(path.join(root, relative)).mtimeMs };
}
for (const file of list(root)) {
    if (/\.(jpe?g|png|gif|webp)$/i.test(file)) photos.set(file, entry(file, 'image'));
}
for (const file of list(path.join(root, 'optimized'))) {
    if (!/\.(jpe?g|png|gif|webp)$/i.test(file)) continue;
    const original = file.replace(/\.webp$/i, '');
    photos.set(original, entry(`optimized/${file}`, 'image'));
}
entries.push(...photos.values());
for (const file of list(path.join(root, 'video'))) {
    if (!/\.(mp4|webm)$/i.test(file)) continue;
    const video = entry(`video/${file}`, 'video');
    const poster = `video/posters/${file}.jpg`;
    if (fs.existsSync(path.join(root, poster))) video.poster = `DJ-images/${poster}`;
    entries.push(video);
}
fs.writeFileSync('gallery_images.json', JSON.stringify(entries, null, 2));
console.log(`Gallery: ${photos.size} photos, ${entries.length - photos.size} videos`);
