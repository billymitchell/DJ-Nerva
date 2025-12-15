// Update BUILD_HASH to use a timestamp during development
const BUILD_HASH = window.APP_BUILD_HASH || `dev-${Date.now()}`;
console.log('BUILD_HASH:', BUILD_HASH);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded. Initializing setup...');

    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return console.error('Hero section element not found.');

    try {
        // Fetch and set hero image and theme colors
        const imageSets = await fetchJson('image_data.json');
        const randomSet = getRandomItem(imageSets);
        setHeroImage(randomSet);
        setThemeColors(randomSet);

        // Fetch and set tagline
        const taglines = await fetchJson('taglines.json');
        setTagline(getRandomItem(taglines));

        // Update SoundCloud iframe colors
        updateSoundCloudIframes(getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim());
    } catch (error) {
        console.error('Error during setup:', error);

        // Fallback hero image data
        const fallbackImageData = {
            folder: '6',
            desktop: 'bm_nerva_Dense_jungle_with_neon-outlined_leaves_vibrating_wit_09abfacb-63f0-416e-b2eb-ce913255387a_2.png',
            mobile: 'bm_nerva_Dense_jungle_with_neon-outlined_leaves_vibrating_wit_cc7a2612-cbe1-47e9-96d9-6b891da98ebc_1.png',
            primaryColor: '#ffffff',
            secondaryColor: '#000000',
            accentColor: '#ff5500'
        };
        setHeroImage(fallbackImageData);
        setThemeColors(fallbackImageData);

        // Fallback tagline data
        const fallbackTaglines = ['Charm City Vibe, Worldwide Tribe.'];
        setTagline(getRandomItem(fallbackTaglines));
    }
});

// Helper to fetch JSON data
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.json();
}

// Helper to get a random item from an array
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Set hero image URLs
function setHeroImage({ folder, desktop, mobile }) {
    const desktopUrl = `splash-images/${folder}/${desktop}?v=${BUILD_HASH}`;
    const mobileUrl = `splash-images/${folder}/${mobile}?v=${BUILD_HASH}`;
    document.querySelector('#hero-img').src = desktopUrl;
    document.querySelector('source').srcset = mobileUrl;
    console.log('Hero image set:', { desktopUrl, mobileUrl });
}

// Set theme colors
function setThemeColors({ primaryColor, secondaryColor, accentColor }) {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    document.documentElement.style.setProperty('--accent-color', accentColor);
    console.log('Theme colors set:', { primaryColor, secondaryColor, accentColor });
}

// Set tagline
function setTagline(tagline) {
    const taglineElement = document.querySelector('#hero-section h1');
    if (taglineElement) {
        taglineElement.textContent = tagline;
    } else {
        console.error('Tagline element not found.');
    }
}

// Update SoundCloud iframe colors
function updateSoundCloudIframes(primaryColor) {
    if (!primaryColor) return console.error('Primary theme color is not set.');
    document.querySelectorAll('iframe[src*="soundcloud.com"]').forEach(iframe => {
        const url = new URL(iframe.src);
        url.searchParams.set('color', primaryColor.replace('#', ''));
        iframe.src = url.toString();
    });
    console.log('SoundCloud iframe colors updated:', primaryColor);
}

// Video sizing is handled by CSS aspect-ratio and 100% width/height on iframe
// No JavaScript resizing needed

// Load and randomize photo gallery from JSON
async function loadGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    
    try {
        const response = await fetch('gallery_images.json');
        if (!response.ok) throw new Error('Failed to load gallery images');
        const images = await response.json();
        
        // Shuffle images
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        
        const sizeClasses = ['', 'photo-tall', 'photo-wide', 'photo-large'];
        const weights = [40, 25, 25, 10];
        
        // Track grid cell usage (4 columns)
        let cellsUsed = 0;
        
        // Generate gallery items
        images.forEach(image => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            
            // Weighted random size selection
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            let selectedClass = '';
            for (let i = 0; i < weights.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                    selectedClass = sizeClasses[i];
                    break;
                }
            }
            
            if (selectedClass) {
                div.classList.add(selectedClass);
            }
            
            // Count cells used by this item
            if (selectedClass === 'photo-large') cellsUsed += 4;
            else if (selectedClass === 'photo-wide') cellsUsed += 2;
            else if (selectedClass === 'photo-tall') cellsUsed += 2;
            else cellsUsed += 1;
            
            const img = document.createElement('img');
            img.src = image.path;
            img.alt = 'DJ Nerva';
            img.loading = 'lazy';
            
            div.appendChild(img);
            grid.appendChild(div);
        });
        
        // Add filler cells to complete the row (4 columns)
        const remainder = cellsUsed % 4;
        if (remainder > 0) {
            const fillersNeeded = 4 - remainder;
            for (let i = 0; i < fillersNeeded; i++) {
                const filler = document.createElement('div');
                filler.className = 'photo-filler';
                grid.appendChild(filler);
            }
        }
        
        console.log(`Gallery loaded with ${images.length} images, ${cellsUsed} cells used`);
    } catch (error) {
        console.error('Error loading gallery:', error);
    }
}

// Initialize gallery on page load
window.addEventListener('load', loadGallery);
