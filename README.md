# 🎵 Music Room

A simple and minimal web application for real-time music streaming with friends. Create a room, add songs (via URL or file upload), and listen together with friends.

![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.6-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)


## ✨ Features

- Create rooms with unique codes
- Add songs via URL (YouTube, SoundCloud, etc.)
- Upload audio files (MP3, WAV, OGG, M4A)
- Real-time synchronization - everyone hears the same song at the same time
- Playlist management - add, remove, and reorder songs
- Host controls - only the host can start/stop songs
- Live user list - see who's in the room
- Responsive design - works on desktop and mobile
- Keyboard shortcuts - Space (play/pause), Arrow keys (seek)


## 🚀 Quick Start

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sargdsra/music-room.git
cd music-room

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

### Development Mode

```bash
npm run dev
```

This will start the server with auto-reload using nodemon.


## 📦 Deployment on Cloud Server (VPS)

### Step 1: Server Setup (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```


### Step 2: Deploy the Application

```bash
# Clone your repository
git clone https://github.com/your-username/music-room.git
cd music-room

# Install dependencies
npm install --production

# Create uploads folder
mkdir -p uploads
chmod 755 uploads

# Start with PM2
pm2 start server.js --name music-room
pm2 save
pm2 startup

# Follow the instructions from PM2 to set up startup script
```


### Step 3: Configure Nginx

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/music-room
```

Add this configuration (replace `your-domain.com` with your actual domain or IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 100M;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/music-room /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```


### Step 4: Configure Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```


### Step 5: SSL Certificate with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renew SSL
sudo certbot renew --dry-run
```


## 🚀 Deployment Script (One-Click Setup)

Create a file named `deploy.sh` in the root directory:

```bash
#!/bin/bash

# Music Room - Automatic Deployment Script
# Run: chmod +x deploy.sh && ./deploy.sh

echo "🎵 Deploying Music Room..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "Installing Nginx and Git..."
sudo apt install -y nginx git

# Clone or update project
if [ -d "music-room" ]; then
    cd music-room
    git pull
else
    git clone https://github.com/your-username/music-room.git
    cd music-room
fi

# Install dependencies
npm install --production

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Start with PM2
pm2 start server.js --name music-room
pm2 save
pm2 startup

# Configure Nginx
sudo bash -c 'cat > /etc/nginx/sites-available/music-room << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    client_max_body_size 100M;
}
EOF'

sudo ln -sf /etc/nginx/sites-available/music-room /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ Deployment complete!"
echo "🌐 Your app is running on port 3000"
```

Make it executable and run:

```bash
chmod +x deploy.sh
./deploy.sh
```


## 🚀 Alternative Deployments

### Deploy on Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch the app
flyctl launch

# Set region (Istanbul is best for Iran)
flyctl regions set ist

# Deploy
flyctl deploy
```

### Deploy on Render.com

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" -> "Web Service"
4. Connect your GitHub repository
5. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
6. Click "Create Web Service"

### Deploy on Railway.app

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" -> "Deploy from GitHub"
4. Select your repository
5. Railway will automatically deploy


## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `production` |


## 🎮 How to Use

### 1. Create or Join a Room
- Click **"Create New Room"** to start a room
- Or enter a room code and click **"Join"**

### 2. Add Songs
- **URL**: Paste a YouTube or SoundCloud link
- **Upload**: Drag & drop or click to select audio files

### 3. Control Playback
- **Play/Pause**: Click the play/pause button or press Space
- **Next**: Click the next button
- **Seek**: Drag the progress bar

### 4. Manage Playlist
- Click on any song to play it (host only)
- Remove songs (host only)

### 5. Share the Room
- Click the copy button to copy the room link
- Share it with friends


## 🏗️ Architecture

- **Backend**: Node.js + Express
- **Real-time**: Socket.IO (WebSocket + polling fallback)
- **File Upload**: Multer
- **Frontend**: Vanilla JS + CSS


## 📁 Project Structure

```
music-room/
├── index.html          # Main page
├── style.css           # Styles
├── script.js           # Client-side logic
├── server.js           # Server (Node.js + Socket.IO)
├── package.json        # Dependencies
├── README.md           # Documentation
├── .gitignore          # Git ignore file
├── deploy.sh           # One-click deployment script
└── uploads/            # Uploaded files (auto-created)
```


## 🛠️ Common Commands

```bash
# Start server
npm start

# Development mode (auto-reload)
npm run dev

# Check PM2 status
pm2 status

# View logs
pm2 logs music-room

# Restart application
pm2 restart music-room

# Stop application
pm2 stop music-room
```


## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.


## ❤️ Acknowledgments

- [Socket.IO](https://socket.io/) - Real-time communication
- [Express](https://expressjs.com/) - Web framework
- [Multer](https://github.com/expressjs/multer) - File upload handling
- [PM2](https://pm2.keymetrics.io/) - Process manager for Node.js


## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Made with ❤️ by sargdsra
