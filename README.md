# DJ Nerva Website

A dynamic, single-page website for Baltimore-based DJ Nerva that creates a unique visual experience on each page load through randomized hero images, color schemes, and taglines.

## 🎨 Features

- **Dynamic Hero Images**: Randomized AI-generated backgrounds from 13 themed collections
- **Adaptive Color Theming**: Automatic color palette extraction and application
- **Random Taglines**: Rotating collection of 18 DJ-themed slogans
- **Responsive Design**: Optimized for desktop and mobile devices
- **Music Integration**: Embedded Mixcloud players showcasing DJ sets
- **Event Calendar**: Upcoming performances and bookings
- **Equipment Showcase**: Available gear for event bookings
- **SEO Optimized**: Complete meta tags, Open Graph, and Twitter Cards

## 🚀 Quick Start

1. Clone the repository
2. Open `index.html` in a web browser
3. Click the "Remix" button to see different visual combinations

## 📁 Project Structure

```
Website/
├── index.html                 # Main HTML file
├── main.js                   # Core JavaScript functionality
├── simplified-style.css      # Styling and responsive design
├── image_data.json          # Generated image manifest with color data
├── taglines.json            # Collection of random taglines
├── build-image-manifest.js  # Node.js script for image processing
├── splash-images/           # Hero image collections (1-13 folders)
│   ├── 1/                   # Desktop and mobile images
│   ├── 2/
│   └── ...
├── icons/                   # UI icons and buttons
└── sound/                   # Audio assets
```

## 🛠 Technical Implementation

### Core JavaScript (`main.js`)

The main script handles:
- Fetching image and tagline data from JSON files
- Random selection of visual elements
- DOM manipulation for dynamic content
- Fallback mechanisms for error handling
- Cache-busting for image updates

### Image Processing (`build-image-manifest.js`)

Node.js script that:
- Processes all images in splash-images folders
- Extracts color palettes using Vibrant library
- Generates `image_data.json` manifest
- Ensures WCAG contrast compliance
- Maintains brand consistency

### Data Structure

**`image_data.json`** - Contains 13 image sets with:
```json
{
  "folder": "1",
  "desktop": "image-filename.png",
  "mobile": "mobile-filename.png", 
  "primaryColor": "#6625d9",
  "secondaryColor": "#0c1762",
  "accentColor": "#73baee"
}
```

**`taglines.json`** - Array of rotating taglines:
```json
[
  "Baltimore Beats, Global Heat.",
  "Jungle-Fueled. House-Powered.",
  "High-BPM Heartbeat of Charm City."
]
```

## 🎯 User Experience

### The "Remix" Concept
- Users can click "Remix" to refresh and get new visual combinations
- Each page load presents a unique aesthetic while maintaining brand consistency
- Mirrors DJ culture of remixing - same content, different presentation

### Responsive Design
- Desktop and mobile-optimized images
- Adaptive layouts for all screen sizes
- Touch-friendly navigation elements

## 📱 Website Sections

1. **Hero Section**: Dynamic background, logo, random tagline, CTA
2. **About**: DJ biography and musical style description
3. **Music**: Embedded Mixcloud players with DJ sets
4. **Calendar**: Upcoming events and performance dates
5. **Gear**: Equipment available for booking
6. **Booking**: Contact information and booking process
7. **Footer**: Copyright and social media links

## 🔧 Development

### Prerequisites
- Modern web browser
- Node.js (for image processing script)

### Building Image Manifest
```bash
node build-image-manifest.js
```

### Adding New Images
1. Add desktop and mobile versions to numbered folders in `splash-images/`
2. Run the build script to update `image_data.json`
3. Images will automatically be included in rotation

### Adding New Taglines
Edit `taglines.json` and add new entries to the array.

## 🎵 Music Integration

The site features embedded Mixcloud players showcasing various DJ sets:
- Pride Dance Stage Practice Mix
- Off the Rails Practice Mix
- Jungle & Drum and Bass selections
- Club and Techno selections
- Live performance recordings

## ✅ Testing SoundCloud Tracks

There are three easy ways to test the SoundCloud section in `index.html` (the area with the placeholder "Loading SoundCloud Tracks..."):

### 1) Quick local test with static JSON (no API)

This site will first try to load `soundcloud_tracks.json`. If present, it will render those tracks as embeddable players.

- Ensure a `soundcloud_tracks.json` exists at the project root. Two supported shapes:
  - Array
    [
      { "title": "Liquid Dreams", "url": "https://soundcloud.com/dj-nerva/liquid-dreams", "duration": "6:18" }
    ]
  - Object with `tracks` array
    { "tracks": [ { "title": "Liquid Dreams", "permalink_url": "https://soundcloud.com/dj-nerva/liquid-dreams", "duration": 378000 } ] }

Notes:
- `url` or `permalink_url` is accepted; it's normalized automatically.
- `duration` can be milliseconds (number) or a string like "mm:ss" or "hh:mm:ss".

Recommended: run a local server so `fetch()` can read JSON (opening via file:// can block fetch in some browsers).

```bash
# From the Website directory
python3 -m http.server 5500
# Then open http://localhost:5500/
```

Verify:
- Open DevTools Console. You should see logs from `soundcloud.js` like:
  - "Loaded N tracks from JSON (normalized)"
  - "Rendered N SoundCloud tracks"
- A list of embedded SoundCloud players should appear under the "Latest Mixes" header.

Tip: After changing `soundcloud_tracks.json`, in the browser console call:
```js
window.soundcloudIntegration.refresh()
```
to re-render without a full page reload.

### 2) Pull live tracks with a Client ID (API v2)

Use the provided Node script to fetch tracks from the SoundCloud API and write `soundcloud_tracks.json` for you.

Setup:
- Copy `.env.example` to `.env` and fill in values.
- At minimum set:
  - `SOUNDCLOUD_CLIENT_ID=...`
  - Optionally `SOUNDCLOUD_PROFILE_URL=https://soundcloud.com/dj-nerva` (defaults to DJ Nerva)

Run the fetcher (Node 18+):
```bash
node scripts/soundcloud_fetch.js
```

If successful, it writes a normalized document to `soundcloud_tracks.json`. Refresh your browser page to see the updated embeds.

### 3) Full OAuth flow (API v1) if needed

If your app requires OAuth (or you prefer the v1 endpoints), you can obtain an access token and use that instead of a client_id.

Setup `.env`:
- `SOUNDCLOUD_CLIENT_ID=...`
- `SOUNDCLOUD_CLIENT_SECRET=...`
- `SOUNDCLOUD_REDIRECT_URI=http://localhost:8721/callback` (default)

Run OAuth helper:
```bash
node scripts/soundcloud_oauth.js
```

This will:
- Open a browser for you to authorize the app
- Capture the `code` on a local server
- Exchange for `SOUNDCLOUD_ACCESS_TOKEN`
- Print an export command and also append the token to `.env`

Then fetch tracks:
```bash
node scripts/soundcloud_fetch.js
```

### Troubleshooting

- If the SoundCloud section doesn't appear, check the console for:
  - "SoundCloud tracks container not found" (ensure `#soundcloud-tracks` exists in `index.html`)
  - Network errors loading `soundcloud_tracks.json` (start a local server and reload)
  - API errors (401/403): verify `SOUNDCLOUD_CLIENT_ID` or `SOUNDCLOUD_ACCESS_TOKEN`
- Caching: hard refresh the page, or add a `?v=timestamp` to the request when testing.
- JSON shape: ensure each item has a `url` or `permalink_url`; other fields are optional.
- Theme color: the embed color is synced to `--primary-color`; you’ll see it update on page load.

#### OAuth flow not working?

Common fixes when `scripts/soundcloud_oauth.js` fails:

- Redirect URI mismatch: The value in `.env` for `SOUNDCLOUD_REDIRECT_URI` must exactly match the Redirect URI configured in your SoundCloud app (including port and path). Default is `http://localhost:8721/callback`.
- Missing env vars: Ensure `.env` contains `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET` for the same app.
- Node version: Use Node 18+ (script relies on global `fetch`).
- Port in use: If 8721 is taken, change `SOUNDCLOUD_REDIRECT_URI` to another free port and update the app settings accordingly.
- Reused/expired code: After authorizing, the `code` parameter can only be used once and expires quickly. Run the script end-to-end without delay.
- Network filters: Corporate VPNs or blockers can interrupt the token request. Try on a normal network.

## 📅 Events & Booking

Current upcoming events:
- Baltimore Club Day (July 17, 2025)
- Junglist Basement (July 27, 2025)

**Booking Contact**: nerva.corporation@gmail.com

## 🎛 Available Equipment

- XDJ-RX3 Professional DJ System (included with local bookings)
- Powered Speakers with subwoofer (starting at $250+)

## 🌐 SEO & Social

- Complete Open Graph meta tags
- Twitter Card integration  
- Structured data for better search visibility
- Instagram social link integration

## 🔍 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

## 📄 License

© 2025 DJ Nerva. All rights reserved.

## 🤝 Contributing

This is a client website project. For updates or modifications, contact the developer.

---

**Built with**: Vanilla JavaScript, CSS3, HTML5
**Location**: Baltimore, Maryland
**Genre**: Jungle, Drum & Bass, Techno, House, Baltimore Club

## 🧩 Simplified Setup (No build tools)

If you just want to update content without running Node scripts:

- Open `index.html` directly in your browser. No server needed.
- Hero images and colors: `image_data.json` is used when present. If missing, a fallback image and default colors are applied.
- Taglines: Edit `taglines.json` to adjust the random hero text.
- SoundCloud tracks: Edit `soundcloud_tracks.json` (added). The website will load from this static file.

`soundcloud_tracks.json` accepts either of these shapes:

1) Simple array
[
  { "title": "Liquid Dreams", "url": "https://soundcloud.com/dj-nerva/liquid-dreams", "duration": "6:18" }
]

2) Object with tracks array
{ "tracks": [ { "title": "Liquid Dreams", "permalink_url": "https://soundcloud.com/dj-nerva/liquid-dreams", "duration": 378000 } ] }

Duration can be a number in milliseconds or a string like "mm:ss" or "hh:mm:ss". URLs are auto-encoded for the embed.

Advanced/optional scripts (only if you need them):
- `build-image-manifest.js` generates `image_data.json` with color palettes
- `scripts/soundcloud_fetch.js` fetches live track data via the SoundCloud API