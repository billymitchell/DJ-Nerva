// Select the play button, play/pause button, and all iframe elements
const playButton = document.getElementById('play-button');
const playPauseButton = document.getElementById('playPauseButton');
const playPauseIcon = document.getElementById('playPauseIcon');
const soundCloudIframes = document.querySelectorAll('iframe.soundcloud');
const mixCloudIframes = document.querySelectorAll('iframe.mixcloud');

// State to track the currently playing player
let currentPlayer = null;

// Initialize SoundCloud and Mixcloud players
const soundCloudPlayers = Array.from(soundCloudIframes).map((iframe) => SC.Widget(iframe));
const mixCloudPlayers = Array.from(mixCloudIframes).map((iframe) => Mixcloud.PlayerWidget(iframe));

// Combine all players into one array
const allPlayers = [...soundCloudPlayers, ...mixCloudPlayers];

// Function to toggle play/pause
playPauseButton.addEventListener('click', () => {
  if (currentPlayer) {
    currentPlayer.getPaused((isPaused) => {
      if (!isPaused) {
        // Pause the current player
        currentPlayer.pause();
        updatePlayPauseUI(false);
      } else {
        // Resume the current player
        stopAllPlayersExcept(currentPlayer);
        currentPlayer.play();
        updatePlayPauseUI(true);
      }
    });
  } else {
    // Play a random player if none is active
    currentPlayer = getRandomPlayer();
    stopAllPlayersExcept(currentPlayer);
    currentPlayer.play();
    updatePlayPauseUI(true);
  }
});

// Function to update the play/pause button UI
function updatePlayPauseUI(isPlaying) {
  playPauseIcon.src = isPlaying ? 'icons/pause-solid.svg' : 'icons/play-solid.svg';
  playPauseIcon.alt = isPlaying ? 'Pause' : 'Play';
  playButton.textContent = isPlaying ? 'Pause' : 'Play';
}

// Function to get a random player
function getRandomPlayer() {
  const randomIndex = Math.floor(Math.random() * allPlayers.length);
  return allPlayers[randomIndex];
}

// Function to stop all players except the currently playing one
function stopAllPlayersExcept(current) {
  allPlayers.forEach((player) => {
    if (player !== current) {
      player.pause();
    }
  });
}