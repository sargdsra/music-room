// ============================================
// Initial Configuration
// ============================================
let socket = null;
let roomId = '';
let username = '';
let isHost = false;
let currentSong = null;
let isPlaying = false;
let currentTime = 0;
let audioElement = null;
let playlist = [];

// ============================================
// Connect to Server
// ============================================
function connectToServer() {
    socket = io({
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 30000
    });

    socket.on('connect', () => {
        console.log('✅ Connected to server');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        alert('❌ Failed to connect to server. Please refresh and try again.');
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });

    socket.on('reconnect', () => {
        console.log('🔄 Reconnected to server');
        if (roomId) {
            socket.emit('join-room', {
                roomId: roomId,
                username: username
            });
        }
    });

    // ============================================
    // Socket Events
    // ============================================

    socket.on('room-joined', (data) => {
        roomId = data.roomId;
        isHost = data.isHost;
        playlist = data.playlist || [];
        currentSong = data.currentSong;
        isPlaying = data.isPlaying;
        currentTime = data.currentTime || 0;

        document.getElementById('roomDisplayId').textContent = roomId;
        document.getElementById('joinScreen').classList.remove('active');
        document.getElementById('roomScreen').classList.add('active');

        updateUsersList(data.users);
        updatePlaylist();
        updateCurrentSong();
        updatePlayPauseButton();

        if (currentSong) {
            playAudio(currentSong);
            if (isPlaying) {
                audioElement.play();
            }
            if (currentTime > 0) {
                audioElement.currentTime = currentTime;
            }
        }
    });

    socket.on('user-joined', (user) => {
        addUserToList(user);
        updateUserCount();
    });

    socket.on('user-left', (data) => {
        removeUserFromList(data.userId);
        updateUserCount();
    });

    socket.on('new-host', (data) => {
        isHost = (socket.id === data.hostId);
        if (isHost) {
            alert('👑 You are the new host!');
            updatePlaylist();
        }
    });

    socket.on('playlist-updated', (data) => {
        playlist = data.playlist;
        currentSong = data.currentSong;
        updatePlaylist();
        updateCurrentSong();
        if (currentSong && !audioElement) {
            playAudio(currentSong);
        }
    });

    socket.on('song-changed', (data) => {
        currentSong = data.song;
        isPlaying = data.isPlaying;
        currentTime = data.currentTime || 0;
        updateCurrentSong();
        playAudio(currentSong);
        if (isPlaying) {
            audioElement.play();
        }
        if (currentTime > 0) {
            audioElement.currentTime = currentTime;
        }
        updatePlayPauseButton();
        updatePlaylist();
    });

    socket.on('play-state-changed', (data) => {
        isPlaying = data.isPlaying;
        currentTime = data.currentTime || 0;
        if (audioElement) {
            if (isPlaying) {
                audioElement.play();
            } else {
                audioElement.pause();
            }
            if (currentTime > 0) {
                audioElement.currentTime = currentTime;
            }
        }
        updatePlayPauseButton();
    });

    socket.on('seeked', (data) => {
        if (audioElement) {
            audioElement.currentTime = data.currentTime;
        }
    });

    socket.on('error', (message) => {
        alert('❌ ' + message);
    });
}

// ============================================
// Audio Management
// ============================================
function playAudio(song) {
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement = null;
    }

    try {
        audioElement = new Audio();
        audioElement.src = song.url;
        audioElement.load();

        audioElement.onloadedmetadata = () => {
            document.getElementById('durationDisplay').textContent = formatTime(audioElement.duration);
            document.getElementById('seekSlider').max = audioElement.duration;
        };

        audioElement.ontimeupdate = () => {
            const current = audioElement.currentTime;
            const duration = audioElement.duration;
            if (duration > 0) {
                document.getElementById('seekSlider').value = current;
                document.getElementById('currentTimeDisplay').textContent = formatTime(current);
            }

            // Sync position (only host)
            if (isHost && Math.floor(current) % 2 === 0) {
                socket.emit('seek', {
                    roomId: roomId,
                    currentTime: current
                });
            }
        };

        audioElement.onended = () => {
            playNext();
        };

        audioElement.onerror = (e) => {
            console.error('Audio error:', e);
            alert('❌ Failed to play audio. Please try again.');
        };

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error loading audio');
    }
}

function togglePlayPause() {
    if (!audioElement) {
        alert('❌ No song is playing');
        return;
    }

    if (isPlaying) {
        audioElement.pause();
        isPlaying = false;
    } else {
        audioElement.play();
        isPlaying = true;
    }

    updatePlayPauseButton();

    socket.emit('toggle-play', {
        roomId: roomId,
        isPlaying: isPlaying,
        currentTime: audioElement.currentTime
    });
}

function playNext() {
    if (!playlist.length) return;

    const currentIndex = playlist.findIndex(s => s.id === currentSong?.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextSong = playlist[nextIndex];

    if (isHost) {
        socket.emit('play-song', {
            roomId: roomId,
            songId: nextSong.id
        });
    } else {
        alert('❌ Only the host can change songs');
    }
}

// ============================================
// Utility Functions
// ============================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// UI Updates
// ============================================
function updateUsersList(users) {
    const container = document.getElementById('usersContainer');
    container.innerHTML = users.map(user => `
        <li id="user-${user.id}">
            ${user.id === socket?.id ? '👉 ' : ''}
            ${escapeHtml(user.username)}
            ${user.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
            ${user.id === socket?.id ? ' (You)' : ''}
        </li>
    `).join('');
    updateUserCount();
}

function addUserToList(user) {
    const container = document.getElementById('usersContainer');
    const li = document.createElement('li');
    li.id = `user-${user.id}`;
    li.innerHTML = `
        ${escapeHtml(user.username)}
        ${user.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
    `;
    container.appendChild(li);
    updateUserCount();
}

function removeUserFromList(userId) {
    const element = document.getElementById(`user-${userId}`);
    if (element) element.remove();
    updateUserCount();
}

function updateUserCount() {
    const count = document.querySelectorAll('#usersContainer li').length;
    document.getElementById('userCountBadge').textContent = count;
    document.getElementById('userCount').textContent = `${count} users`;
}

function updatePlaylist() {
    const container = document.getElementById('playlistContainer');
    if (!playlist.length) {
        container.innerHTML = `<li style="text-align:center;color:#999;cursor:default;">Playlist is empty</li>`;
        return;
    }
    container.innerHTML = playlist.map(song => `
        <li class="${song.id === currentSong?.id ? 'active' : ''}" onclick="playSong('${song.id}')">
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-added-by">Added by ${escapeHtml(song.addedBy || 'Unknown')}</div>
            </div>
            <div class="song-actions">
                ${isHost ? `<button onclick="event.stopPropagation();removeSong('${song.id}')" title="Remove">❌</button>` : ''}
            </div>
        </li>
    `).join('');
}

function updateCurrentSong() {
    document.getElementById('currentSongTitle').textContent =
        currentSong ? currentSong.title : 'No song playing';
}

function updatePlayPauseButton() {
    document.getElementById('playPauseBtn').textContent = isPlaying ? '⏸️' : '▶️';
}

function playSong(songId) {
    if (!isHost) {
        alert('❌ Only the host can play songs');
        return;
    }
    socket.emit('play-song', {
        roomId: roomId,
        songId: songId
    });
}

function removeSong(songId) {
    if (!isHost) {
        alert('❌ Only the host can remove songs');
        return;
    }
    if (confirm('Are you sure you want to remove this song?')) {
        socket.emit('remove-song', {
            roomId: roomId,
            songId: songId
        });
    }
}

// ============================================
// Event Listeners
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Connect to server
    connectToServer();

    // ============================================
    // Create Room
    // ============================================
    document.getElementById('createBtn').addEventListener('click', () => {
        username = document.getElementById('usernameInput').value.trim() || 'User_' + Math.floor(Math.random() * 1000);

        console.log('📤 Creating room...');

        fetch('/api/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Room created:', data);
            if (data.roomId) {
                roomId = data.roomId;
                socket.emit('join-room', {
                    roomId: roomId,
                    username: username
                });
            } else {
                throw new Error('No roomId received');
            }
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('❌ Failed to create room: ' + error.message);
        });
    });

    // ============================================
    // Join Room
    // ============================================
    document.getElementById('joinBtn').addEventListener('click', () => {
        const roomIdInput = document.getElementById('roomIdInput').value.trim();
        if (!roomIdInput) {
            alert('❌ Please enter a room code');
            return;
        }

        username = document.getElementById('usernameInput').value.trim() || 'User_' + Math.floor(Math.random() * 1000);
        roomId = roomIdInput;

        console.log(`📥 Joining room ${roomId} as ${username}`);
        socket.emit('join-room', {
            roomId: roomId,
            username: username
        });
    });

    // ============================================
    // Add Song by URL
    // ============================================
    document.getElementById('addUrlBtn').addEventListener('click', () => {
        const url = document.getElementById('songUrlInput').value.trim();
        if (!url) {
            alert('❌ Please enter a URL');
            return;
        }

        const title = prompt('Enter song name:', 'New Song');
        if (!title) return;

        socket.emit('add-song', {
            roomId: roomId,
            song: {
                url: url,
                title: title
            }
        });

        document.getElementById('songUrlInput').value = '';
    });

    // Enter key for URL input
    document.getElementById('songUrlInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addUrlBtn').click();
        }
    });

    // ============================================
    // Upload File
    // ============================================
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const files = e.target.files;
        if (!files.length) return;

        const file = files[0];
        const formData = new FormData();
        formData.append('audio', file);

        document.getElementById('uploadProgress').classList.remove('hidden');

        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                document.getElementById('progressFill').style.width = percent + '%';
                document.getElementById('progressText').textContent = percent + '%';
            }
        };

        xhr.onload = () => {
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('progressFill').style.width = '0%';
            document.getElementById('fileInput').value = '';

            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    socket.emit('add-song', {
                        roomId: roomId,
                        song: {
                            url: data.url,
                            title: data.filename
                        }
                    });
                }
            } else {
                alert('❌ Failed to upload file');
            }
        };

        xhr.onerror = () => {
            alert('❌ Failed to upload file');
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('progressFill').style.width = '0%';
        };

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    });

    // ============================================
    // Player Controls
    // ============================================
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.getElementById('nextBtn').addEventListener('click', playNext);

    document.getElementById('seekSlider').addEventListener('input', function(e) {
        if (!audioElement) return;
        const time = parseFloat(e.target.value);
        audioElement.currentTime = time;
        document.getElementById('currentTimeDisplay').textContent = formatTime(time);

        if (isHost) {
            socket.emit('seek', {
                roomId: roomId,
                currentTime: time
            });
        }
    });

    // ============================================
    // Copy Link
    // ============================================
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        const link = window.location.origin + '?room=' + roomId;
        navigator.clipboard.writeText(link).then(() => {
            alert('✅ Room link copied!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = link;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('✅ Room link copied!');
        });
    });

    // ============================================
    // Leave Room
    // ============================================
    document.getElementById('leaveBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to leave?')) {
            window.location.reload();
        }
    });

    // ============================================
    // Tabs
    // ============================================
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(this.dataset.tab + 'Tab').classList.add('active');
        });
    });

    // ============================================
    // Drag & Drop Upload
    // ============================================
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f0f0ff';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ccc';
        uploadArea.style.background = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ccc';
        uploadArea.style.background = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length) {
            document.getElementById('fileInput').files = files;
            document.getElementById('fileInput').dispatchEvent(new Event('change'));
        }
    });

    uploadArea.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    // ============================================
    // Auto-join from URL parameter
    // ============================================
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
        document.getElementById('roomIdInput').value = roomFromUrl;
        document.getElementById('usernameInput').value = 'User_' + Math.floor(Math.random() * 1000);
        document.getElementById('joinBtn').click();
    }
});

// ============================================
// Keyboard Shortcuts
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
    }

    if (e.code === 'ArrowRight' && audioElement) {
        audioElement.currentTime = Math.min(audioElement.currentTime + 5, audioElement.duration || 0);
    }

    if (e.code === 'ArrowLeft' && audioElement) {
        audioElement.currentTime = Math.max(audioElement.currentTime - 5, 0);
    }
});