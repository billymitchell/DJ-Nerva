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
