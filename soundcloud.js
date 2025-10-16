/**
 * SoundCloud Integration for DJ Nerva Website
 * Loads tracks from pre-scraped JSON data or attempts direct integration
 */

const SOUNDCLOUD_PROFILE = 'dj-nerva';
const SOUNDCLOUD_TRACKS_URL = `https://soundcloud.com/${SOUNDCLOUD_PROFILE}/tracks`;

// Fallback tracks data (manually curated)
const FALLBACK_TRACKS = [
    {
        title: "Pride Dance Stage Practice Mix 2024",
        permalink_url: "https://soundcloud.com/dj-nerva/pride-dance-stage-practice-mix-2024",
        description: "Practice mix for Baltimore Pride Dance Stage",
        genre: "House",
        duration: 3600000 // 60 minutes in milliseconds
    },
    {
        title: "Off the Rails Practice Mix",
        permalink_url: "https://soundcloud.com/dj-nerva/off-the-rails-practice-mix",
        description: "High energy jungle and breaks mix",
        genre: "Jungle",
        duration: 2400000 // 40 minutes
    },
    {
        title: "Jungle & Drum and Bass",
        permalink_url: "https://soundcloud.com/dj-nerva/jungle-dnb",
        description: "Pure jungle and drum & bass selections",
        genre: "Drum & Bass",
        duration: 3000000 // 50 minutes
    }
];

class SoundCloudIntegration {
    constructor() {
        this.tracks = [];
        this.container = null;
    }

    async init() {
        try {
            this.container = document.getElementById('soundcloud-tracks');
            if (!this.container) {
                console.warn('SoundCloud tracks container not found');
                return;
            }

            // Try to load tracks from JSON file first
            await this.loadTracksFromJSON();
            
            // If no tracks loaded, use fallback
            if (this.tracks.length === 0) {
                console.log('Using fallback tracks data');
                this.tracks = FALLBACK_TRACKS;
            }

            // Render tracks
            this.renderTracks();

        } catch (error) {
            console.error('Error initializing SoundCloud integration:', error);
            this.loadFallbackTracks();
        }
    }

    async loadTracksFromJSON() {
        try {
            const response = await fetch('soundcloud_tracks.json');
            if (response.ok) {
                const data = await response.json();
                // Support both shapes:
                // 1) { tracks: [...] }
                // 2) [ ... ]
                let rawTracks = Array.isArray(data) ? data : (Array.isArray(data.tracks) ? data.tracks : []);

                // Normalize track objects to expected shape
                this.tracks = rawTracks.map((t) => this.normalizeTrack(t)).filter(Boolean);
                console.log(`Loaded ${this.tracks.length} tracks from JSON (normalized)`);
            }
        } catch (error) {
            console.log('Could not load tracks from JSON file:', error.message);
        }
    }

    loadFallbackTracks() {
        this.tracks = FALLBACK_TRACKS;
        this.renderTracks();
    }

    createEmbedUrl(permalinkUrl) {
        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color')
            .trim()
            .replace('#', '') || 'ff5500';

        const encoded = encodeURIComponent(permalinkUrl);
        return `https://w.soundcloud.com/player/?url=${encoded}&color=${primaryColor}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
    }

    formatDuration(milliseconds) {
        if (!milliseconds && milliseconds !== 0) return 'Unknown';
        
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Convert various duration shapes to milliseconds
    toMilliseconds(duration) {
        if (duration == null) return null;
        if (typeof duration === 'number' && Number.isFinite(duration)) return duration; // assume ms
        if (typeof duration === 'string') {
            // Accept "mm:ss" or "m:ss" or "hh:mm:ss"
            const parts = duration.split(':').map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n));
            if (parts.length === 2) {
                const [m, s] = parts;
                return ((m * 60) + s) * 1000;
            }
            if (parts.length === 3) {
                const [h, m, s] = parts;
                return (((h * 60) + m) * 60 + s) * 1000;
            }
        }
        return null;
    }

    // Normalize a track object from various possible shapes
    normalizeTrack(t) {
        if (!t) return null;
        const permalink_url = t.permalink_url || t.url || null;
        if (!permalink_url) return null;
        const durationMs = this.toMilliseconds(t.duration);
        return {
            title: t.title || 'Untitled',
            permalink_url,
            description: t.description || '',
            genre: t.genre || '',
            duration: durationMs
        };
    }

    createTrackElement(track, index) {
        // Use the same structure/classes as Mixcloud embeds for consistent styling
        const trackDiv = document.createElement('div');
        trackDiv.className = 'embed-item soundcloud-track';
        // Rely on CSS grid gaps for spacing; avoid inline margins/backgrounds

        // Create iframe
        const iframe = document.createElement('iframe');
        // Match Mixcloud tile size (250x250) via CSS; attributes are harmless but CSS will win
        iframe.width = '250';
        iframe.height = '250';
        iframe.scrolling = 'no';
        iframe.frameBorder = 'no';
        iframe.allow = 'autoplay';
        iframe.loading = 'lazy'; // Improve performance
        iframe.src = this.createEmbedUrl(track.permalink_url);
        
        // Create track info
        const trackInfo = document.createElement('div');
        trackInfo.className = 'track-info';
        // Keep a light caption style below the tile
        trackInfo.style.cssText = 'margin-top: 8px; font-size: 11px; color: #cccccc; font-family: "Noto Sans", sans-serif; text-align: left; max-width: 250px;';
        
        const duration = this.formatDuration(track.duration);
        const genre = track.genre ? ` • ${track.genre}` : '';
        const description = track.description ? ` • ${track.description.substring(0, 100)}...` : '';

        trackInfo.innerHTML = `
            <div style="margin-bottom: 5px;">
                <strong>${track.title}</strong>
            </div>
            <div style="font-size: 11px; opacity: 0.8;">
                Duration: ${duration}${genre}${description}
            </div>
            <div style="margin-top: 5px;">
                <a href="${track.permalink_url}" target="_blank" rel="noopener noreferrer" 
                   style="color: var(--accent-color, #ff5500); text-decoration: none; font-size: 11px;">
                   🎵 Listen on SoundCloud →
                </a>
            </div>
        `;

        trackDiv.appendChild(iframe);
        trackDiv.appendChild(trackInfo);

        return trackDiv;
    }

    renderTracks() {
        if (!this.container || this.tracks.length === 0) {
            console.warn('No container or tracks to render');
            return;
        }

        // Clear existing content
        this.container.innerHTML = '';

        // Add header
        const header = document.createElement('div');
        header.style.cssText = 'text-align: center; margin-bottom: 20px; padding: 20px;';
        header.innerHTML = `
            <h3 style="color: var(--primary-color, #ffffff); margin-bottom: 10px;">Latest Mixes</h3>
            <p style="color: #cccccc; font-size: 14px;">
                Check out my latest sets on 
                <a href="${SOUNDCLOUD_TRACKS_URL}" target="_blank" rel="noopener noreferrer" 
                   style="color: var(--accent-color, #ff5500); text-decoration: none;">
                   SoundCloud →
                </a>
            </p>
        `;
        this.container.appendChild(header);

    // Create a grid container matching the Mixcloud layout and wrap in flex container
    const grid = document.createElement('div');
    grid.className = 'embed-grid';

    const flexWrap = document.createElement('div');
    flexWrap.className = 'flex-wrap';

        // Add tracks (limit to first 8 for a fuller grid; was 6)
        const tracksToShow = this.tracks.slice(0, 8);
        tracksToShow.forEach((track, index) => {
            const trackElement = this.createTrackElement(track, index);
            grid.appendChild(trackElement);
        });
    flexWrap.appendChild(grid);
    this.container.appendChild(flexWrap);

        // Add "View More" link if there are more tracks
        if (this.tracks.length > 6) {
            const viewMoreDiv = document.createElement('div');
            viewMoreDiv.style.cssText = 'text-align: center; margin-top: 30px; padding: 20px;';
            viewMoreDiv.innerHTML = `
                <a href="${SOUNDCLOUD_TRACKS_URL}" target="_blank" rel="noopener noreferrer"
                   style="display: inline-block; padding: 12px 24px; background: var(--accent-color, #ff5500); 
                          color: white; text-decoration: none; border-radius: 25px; font-weight: bold;
                          transition: transform 0.2s ease;">
                    View All ${this.tracks.length} Tracks on SoundCloud
                </a>
            `;
            this.container.appendChild(viewMoreDiv);
        }

        console.log(`Rendered ${tracksToShow.length} SoundCloud tracks`);
    }

    // Method to refresh tracks (can be called manually)
    async refresh() {
        console.log('Refreshing SoundCloud tracks...');
        this.tracks = [];
        await this.init();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const soundcloud = new SoundCloudIntegration();
    soundcloud.init();
    
    // Make it globally accessible for debugging
    window.soundcloudIntegration = soundcloud;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundCloudIntegration;
}