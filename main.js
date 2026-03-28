// Update BUILD_HASH to use a timestamp during development
const BUILD_HASH = window.APP_BUILD_HASH || `dev-${Date.now()}`;
const SECTION_PRELOAD_MARGIN = '600px 0px';

document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return console.error('Hero section element not found.');

    Promise.all([
            fetchJson('image_data.json'),
            fetchJson('taglines.json')
        ])
        .then(([imageSets, taglines]) => {
            const randomSet = getRandomItem(imageSets);

            setHeroImage(randomSet);
            setThemeColors(randomSet);
            setTagline(getRandomItem(taglines));
        })
        .catch(error => {
            console.error('Error during setup:', error);

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
            setTagline('Charm City Vibe, Worldwide Tribe.');
        });

    observeSectionOnce(document.getElementById('dj-mixes'), () => {
        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color')
            .trim();
        updateSoundCloudIframes(primaryColor);
    });

    observeSectionOnce(document.getElementById('photo-gallery'), loadGallery);
});

// Helper to fetch JSON data
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.json();
}

function buildVersionedAssetUrl(path, version = BUILD_HASH) {
    return `${path}?v=${encodeURIComponent(version)}`;
}

function observeSectionOnce(element, callback, rootMargin = SECTION_PRELOAD_MARGIN) {
    if (!element || typeof callback !== 'function') return;

    let hasRun = false;
    const run = () => {
        if (hasRun) return;
        hasRun = true;
        callback();
    };

    if (!('IntersectionObserver' in window)) {
        run();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        run();
    }, { rootMargin });

    observer.observe(element);
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
        const response = await fetch(buildVersionedAssetUrl('gallery_images.json'));
        if (!response.ok) throw new Error('Failed to load gallery images');
        const images = await response.json();

        grid.innerHTML = '';
        
        // Shuffle images
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        
        // Generate gallery items
        images.forEach(image => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            
            const img = document.createElement('img');
            img.src = buildVersionedAssetUrl(image.path, image.version || BUILD_HASH);
            img.alt = 'DJ Nerva';
            img.loading = 'lazy';
            img.decoding = 'async';
            
            div.appendChild(img);
            grid.appendChild(div);
        });

        console.log(`Gallery loaded with ${images.length} images`);
    } catch (error) {
        console.error('Error loading gallery:', error);
    }
}
