#!/usr/bin/env node
/**
 * Sync places_played.json from Google My Maps
 * 
 * Usage: node scripts/sync_places_from_google_maps.js
 * 
 * This script fetches the KML data from the Google My Maps link,
 * parses the places, and updates places_played.json while preserving
 * existing links.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Google My Maps ID - Update this if the map changes
const GOOGLE_MAPS_ID = '1iRgLMw9bRXLluTuTupdeIgFn92GqclI';
const KML_URL = `https://www.google.com/maps/d/kml?mid=${GOOGLE_MAPS_ID}&forcekml=1`;

const CWD = process.cwd();
const OUTPUT_FILE = path.join(CWD, 'places_played.json');

// City detection rules based on coordinates or name
const CITY_RULES = [
    { match: (name, lat, lng) => name.toLowerCase().includes('deejai') || name.toLowerCase().includes('deep green'), city: 'Chiang Mai, Thailand' },
    { match: (name, lat, lng) => name.toLowerCase().includes('fort royale'), city: 'Bedford, PA' },
    { match: (name, lat, lng) => name.toLowerCase().includes('berhta'), city: 'Washington, DC' },
    { match: (name, lat, lng) => lat > 38.8 && lat < 39.0 && lng > -77.1 && lng < -76.9, city: 'Washington, DC' },
    { match: (name, lat, lng) => true, city: 'Baltimore, MD' } // Default
];

function getCityForPlace(name, lat, lng) {
    for (const rule of CITY_RULES) {
        if (rule.match(name, lat, lng)) {
            return rule.city;
        }
    }
    return 'Baltimore, MD';
}

function fetchKML(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                fetchKML(response.headers.location).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        });
        
        request.on('error', reject);
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

function parseKML(kml) {
    const places = [];
    
    // Regex to extract placemarks
    const regex = /<Placemark>[\s\S]*?<name>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/name>[\s\S]*?<coordinates>\s*([-\d.]+),([-\d.]+),[\d.]+\s*<\/coordinates>[\s\S]*?<\/Placemark>/g;
    
    let match;
    while ((match = regex.exec(kml)) !== null) {
        const name = match[1].trim();
        const lng = parseFloat(match[2]);
        const lat = parseFloat(match[3]);
        
        places.push({
            name,
            city: getCityForPlace(name, lat, lng),
            lat,
            lng,
            link: ''
        });
    }
    
    return places;
}

function loadExistingPlaces() {
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            return data.places || [];
        }
    } catch (e) {
        console.warn('Could not load existing places:', e.message);
    }
    return [];
}

function mergePlaces(newPlaces, existingPlaces) {
    // Create lookup map for existing places by name (normalized)
    const existingMap = new Map();
    existingPlaces.forEach(p => {
        existingMap.set(p.name.toLowerCase().trim(), p);
    });
    
    // Merge: use new coordinates but preserve existing links
    const merged = newPlaces.map(newPlace => {
        const existing = existingMap.get(newPlace.name.toLowerCase().trim());
        if (existing && existing.link) {
            return {
                ...newPlace,
                link: existing.link
            };
        }
        return newPlace;
    });
    
    return merged;
}

async function main() {
    console.log('🗺️  Syncing places from Google My Maps...');
    console.log(`   URL: https://www.google.com/maps/d/edit?mid=${GOOGLE_MAPS_ID}`);
    console.log('');
    
    try {
        // Fetch KML
        console.log('📥 Fetching KML data...');
        const kml = await fetchKML(KML_URL);
        
        // Parse places
        console.log('📍 Parsing places...');
        const newPlaces = parseKML(kml);
        console.log(`   Found ${newPlaces.length} places in Google My Maps`);
        
        // Load existing and merge
        const existingPlaces = loadExistingPlaces();
        console.log(`   Found ${existingPlaces.length} existing places in places_played.json`);
        
        const mergedPlaces = mergePlaces(newPlaces, existingPlaces);
        
        // Find what's new
        const existingNames = new Set(existingPlaces.map(p => p.name.toLowerCase().trim()));
        const newNames = mergedPlaces.filter(p => !existingNames.has(p.name.toLowerCase().trim()));
        
        if (newNames.length > 0) {
            console.log('');
            console.log('✨ New places added:');
            newNames.forEach(p => console.log(`   - ${p.name} (${p.city})`));
        }
        
        // Save
        const output = { places: mergedPlaces };
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 4));
        
        console.log('');
        console.log(`✅ Updated ${OUTPUT_FILE} with ${mergedPlaces.length} places`);
        console.log('');
        console.log('💡 Tip: Add links manually for new places without them');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
