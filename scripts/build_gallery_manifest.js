#!/usr/bin/env node
/**
 * Build gallery manifest from DJ-images folder
 * Scans the folder for image files and generates gallery_images.json
 */

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const IMAGES_DIR = path.join(CWD, 'DJ-images');
const OUTPUT_FILE = path.join(CWD, 'gallery_images.json');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function main() {
    if (!fs.existsSync(IMAGES_DIR)) {
        console.error('DJ-images folder not found');
        process.exit(1);
    }

    const files = fs.readdirSync(IMAGES_DIR);
    
    const images = files
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return IMAGE_EXTENSIONS.includes(ext);
        })
        .map(file => ({
            filename: file,
            path: `DJ-images/${file}`
        }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(images, null, 2));
    console.log(`Generated ${OUTPUT_FILE} with ${images.length} images`);
}

main();
