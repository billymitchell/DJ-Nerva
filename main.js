// Set APP_BUILD_HASH when deploying changed image assets.
const BUILD_HASH = window.APP_BUILD_HASH || '1';
const SECTION_PRELOAD_MARGIN = '600px 0px';

document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return console.error('Hero section element not found.');

    (window.heroReady || Promise.resolve(null))
        .then(selected => {
            if (!selected) throw new Error('hero_assets.json unavailable');
            return selected;
        })
        .then((randomSet) => {

            setHeroImage(randomSet);
            setThemeColors(randomSet);
        })
        .catch(error => {
            console.error('Error loading hero image data:', error);

            const fallbackImageData = {
                folder: '6',
                desktop: 'optimized/desktop.webp',
                mobile: 'optimized/mobile.webp',
                primaryColor: '#27b3e8',
                secondaryColor: '#045175',
                accentColor: '#f89edc'
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

    // Header logo: a copy of the hero logo (rotating N included), without duplicate ids.
    const brand = document.querySelector('.site-brand');
    const heroLogo = document.getElementById('logo');
    if (brand && heroLogo && !brand.firstElementChild) {
        const mark = heroLogo.cloneNode(true);
        mark.removeAttribute('id');
        mark.removeAttribute('role');
        mark.removeAttribute('aria-labelledby');
        mark.setAttribute('aria-hidden', 'true');
        mark.setAttribute('focusable', 'false');
        mark.querySelectorAll('title').forEach(t => t.remove());
        mark.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        brand.append(mark);
    }

    // Header turns solid once the hero has scrolled away.
    const header = document.getElementById('site-header');
    if (header && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            header.classList.toggle('is-scrolled', !entry.isIntersecting);
        }, { rootMargin: '-80px 0px 0px 0px' }).observe(heroSection);
    } else if (header) {
        header.classList.add('is-scrolled');
    }

    const year = document.getElementById('footer-year');
    if (year) year.textContent = new Date().getFullYear();

    // 3D gear showcase: only fetched when the Gear section gets close, and only with WebGL.
    const gearSection = document.getElementById('gear');
    observeSectionOnce(gearSection, () => {
        const src = gearSection?.dataset.gear3d;
        if (!src) return;
        const probe = document.createElement('canvas');
        if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
        import(`./${src}`).catch(error => console.warn('3D gear showcase unavailable:', error));
    }, '900px 0px');

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
function setHeroImage({ folder, desktop, mobile, desktopPreview, mobilePreview }) {
    const optimized = Boolean(desktopPreview && mobilePreview);
    const desktopUrl = optimized ? desktop : `splash-images/${folder}/${desktop}?v=${BUILD_HASH}`;
    const mobileUrl = optimized ? mobile : `splash-images/${folder}/${mobile}?v=${BUILD_HASH}`;
    const hero = document.getElementById('hero-img');
    const picture = hero.closest('picture');
    if (optimized) {
        const preview = document.createElement('picture');
        preview.setAttribute('aria-hidden', 'true');
        const source = document.createElement('source');
        source.media = '(max-width:767px)';
        source.srcset = mobilePreview;
        const image = document.createElement('img');
        image.src = desktopPreview;
        image.alt = '';
        image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
        preview.append(source, image);
        picture.before(preview);
        hero.style.opacity = '0';
        const reveal = () => {
            if (!hero.naturalWidth) return;
            hero.style.opacity = '1';
            preview.remove();
        };
        hero.addEventListener('load', reveal, { once: true });
        hero.decoding = 'async';
        hero.loading = 'eager';
        hero.fetchPriority = 'high';
    }
    picture.querySelector('source').srcset = mobileUrl;
    hero.src = desktopUrl;
}

// Set theme colors
function setThemeColors({ primaryColor, secondaryColor, accentColor }) {
    const root = document.documentElement.style;
    root.setProperty('--primary-color', primaryColor);
    root.setProperty('--secondary-color', secondaryColor);
    root.setProperty('--accent-color', accentColor);

    // The palettes are random, so derive readable companions for each one
    // (WCAG AA: 4.5:1 for text, 3:1 for the logo graphic).
    const P = hexToRgb(primaryColor), S = hexToRgb(secondaryColor), A = hexToRgb(accentColor);
    if (!P || !S || !A) return;
    // Dark tints of red/orange/gold read as maroon or brown, so backgrounds borrow the
    // first cool color in the palette (warm hues stay on borders and accents).
    const pick = (...options) => options.find(c => !isBrownProne(c)) || null;
    const pageTint = pick(P, S, A);
    const sectionTint = pick(S, A, P);
    const cardTint = pick(P, S, A);
    const NEUTRAL = '#2a2a3a'; // cool slate if a palette is warm all the way through
    root.setProperty('--tint-page', pageTint ? rgbToCss(pageTint) : NEUTRAL);
    root.setProperty('--tint-section', sectionTint ? rgbToCss(sectionTint) : NEUTRAL);
    root.setProperty('--tint-card', cardTint ? rgbToCss(cardTint) : NEUTRAL);

    // Approximate the Ink-based backgrounds from simplified-style.css.
    const ink = [11, 10, 18].map(v => v / 255);
    const mixInk = (c, t) => (c || hexToRgb(NEUTRAL)).map((v, i) => v * t + ink[i] * (1 - t));
    const pageBg = mixInk(pageTint, 0.10);
    const sectionBg = mixInk(sectionTint, 0.22);
    const cardBg = mixInk(cardTint, 0.20);

    root.setProperty('--on-primary', bestTextOn(P));
    root.setProperty('--on-accent', bestTextOn(A));
    root.setProperty('--on-primary-icon-filter', bestTextOn(P) === '#ffffff' ? 'none' : 'invert(1)');
    root.setProperty('--link-color', rgbToCss(lightenUntil(A, [pageBg, sectionBg, cardBg], 4.8)));
}

// Background tints must stay cool or violet. Reds through gold turn maroon/brown
// when darkened, and near-grays pick up a muddy cast, so both are skipped.
function isBrownProne(rgb) {
    const max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
    if (d < 0.08) return true;                   // near-gray: falls back to cool slate
    let h;
    if (max === rgb[0]) h = ((rgb[1] - rgb[2]) / d) % 6;
    else if (max === rgb[1]) h = (rgb[2] - rgb[0]) / d + 2;
    else h = (rgb[0] - rgb[1]) / d + 4;
    h = (h * 60 + 360) % 360;
    return h >= 345 || h <= 70;
}

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
}
function rgbToCss(rgb) {
    return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
}
function luminance(rgb) {
    const [r, g, b] = rgb.map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
function bestTextOn(bg) {
    return contrast([1, 1, 1], bg) >= contrast([0.07, 0.07, 0.07], bg) ? '#ffffff' : '#111111';
}
// Mix a colour toward white until it reaches the target contrast on every background.
function lightenUntil(rgb, backgrounds, target) {
    for (let t = 0; t <= 1.0001; t += 0.05) {
        const mixed = rgb.map(v => v + (1 - v) * t);
        if (backgrounds.every(bg => contrast(mixed, bg) >= target)) return mixed;
    }
    return [1, 1, 1];
}

// Set tagline
function setTagline(tagline) {
    const taglineElement = document.getElementById('hero-tagline');
    if (taglineElement) {
        taglineElement.textContent = tagline;
    } else {
        console.error('Tagline element not found.');
    }
}

// Video sizing is handled by CSS aspect-ratio and 100% width/height on iframe
// No JavaScript resizing needed

// Load and randomize photo gallery from JSON
async function loadGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    const resizeGalleryItem = item => {
        const img = item.querySelector('img, video');
        if (!img || (img.tagName === 'IMG' && (!img.complete || !img.naturalWidth))) return;

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
                    img.poster = buildVersionedAssetUrl(image.poster, image.posterVersion || image.version);
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
            const fullUrl = buildVersionedAssetUrl(image.path, image.version || BUILD_HASH);
            if (!isVideo && image.small) {
                // Grid tiles are ~25vw on desktop and ~50vw on mobile.
                img.srcset = `${buildVersionedAssetUrl(image.small, image.version)} 600w, ${fullUrl} 1200w`;
                img.sizes = '(max-width: 768px) 50vw, 25vw';
            }
            img.src = fullUrl;
            if (!isVideo) img.alt = image.alt || 'DJ Nerva performing';
            // Only selected media is created, when the gallery nears the viewport.
            // Fetch photos before inserting their tiles to avoid collapsed grid frames.
            if (!isVideo) img.loading = 'eager';
            img.decoding = 'async';

            img.addEventListener('error', () => div.remove(), { once: true });
            img.addEventListener(isVideo ? 'loadedmetadata' : 'load', () => {
                if (!isVideo && !div.isConnected && img.naturalWidth) grid.appendChild(div);
                if (isVideo && img.videoWidth && img.videoHeight) {
                    img.style.aspectRatio = `${img.videoWidth} / ${img.videoHeight}`;
                }
                window.requestAnimationFrame(() => resizeGalleryItem(div));
            }, { once: true });
            
            div.appendChild(img);
            if (isVideo || (img.complete && img.naturalWidth)) grid.appendChild(div);

            if (isVideo || (img.complete && img.naturalWidth)) {
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

// Genre buckets for the mix filters, matched against each mix's title and tags.
const MIX_GENRES = [
    ['Jungle / DnB', /jungle|drum\s*(&|and|n)\s*bass|\bdnb\b|d&b|liquid|ragga/i],
    ['Baltimore Club', /baltimore club|bmore|jersey club|ghettotech|footwork|juke/i],
    ['House', /house|disco|garage/i],
    ['Techno', /techno|acid/i],
    ['Breaks', /breaks?\b|breakbeat/i],
    ['Experimental', /experimental|ambient|idm|downtempo/i],
];

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
            ...soundcloud.tracks.map(mix => ({
                title: mix.title, date: mix.created_at, tags: mix.tags, key: 'sc' + normalize(mix.permalink_url),
                platform: 'SoundCloud', artwork: (mix.artwork_url || '').replace('-large.', '-t300x300.')
            })),
            ...mixcloud.cloudcasts.map(mix => ({
                title: mix.name, date: mix.created_time, tags: mix.tags, key: 'mc' + normalize(mix.key),
                platform: 'Mixcloud', artwork: mix.pictures?.['320wx320h'] || mix.pictures?.large || ''
            }))
        ].map(mix => ({ ...mix, timestamp: Date.parse((mix.date || '').replace(/^(\d{4})\/(\d{2})\/(\d{2}) /, '$1-$2-$3T').replace(' +0000', 'Z')) }))
            .filter(mix => players.has(mix.key))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latest = mixes.slice(0, 4);
        const remaining = mixes.slice(4);
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        const createTile = mix => {
            const tile = document.createElement('div');
            tile.className = 'embed-item';
            const player = createMixFacade(mix, players.get(mix.key));
            const date = document.createElement('time');
            date.className = 'mix-date';
            if (Number.isFinite(mix.timestamp)) {
                date.dateTime = new Date(mix.timestamp).toISOString();
                date.textContent = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(mix.timestamp);
            } else date.textContent = 'Date unavailable';
            const nowPlaying = document.createElement('span');
            nowPlaying.className = 'now-playing';
            nowPlaying.innerHTML = '<i></i><i></i><i></i><i></i>';
            nowPlaying.setAttribute('aria-hidden', 'true');
            date.prepend(nowPlaying);
            tile.append(player, date);
            if (Array.isArray(mix.tags) && mix.tags.length) {
                const genre = document.createElement('p');
                genre.className = 'mix-tags';
                genre.textContent = mix.tags.join(' · ');
                tile.append(genre);
            }
            return tile;
        };
        document.getElementById('latest-mixes-grid').replaceChildren(...latest.map(createTile));

        // "More Mixes": genre filters + paging, so phones don't scroll through every mix.
        const PAGE = 8;
        const grid = document.getElementById('other-mixes-grid');
        const moreButton = document.getElementById('show-more-mixes');
        const filterBar = document.getElementById('mix-filters');
        const genreOf = mix => {
            const text = [mix.title, ...(mix.tags || [])].join(' | ');
            return MIX_GENRES.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
        };
        mixes.forEach(mix => { mix.genres = genreOf(mix); });
        let pool = remaining;
        let shown = 0;
        const showNext = () => {
            const next = pool.slice(shown, shown + PAGE);
            grid.append(...next.map(createTile));
            shown += next.length;
            moreButton.hidden = shown >= pool.length;
            moreButton.textContent = `Show more mixes (${pool.length - shown})`;
        };
        const applyFilter = genre => {
            // "All" keeps the shuffled remainder; a genre shows every match, newest first.
            pool = genre ? mixes.filter(mix => mix.genres.includes(genre)) : remaining;
            shown = 0;
            grid.replaceChildren();
            showNext();
            filterBar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.genre || '') === (genre || ''))));
        };
        const chip = (label, genre, count) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mix-filter';
            b.dataset.genre = genre;
            b.setAttribute('aria-pressed', 'false');
            b.innerHTML = `${label} <span class="mix-filter-count">${count}</span>`;
            b.addEventListener('click', () => applyFilter(genre));
            return b;
        };
        filterBar.replaceChildren(
            chip('All', '', remaining.length),
            ...MIX_GENRES.map(([name]) => [name, mixes.filter(m => m.genres.includes(name)).length])
                .filter(([, n]) => n > 0)
                .map(([name, n]) => chip(name, name, n))
        );
        moreButton.addEventListener('click', showNext);
        applyFilter('');
        status.textContent = mixes.length ? '' : 'No mixes available yet.';
    } catch (error) {
        console.error('Error loading mixes:', error);
        status.textContent = 'Unable to load mixes. Please refresh to try again.';
    }
}

let activeMix = null;

// A lightweight cover-art button stands in for each player. The real
// SoundCloud/Mixcloud iframe (hundreds of KB of script each) loads on click.
function createMixFacade(mix, template) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mix-facade';
    button.setAttribute('aria-label', `Play “${mix.title}” on ${mix.platform}`);

    if (mix.artwork) {
        const art = document.createElement('img');
        art.src = mix.artwork;
        art.alt = '';
        art.loading = 'lazy';
        art.decoding = 'async';
        art.width = 250;
        art.height = 250;
        art.addEventListener('error', () => art.remove(), { once: true });
        button.append(art);
    }
    const play = document.createElement('span');
    play.className = 'mix-facade-play';
    play.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.className = 'mix-facade-title';
    title.textContent = mix.title;
    const platform = document.createElement('span');
    platform.className = 'mix-facade-platform';
    platform.textContent = mix.platform;
    button.append(play, title, platform);

    const activate = () => {
        const player = template.cloneNode(true);
        player.title = mix.title;
        player.removeAttribute('loading');
        const url = new URL(player.src);
        if (player.classList.contains('soundcloud')) {
            const color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim().replace('#', '');
            if (color) url.searchParams.set('color', color);
            url.searchParams.set('auto_play', 'true');
        } else {
            url.searchParams.set('autoplay', '1');
        }
        player.src = url.toString();

        // One mix at a time: the previous player goes back to its cover tile.
        if (activeMix) {
            activeMix.player.replaceWith(activeMix.button);
            activeMix.button.closest('.embed-item')?.classList.remove('is-playing');
        }
        const tile = button.closest('.embed-item');
        button.replaceWith(player);
        tile?.classList.add('is-playing');
        activeMix = { player, button };
        player.focus();
    };
    button.addEventListener('click', activate);
    return button;
}

// Same idea for the featured YouTube video. Several can be listed in the HTML;
// one is picked at random per visit (all stay visible without JavaScript).
document.addEventListener('DOMContentLoaded', () => {
    const cards = [...document.querySelectorAll('#featured-video .video-card')];
    if (cards.length > 1) {
        const keep = getRandomItem(cards);
        cards.forEach(card => { if (card !== keep) card.remove(); });
    }

    document.querySelectorAll('.video-facade').forEach(button => {
        button.addEventListener('click', () => {
            const iframe = document.createElement('iframe');
            iframe.src = button.dataset.embed;
            iframe.title = button.dataset.title || 'YouTube video player';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.setAttribute('frameborder', '0');
            button.replaceWith(iframe);
            iframe.focus();
        }, { once: true });
    });
});

// In-page links: the gallery and mixes load as they come into view, which can
// push the target down mid-scroll. Re-aim until the target settles under the header.
document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href').length < 2) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    let checks = 0;
    const settle = () => {
        const offset = target.getBoundingClientRect().top - 72;
        if (Math.abs(offset) > 24 && checks++ < 6) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
            setTimeout(settle, 350);
        }
    };
    setTimeout(settle, reduce ? 50 : 900);
});
