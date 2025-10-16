/* global google */
// Initializes the Google Map and loads markers from places_played.json

const MAP_STORAGE_KEY = 'dj_nerva_places_map_state_v1';

function getThemeColors() {
  // Try to read CSS variables for cohesive theming
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--theme-primary-color').trim() || '#1e1e1e';
  const secondary = styles.getPropertyValue('--theme-secondary-color').trim() || '#2a2a2a';
  const accent = styles.getPropertyValue('--theme-accent-color').trim() || '#ff5500';
  return { primary, secondary, accent };
}

function getMapStyle() {
  // A subtle dark style tuned to the site theme
  const { primary, secondary } = getThemeColors();
  const p = primary || '#1e1e1e';
  const s = secondary || '#2a2a2a';
  return [
    { elementType: 'geometry', stylers: [{ color: s }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#e0e0e0' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: p }] },

    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: p }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: p }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d0d0d0' }] },

    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#444' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b0b0b0' }] },

    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b3954' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: p }] },
  ];
}

function saveMapState(map) {
  try {
    const c = map.getCenter();
    const s = {
      lat: c.lat(),
      lng: c.lng(),
      zoom: map.getZoom(),
    };
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function loadMapState() {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchPlaces() {
  try {
    const res = await fetch('places_played.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.places)) return data.places;
    return [];
  } catch (err) {
    console.warn('Failed to load places_played.json:', err);
    return [];
  }
}

function createMarker(map, place, iconUrl) {
  const marker = new google.maps.Marker({
    position: { lat: place.lat, lng: place.lng },
    map,
    title: place.name,
    icon: iconUrl ? { url: iconUrl, scaledSize: new google.maps.Size(28, 28) } : undefined,
  });
  const info = new google.maps.InfoWindow({
    content: `
      <div style="min-width: 220px; background:#ffffff; color:#111; padding:8px 10px; border-radius:6px;">
        <strong style="color:#000;">${place.name}</strong>
        ${place.city ? `<div style="margin-top:4px; color:#333;">${place.city}</div>` : ''}
        ${place.link ? `<div style="margin-top:6px;"><a href="${place.link}" target="_blank" rel="noopener" style="color:#1a73e8; text-decoration:underline;">More info</a></div>` : ''}
      </div>
    `
  });
  marker.addListener('click', () => info.open({ map, anchor: marker }));
  return marker;
}

async function init() {
  const container = document.getElementById('places-map');
  if (!container) return;

  const persisted = loadMapState();
  const { accent } = getThemeColors();

  const map = new google.maps.Map(container, {
    // Always start with a global view
    center: { lat: 20, lng: 0 },
    zoom: 2,
    styles: getMapStyle(),
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    backgroundColor: '#000000',
  });

  map.addListener('idle', () => saveMapState(map));

  // Load places and add markers
  const places = await fetchPlaces();
  const iconSvg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='${accent}'>` +
      `<path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/>` +
    `</svg>`
  );
  const iconUrl = `data:image/svg+xml;charset=UTF-8,${iconSvg}`;

  for (const p of places) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    createMarker(map, p, iconUrl);
  }

  // Keep global default on first load; users can pan/zoom or rely on persisted view.
}

// Exported callback for Google Maps loader
window.initPlacesMap = init;
