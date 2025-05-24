const fs = require('fs').promises;
const path = require('path');
const imageSizeModule = require('image-size');
const sizeOf = imageSizeModule.default || imageSizeModule.imageSize;
const Vibrant = require('node-vibrant/node'); // Corrected import for Node.js environment
const chroma = require('chroma-js'); // Add chroma-js for color manipulation

/**
 * Adjusts colors to ensure WCAG contrast and brand palette adherence.
 * @param {string} color - The input color in hex format.
 * @param {Array<string>} brandPalette - Array of brand colors in hex format.
 * @param {string} bgColor - The background color to check contrast against.
 * @param {number} contrastThreshold - Minimum contrast ratio (e.g., 4.5 for WCAG AA).
 * @param {number} saturationThreshold - Maximum allowed saturation before refinement.
 * @returns {string} - The adjusted color in hex format.
 */
function refineColor(color, brandPalette, bgColor, contrastThreshold = 4.5, saturationThreshold = 0.8) {
    let refinedColor = chroma(color);

    // Ensure WCAG contrast
    if (chroma.contrast(refinedColor, bgColor) < contrastThreshold) {
        refinedColor = chroma.scale([refinedColor, bgColor]).mode('lab')(0.5);
    }

    // Snap to nearest brand palette color
    const nearestBrandColor = brandPalette.reduce((nearest, brandColor) => {
        const deltaE = chroma.deltaE(refinedColor, chroma(brandColor));
        return deltaE < chroma.deltaE(refinedColor, chroma(nearest)) ? brandColor : nearest;
    }, brandPalette[0]);

    refinedColor = chroma(nearestBrandColor);

    // De-neon if saturation exceeds threshold
    if (refinedColor.saturation() > saturationThreshold) {
        refinedColor = refinedColor.desaturate(1);
    }

    return refinedColor.hex();
}

const splashImagesDir = path.join(__dirname, 'splash-images');
const outputManifestFile = path.join(__dirname, 'image_data.json');

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.svg'];

/**
 * Analyzes an image file to determine its dimensions, type, and color palette.
 * @param {string} imagePath - The full path to the image file.
 * @returns {Promise<object>} An object like { name: string, type: 'landscape'|'portrait'|'square'|'unknown', error?: boolean, colors: {primary:string|null, secondary:string|null, accent:string|null} }
 */
async function getImageInfo(imagePath) {
    const filename = path.basename(imagePath);
    let imageColors = { primary: null, secondary: null, accent: null };
    let dimensions;

    try {
        const imageBuffer = await fs.readFile(imagePath);
        dimensions = sizeOf(imageBuffer);
        console.log(`  File: ${filename}, Dimensions: ${dimensions.width}x${dimensions.height}`);

        // Extract color palette
        try {
            const palette = await Vibrant.Vibrant.from(imageBuffer).getPalette();
            console.log(`    Raw palette for ${filename}:`, JSON.stringify(palette, null, 2));

            const brandPalette = ['#6a22d9', '#4e4aa5', '#71baed', '#c97f24', '#815117', '#ebcf8c'];
            const bgColor = '#000000'; // Example background color

            // Map Vibrant swatches to primary, secondary, accent
            try {
                if (palette.Vibrant) {
                    imageColors.primary = refineColor(palette.Vibrant.hex, brandPalette, bgColor); // Changed .getHex() to .hex
                } else if (palette.DarkVibrant) {
                    imageColors.primary = palette.DarkVibrant.hex; // Changed .getHex() to .hex
                }

                if (palette.Muted) {
                    imageColors.secondary = refineColor(palette.Muted.hex, brandPalette, bgColor); // Changed .getHex() to .hex
                } else if (palette.DarkMuted) {
                    imageColors.secondary = palette.DarkMuted.hex; // Changed .getHex() to .hex
                }

                if (palette.LightVibrant) {
                    imageColors.accent = refineColor(palette.LightVibrant.hex, brandPalette, bgColor); // Changed .getHex() to .hex
                } else if (palette.LightMuted && (!imageColors.primary || palette.LightMuted.hex !== imageColors.primary) && (!imageColors.secondary || palette.LightMuted.hex !== imageColors.secondary)) {
                    imageColors.accent = palette.LightMuted.hex; // Changed .getHex() to .hex
                } else if (palette.DarkVibrant && (!imageColors.primary || palette.DarkVibrant.hex !== imageColors.primary) && (!imageColors.secondary || palette.DarkVibrant.hex !== imageColors.secondary)) {
                    if (imageColors.primary !== palette.DarkVibrant.hex || !palette.Vibrant) { 
                         imageColors.accent = palette.DarkVibrant.hex; // Changed .getHex() to .hex
                    }
                }
                
            } catch (error) {
                console.error('Error refining colors:', error);
            }
            
            // Ensure some colors are set if possible, even if not ideal matches
            // Filter for swatches that are not null and have a 'hex' property
            const availableSwatches = Object.values(palette).filter(s => s && typeof s.hex === 'string'); 
            console.log(`    Available swatches for ${filename} (count: ${availableSwatches.length}):`, availableSwatches.map(s => s.hex));


            if (!imageColors.primary && availableSwatches.length > 0) {
                imageColors.primary = availableSwatches[0].hex; // Changed .getHex() to .hex
            }
            
            if (!imageColors.secondary && availableSwatches.length > 0) {
                const secondSwatch = availableSwatches.find(s => s.hex !== imageColors.primary);
                if (secondSwatch) {
                    imageColors.secondary = secondSwatch.hex; // Changed .getHex() to .hex
                } else if (availableSwatches.length > 1) { 
                     imageColors.secondary = availableSwatches[1].hex; // Changed .getHex() to .hex
                }
            }
            
            if (!imageColors.accent && availableSwatches.length > 0) {
                const accentSwatch = availableSwatches.find(s => s.hex !== imageColors.primary && s.hex !== imageColors.secondary);
                if (accentSwatch) {
                    imageColors.accent = accentSwatch.hex; // Changed .getHex() to .hex
                } else if (availableSwatches.length > 2) { 
                    imageColors.accent = availableSwatches[2].hex; // Changed .getHex() to .hex
                } else if (availableSwatches.length > 1 && availableSwatches[1].hex !== imageColors.primary) { // If only 2 swatches, try 2nd for accent if different from primary
                    imageColors.accent = availableSwatches[1].hex;
                } else if (availableSwatches.length > 0 && availableSwatches[0].hex !== imageColors.primary && availableSwatches[0].hex !== imageColors.secondary) { // If only 1 swatch, try it for accent if different
                     imageColors.accent = availableSwatches[0].hex;
                }
            }

            console.log(`    Colors for ${filename}: P-${imageColors.primary}, S-${imageColors.secondary}, A-${imageColors.accent}`);

        } catch (colorError) {
            console.warn(`    Could not extract colors for ${filename}: ${colorError.message}`);
            // console.error(colorError); 
        }

        if (dimensions.width > dimensions.height) {
            return { name: filename, type: 'landscape', colors: imageColors };
        } else if (dimensions.height > dimensions.width) {
            return { name: filename, type: 'portrait', colors: imageColors };
        } else {
            return { name: filename, type: 'square', colors: imageColors };
        }

    } catch (err) {
        console.warn(`    Could not get dimensions for ${filename}: ${err.message}`);
        return { name: filename, type: 'unknown', error: true, colors: imageColors }; // Still return colors object
    }
}

async function buildManifest() {
    const imageSets = [];
    try {
        const mainFolders = await fs.readdir(splashImagesDir, { withFileTypes: true });

        for (const entry of mainFolders) {
            if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
                const folderName = entry.name;
                const currentSetPath = path.join(splashImagesDir, folderName);
                let filesInSet;

                try {
                    filesInSet = await fs.readdir(currentSetPath);
                } catch (readErr) {
                    console.warn(`Could not read directory: ${currentSetPath}. Skipping. Error: ${readErr.message}`);
                    continue;
                }

                let desktopImageInfo = null; // Store full info for desktop image
                let mobileImageInfo = null;  // Store full info for mobile image

                console.log(`Processing folder: ${folderName}`);

                for (const file of filesInSet) {
                    const ext = path.extname(file).toLowerCase();
                    if (imageExtensions.includes(ext)) {
                        const imagePath = path.join(currentSetPath, file);
                        const imgInfo = await getImageInfo(imagePath); // imgInfo now includes colors

                        if (imgInfo.error && !imgInfo.colors.primary) { // If error and no colors extracted, skip
                            continue;
                        }

                        if (imgInfo.type === 'landscape') {
                            if (!desktopImageInfo) {
                                desktopImageInfo = imgInfo;
                                console.log(`    Assigned '${imgInfo.name}' as DESKTOP`);
                            }
                        } else if (imgInfo.type === 'portrait') {
                            if (!mobileImageInfo) {
                                mobileImageInfo = imgInfo;
                                console.log(`    Assigned '${imgInfo.name}' as MOBILE`);
                            }
                        } else if (imgInfo.type === 'square') {
                            if (!desktopImageInfo) {
                                desktopImageInfo = imgInfo;
                                console.log(`    Assigned square '${imgInfo.name}' as DESKTOP (fallback)`);
                            } else if (!mobileImageInfo) {
                                mobileImageInfo = imgInfo;
                                console.log(`    Assigned square '${imgInfo.name}' as MOBILE (fallback)`);
                            }
                        }
                    }
                    if (desktopImageInfo && mobileImageInfo) {
                        break;
                    }
                }

                if (desktopImageInfo || mobileImageInfo) {
                    let setColors = { primary: null, secondary: null, accent: null };
                    // Prioritize desktop image's colors for the set, then mobile
                    if (desktopImageInfo && desktopImageInfo.colors) {
                        setColors = desktopImageInfo.colors;
                    } else if (mobileImageInfo && mobileImageInfo.colors) {
                        setColors = mobileImageInfo.colors;
                    }

                    imageSets.push({
                        folder: folderName,
                        desktop: desktopImageInfo ? desktopImageInfo.name : null,
                        desktopPath: desktopImageInfo ? path.join(currentSetPath, desktopImageInfo.name) : null,
                        mobile: mobileImageInfo ? mobileImageInfo.name : null,
                        mobilePath: mobileImageInfo ? path.join(currentSetPath, mobileImageInfo.name) : null,
                        primaryColor: setColors.primary,
                        secondaryColor: setColors.secondary,
                        accentColor: setColors.accent,
                        allImages: filesInSet.map(file => path.join(currentSetPath, file))
                    });

                    if (!desktopImageInfo) {
                        console.warn(`  No suitable LANDSCAPE image found in folder: ${folderName}`);
                    }
                    if (!mobileImageInfo) {
                        console.warn(`  No suitable PORTRAIT image found in folder: ${folderName}`);
                    }
                } else {
                    console.warn(`  No suitable desktop or mobile images found in folder: ${folderName} based on dimensions.`);
                }
            }
        }

        await fs.writeFile(outputManifestFile, JSON.stringify(imageSets, null, 4));
        console.log(`\nSuccessfully built ${outputManifestFile} with ${imageSets.length} image sets.`);

    } catch (error) {
        console.error('Error building image manifest:', error);
    }
}

buildManifest();

// --- Test block (Commented out for cleaner script) ---
/*
(async () => {
    const testImagePath = path.join(__dirname, 'splash-images/1/your_test_image.png'); // Replace with a real image
    try {
        console.log('\n--- Running Single Image Test ---');
        const info = await getImageInfo(testImagePath);
        console.log('Test Image Info:', JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('Error in test block:', e);
    }
})();
*/