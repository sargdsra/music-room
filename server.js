const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// ============================================
// Socket.IO Configuration
// ============================================
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    upgradeTimeout: 30000,
    allowEIO3: true,
    cookie: false
});

// ============================================
// Basic Configuration
// ============================================
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Create uploads folder if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================
// Middleware
// ============================================
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname)); // Serve all files from root
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================================
// Health Check (for deployment platforms)
// ============================================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ============================================
// Upload Configuration
// ============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// ============================================
// Room Management
// ============================================
const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ============================================
// API Routes
// ============================================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create a new room
app.post('/api/create-room', (req, res) => {
    try {
        const roomId = generateRoomId();
        rooms[roomId] = {
            host: null,
            users: [],
            playlist: [],
            currentSong: null,
            isPlaying: false,
            currentTime: 0,
            createdAt: Date.now()
        };
        console.log(`✅ Room created: ${roomId}`);
        res.json({ roomId });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// Get room info
app.get('/api/room/:roomId', (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
        users: room.users,
        playlist: room.playlist,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime
    });
});

// Upload audio file
app.post('/api/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        success: true,
        url: `/uploads/${req.file.filename}`,
        filename: req.file.originalname,
        size: req.file.size
    });
});

// ============================================
// Socket.IO Events
// ============================================
io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    // Join a room
    socket.on('join-room', (data) => {
        const { roomId, username } = data;

        console.log(`📥 Join request: ${username} -> ${roomId}`);

        if (!rooms[roomId]) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (rooms[roomId].users.length >= 50) {
            socket.emit('error', 'Room is full');
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username || 'User_' + socket.id.slice(0, 4);

        const userData = {
            id: socket.id,
            username: socket.username,
            isHost: !rooms[roomId].host
        };

        if (!rooms[roomId].host) {
            rooms[roomId].host = socket.id;
        }

        rooms[roomId].users.push(userData);

        // Send room data to the new user
        socket.emit('room-joined', {
            roomId: roomId,
            users: rooms[roomId].users,
            playlist: rooms[roomId].playlist,
            currentSong: rooms[roomId].currentSong,
            isPlaying: rooms[roomId].isPlaying,
            currentTime: rooms[roomId].currentTime || 0,
            isHost: socket.id === rooms[roomId].host
        });

        // Notify others
        socket.to(roomId).emit('user-joined', userData);
        console.log(`✅ ${socket.username} joined ${roomId}`);
    });

    // Add song to playlist
    socket.on('add-song', (data) => {
        const { roomId, song } = data;
        if (!rooms[roomId]) return;

        const newSong = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            ...song,
            addedBy: socket.username,
            addedAt: new Date().toISOString()
        };

        rooms[roomId].playlist.push(newSong);

        if (!rooms[roomId].currentSong) {
            rooms[roomId].currentSong = newSong;
        }

        io.to(roomId).emit('playlist-updated', {
            playlist: rooms[roomId].playlist,
            currentSong: rooms[roomId].currentSong
        });

        console.log(`🎵 Song added: ${newSong.title}`);
    });

    // Play a specific song (host only)
    socket.on('play-song', (data) => {
        const { roomId, songId } = data;
        if (!rooms[roomId]) return;

        if (socket.id !== rooms[roomId].host) {
            socket.emit('error', 'Only the host can play songs');
            return;
        }

        const song = rooms[roomId].playlist.find(s => s.id === songId);
        if (song) {
            rooms[roomId].currentSong = song;
            rooms[roomId].isPlaying = true;
            rooms[roomId].currentTime = 0;

            io.to(roomId).emit('song-changed', {
                song: song,
                isPlaying: true,
                currentTime: 0
            });

            console.log(`▶️ Playing: ${song.title}`);
        }
    });

    // Toggle play/pause
    socket.on('toggle-play', (data) => {
        const { roomId, isPlaying, currentTime } = data;
        if (!rooms[roomId]) return;

        rooms[roomId].isPlaying = isPlaying;
        rooms[roomId].currentTime = currentTime || 0;

        socket.to(roomId).emit('play-state-changed', {
            isPlaying: isPlaying,
            currentTime: rooms[roomId].currentTime
        });

        console.log(`⏯️ Play state: ${isPlaying ? 'Playing' : 'Paused'}`);
    });

    // Seek to position
    socket.on('seek', (data) => {
        const { roomId, currentTime } = data;
        if (!rooms[roomId]) return;

        rooms[roomId].currentTime = currentTime;
        socket.to(roomId).emit('seeked', { currentTime });
    });

    // Remove song (host only)
    socket.on('remove-song', (data) => {
        const { roomId, songId } = data;
        if (!rooms[roomId]) return;

        if (socket.id !== rooms[roomId].host) {
            socket.emit('error', 'Only the host can remove songs');
            return;
        }

        const index = rooms[roomId].playlist.findIndex(s => s.id === songId);
        if (index === -1) return;

        rooms[roomId].playlist.splice(index, 1);

        // If current song was removed, play next
        if (rooms[roomId].currentSong && rooms[roomId].currentSong.id === songId) {
            rooms[roomId].currentSong = rooms[roomId].playlist[0] || null;
            if (rooms[roomId].currentSong) {
                rooms[roomId].isPlaying = true;
                rooms[roomId].currentTime = 0;
                io.to(roomId).emit('song-changed', {
                    song: rooms[roomId].currentSong,
                    isPlaying: true,
                    currentTime: 0
                });
            } else {
                rooms[roomId].isPlaying = false;
                io.to(roomId).emit('play-state-changed', {
                    isPlaying: false,
                    currentTime: 0
                });
            }
        }

        io.to(roomId).emit('playlist-updated', {
            playlist: rooms[roomId].playlist,
            currentSong: rooms[roomId].currentSong
        });

        console.log(`🗑️ Song removed: ${songId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        // Remove user from room
        rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
        socket.to(roomId).emit('user-left', {
            userId: socket.id,
            username: socket.username
        });

        // If host left, assign new host
        if (rooms[roomId].host === socket.id) {
            if (rooms[roomId].users.length > 0) {
                rooms[roomId].host = rooms[roomId].users[0].id;
                rooms[roomId].users[0].isHost = true;
                io.to(roomId).emit('new-host', {
                    hostId: rooms[roomId].host,
                    hostUsername: rooms[roomId].users[0].username
                });
                console.log(`👑 New host: ${rooms[roomId].users[0].username}`);
            } else {
                // Delete empty room after 1 hour
                delete rooms[roomId];
                console.log(`🗑️ Room ${roomId} deleted`);
                return;
            }
        }

        console.log(`🔴 ${socket.username} disconnected from ${roomId}`);
    });
});

// ============================================
// Cleanup empty rooms (every 5 minutes)
// ============================================
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.users.length === 0 && (now - room.createdAt) > 3600000) {
            delete rooms[roomId];
            console.log(`🧹 Cleaned up empty room: ${roomId}`);
        }
    }
}, 300000);

// ============================================
// Start Server
// ============================================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 Music Room Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});