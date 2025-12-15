const fs = require('fs');
const path = require('path');

const kmlFile = path.join(process.cwd(), 'places_export.kmz');
const outputFile = path.join(process.cwd(), 'places_played.json');

const kml = fs.readFileSync(kmlFile, 'utf8');

// Extract placemarks
const placemarks = [];
const regex = /<Placemark>[\s\S]*?<name>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/name>[\s\S]*?<coordinates>\s*([-\d.]+),([-\d.]+),[\d.]+\s*<\/coordinates>[\s\S]*?<\/Placemark>/g;

let match;
while ((match = regex.exec(kml)) !== null) {
    placemarks.push({
        name: match[1].trim(),
        city: "Baltimore, MD", // Default, will need manual update for non-Baltimore
        lat: parseFloat(match[3]),
        lng: parseFloat(match[2]),
        link: ""
    });
}

// Fix known cities
placemarks.forEach(p => {
    if (p.name.toLowerCase().includes('deejai') || p.name.toLowerCase().includes('deep green')) {
        p.city = "Chiang Mai, Thailand";
    }
    if (p.name.toLowerCase().includes('fort royale')) {
        p.city = "Bedford, PA";
    }
    if (p.name.toLowerCase().includes('berhta')) {
        p.city = "Washington, DC";
    }
});

console.log(JSON.stringify({ places: placemarks }, null, 4));
