const mixcloudUploads = [
    // Add your Mixcloud mix URLs here
    "https://www.mixcloud.com/djnerva/spirit-world-round-2-b2b-w-oldboyslug/",
    "https://www.mixcloud.com/djnerva/your-mix-2/",
    "https://www.mixcloud.com/djnerva/your-mix-3/" // Add more Mixcloud URLs as needed
];

function embedMixcloudUploads() {
    const container = document.getElementById('mixcloud-uploads');
    if (!container) return; // Exit if the container is not found
    mixcloudUploads.forEach(url => {
        const encodedFeed = encodeURIComponent(url); // Encode the URL for use in the iframe
        const iframe = document.createElement('iframe');
        iframe.frameBorder = '0';
        iframe.src = `https://player-widget.mixcloud.com/widget/iframe/?feed=${encodedFeed}`;
        // Keep the allowlist minimal to avoid Permissions-Policy violations
        iframe.allow = 'fullscreen; autoplay; idle-detection; speaker-selection; web-share;';
        iframe.className = 'mixcloud-widget'; // Add a class for styling if needed
        container.appendChild(iframe); // Append the iframe to the container
    });
}

document.addEventListener('DOMContentLoaded', embedMixcloudUploads);