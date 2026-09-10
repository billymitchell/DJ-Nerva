// Set APP_BUILD_HASH when deploying changed image assets.
const BUILD_HASH = window.APP_BUILD_HASH || '1';
const SECTION_PRELOAD_MARGIN = '600px 0px';

document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return console.error('Hero section element not found.');

    fetchJson('image_data.json')
        .then((imageSets) => {
            const randomSet = getRandomItem(imageSets);

            setHeroImage(randomSet);
            setThemeColors(randomSet);
        })
        .catch(error => {
            console.error('Error loading hero image data:', error);

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
        });

    fetchJson('taglines.json')
        .then((taglines) => setTagline(getRandomItem(taglines)))
        .catch(error => {
            console.error('Error loading tagline data:', error);
            setTagline('Charm City Vibe, Worldwide Tribe.');
        });

    observeSectionOnce(document.getElementById('dj-mixes'), loadMixes);

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

    const resizeGalleryItem = item => {
        const img = item.querySelector('img, video');
        if (!img || (img.tagName === 'IMG' && !img.complete)) return;

        const styles = window.getComputedStyle(grid);
        const rowHeight = parseFloat(styles.gridAutoRows);
        const rowGap = parseFloat(styles.rowGap);
        const itemHeight = img.getBoundingClientRect().height;
        const rowSpan = Math.ceil((itemHeight + rowGap) / (rowHeight + rowGap));

        item.style.gridRowEnd = `span ${rowSpan}`;
    };

    const resizeAllGalleryItems = () => {
        grid.querySelectorAll('.photo-item').forEach(resizeGalleryItem);
    };
    
    try {
        const response = await fetch(buildVersionedAssetUrl('gallery_images.json'), { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to load gallery images');
        const images = await response.json();

        grid.innerHTML = '';
        
        // Shuffle images
        for (let i = images.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [images[i], images[j]] = [images[j], images[i]];
        }
        
        // Keep a random half of each media type, rounded up, in shuffled order.
        const photos = images.filter(image => image.type !== 'video');
        const videos = images.filter(image => image.type === 'video');
        const selected = new Set([
            ...photos.slice(0, Math.ceil(photos.length / 2)),
            ...videos.slice(0, Math.ceil(videos.length / 2))
        ]);
        const galleryItems = images.filter(image => selected.has(image));

        // Generate only the selected items so the rest are not downloaded.
        galleryItems.forEach(image => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            
            const isVideo = image.type === 'video';
            const img = document.createElement(isVideo ? 'video' : 'img');
            if (isVideo) {
                div.classList.add('video-item');
                img.controls = true;
                img.autoplay = false;
                img.muted = true;
                img.defaultMuted = true;
                img.playsInline = true;
                img.preload = 'none';
                img.setAttribute('aria-label', 'DJ Nerva video');
                if (image.poster) {
                    img.poster = buildVersionedAssetUrl(image.poster, image.version);
                    // Match the preview before loading any video data.
                    const preview = new Image();
                    preview.onload = () => {
                        if (!img.videoWidth) {
                            img.style.aspectRatio = `${preview.naturalWidth} / ${preview.naturalHeight}`;
                            window.requestAnimationFrame(() => resizeGalleryItem(div));
                        }
                    };
                    preview.src = img.poster;
                }
            }
            img.src = buildVersionedAssetUrl(image.path, image.version || BUILD_HASH);
            img.alt = 'DJ Nerva';
            img.loading = 'lazy';
            img.decoding = 'async';

            img.addEventListener(isVideo ? 'loadedmetadata' : 'load', () => {
                if (isVideo && img.videoWidth && img.videoHeight) {
                    img.style.aspectRatio = `${img.videoWidth} / ${img.videoHeight}`;
                }
                window.requestAnimationFrame(() => resizeGalleryItem(div));
            }, { once: true });
            
            div.appendChild(img);
            grid.appendChild(div);

            if (isVideo || img.complete) {
                window.requestAnimationFrame(() => resizeGalleryItem(div));
            }
        });

        let previousGridWidth = grid.clientWidth;
        const galleryResizeObserver = new ResizeObserver(entries => {
            const currentGridWidth = entries[0].contentRect.width;
            if (currentGridWidth === previousGridWidth) return;

            previousGridWidth = currentGridWidth;
            window.requestAnimationFrame(resizeAllGalleryItems);
        });
        galleryResizeObserver.observe(grid);

        console.log(`Gallery loaded with ${galleryItems.length} photos and videos`);
    } catch (error) {
        console.error('Error loading gallery:', error);
    }
}

// Combine both platforms using their upload dates as the mix dates.
async function loadMixes() {
    const status = document.getElementById('mixes-status');
    try {
        const [soundcloud, mixcloud] = await Promise.all([
            fetchJson('soundcloud_tracks.json'), fetchJson('mixcloud_cloudcasts.json')
        ]);
        const normalize = value => {
            const url = new URL(value, 'https://www.mixcloud.com');
            return url.pathname.replace(/\/$/, '');
        };
        const players = new Map();
        document.getElementById('mix-players').content.querySelectorAll('iframe').forEach(player => {
            const url = new URL(player.src);
            const platform = player.classList.contains('soundcloud') ? 'sc' : 'mc';
            players.set(platform + normalize(url.searchParams.get(platform === 'sc' ? 'url' : 'feed')), player);
        });
        const mixes = [
            ...soundcloud.tracks.map(mix => ({ title: mix.title, date: mix.created_at, tags: mix.tags, key: 'sc' + normalize(mix.permalink_url) })),
            ...mixcloud.cloudcasts.map(mix => ({ title: mix.name, date: mix.created_time, tags: mix.tags, key: 'mc' + normalize(mix.key) }))
        ].map(mix => ({ ...mix, timestamp: Date.parse((mix.date || '').replace(/^(\d{4})\/(\d{2})\/(\d{2}) /, '$1-$2-$3T').replace(' +0000', 'Z')) }))
            .filter(mix => players.has(mix.key))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latest = mixes.slice(0, 4);
        const remaining = mixes.slice(4);
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        const render = (id, selection) => {
            const grid = document.getElementById(id);
            grid.replaceChildren();
            selection.forEach(mix => {
                const tile = document.createElement('div');
                tile.className = 'embed-item';
                const player = players.get(mix.key).cloneNode(true);
                player.title = mix.title;
                if (player.classList.contains('soundcloud')) {
                    const url = new URL(player.src);
                    url.searchParams.set('color', getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim().replace('#', ''));
                    player.src = url;
                }
                const date = document.createElement('time');
                date.className = 'mix-date';
                if (Number.isFinite(mix.timestamp)) {
                    date.dateTime = new Date(mix.timestamp).toISOString();
                    date.textContent = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(mix.timestamp);
                } else date.textContent = 'Date unavailable';
                tile.append(player, date);
                if (Array.isArray(mix.tags) && mix.tags.length) {
                    const genre = document.createElement('p');
                    genre.className = 'mix-tags';
                    genre.textContent = mix.tags.join(' · ');
                    tile.append(genre);
                }
                grid.append(tile);
            });
        };
        render('latest-mixes-grid', latest);
        render('other-mixes-grid', remaining.slice(0, Math.ceil(remaining.length / 2)));
        status.textContent = mixes.length ? '' : 'No mixes available yet.';
    } catch (error) {
        console.error('Error loading mixes:', error);
        status.textContent = 'Unable to load mixes. Please refresh to try again.';
    }
}
