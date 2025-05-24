// Replace 'YOUR_SOUNDCLOUD_USER' with your SoundCloud username or user ID
// Replace 'YOUR_CLIENT_ID' with your SoundCloud API client_id

const SOUNDCLOUD_USER = 'YOUR_SOUNDCLOUD_USER'; // e.g., 'djnerva'
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Register at https://soundcloud.com/you/apps

const clientId = 'YOUR_SOUNDCLOUD_CLIENT_ID'; // Replace with your SoundCloud API client ID
const userUrl = 'https://api.soundcloud.com/users/dj-nerva/tracks';

async function fetchTracks() {
    try {
        const response = await fetch(`${userUrl}?client_id=${clientId}`);
        const tracks = await response.json();

        const container = document.getElementById('soundcloud-tracks');
        tracks.forEach(track => {
            const iframe = document.createElement('iframe');
            iframe.scrolling = 'no';
            iframe.frameBorder = 'no';
            iframe.allow = 'autoplay';
            iframe.src = `https://w.soundcloud.com/player/?url=${track.permalink_url}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;

            const trackInfo = document.createElement('div');
            trackInfo.style = 'font-size: 10px; color: #cccccc; line-break: anywhere; word-break: normal; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: Interstate, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Garuda, Verdana, Tahoma, sans-serif; font-weight: 100;';
            trackInfo.innerHTML = `
                <a href="https://soundcloud.com/dj-nerva" title="DJ Nerva" target="_blank" style="color: #cccccc; text-decoration: none;">DJ Nerva</a>
                ·
                <a href="${track.permalink_url}" title="${track.title}" target="_blank" style="color: #cccccc; text-decoration: none;">${track.title}</a>
            `;

            container.appendChild(iframe);
            container.appendChild(trackInfo);
        });
    } catch (error) {
        console.error('Error fetching SoundCloud tracks:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchTracks);