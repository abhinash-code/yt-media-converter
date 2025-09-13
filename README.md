# YouTube Converter - Educational Demo

⚠️ **EDUCATIONAL USE ONLY** - This project is for learning and demonstration purposes only. Do not use to download copyrighted content without proper authorization.

## 🎯 Overview

A full-stack web application that converts YouTube videos to MP3/MP4 format using `yt-dlp` and `ffmpeg`. Built with Node.js, Express, and vanilla JavaScript with a modern, responsive UI.

### ⚠️ Legal Notice

**IMPORTANT**: This tool is strictly for educational and demonstration purposes. Users must:
- Only download content they own or that is in the public domain
- Respect copyright laws and YouTube's Terms of Service
- Not use this tool to infringe on intellectual property rights
- Understand that bypassing content protection may violate terms of service

## 🚀 Features

- **Modern UI**: Professional, responsive design with glassmorphism effects
- **Video Preview**: Fetch metadata and thumbnails before conversion
- **Multiple Formats**: Support for MP3 (audio) and MP4 (video) downloads
- **Quality Selection**: Choose video quality (360p, 720p, 1080p)
- **Real-time Progress**: Live progress updates during conversion
- **Rate Limiting**: Built-in protection against abuse
- **Mobile Responsive**: Optimized for all device sizes
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Tools**: yt-dlp, ffmpeg
- **Styling**: Custom CSS with CSS variables and modern features

## 📋 Prerequisites

Before installation, ensure you have:

- **Node.js** (v16.0.0 or higher)
- **npm** (comes with Node.js)
- **ffmpeg** (for video/audio processing)
- **yt-dlp** (for YouTube video downloading)

## 🔧 System Dependencies

### Install ffmpeg

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS (using Homebrew):
```bash
brew install ffmpeg
```

#### Windows:
1. Download from https://ffmpeg.org/download.html
2. Add to system PATH
3. Verify: `ffmpeg -version`

### Install yt-dlp

#### Using pip (recommended):
```bash
pip install yt-dlp
```

#### Ubuntu/Debian:
```bash
sudo apt install yt-dlp
```

#### macOS (using Homebrew):
```bash
brew install yt-dlp
```

#### Windows:
Download from https://github.com/yt-dlp/yt-dlp/releases

### Verify Installation

```bash
ffmpeg -version
yt-dlp --version
```

Both commands should return version information.

## 📦 Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd youtube-converter-demo
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create temp directory:**
```bash
mkdir temp
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Production start:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 🐳 Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
# Use Node.js Alpine image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && pip3 install yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create temp directory
RUN mkdir -p temp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Build and Run with Docker

```bash
# Build image
docker build -t youtube-converter .

# Run container
docker run -p 3000:3000 youtube-converter
```

## 🚀 Deployment Options

### 1. Render.com Deployment

1. **Connect your repository** to Render.com

2. **Create a Web Service** with these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

3. **Add environment variables**:
   ```
   NODE_ENV=production
   PORT=10000
   ```

4. **Enable system packages** in Render dashboard:
   - Go to Environment → Native Environment
   - Add packages: `ffmpeg python3 python3-pip`
   - Add build script:
   ```bash
   pip3 install yt-dlp
   ```

5. **Deploy** - Render will automatically deploy when you push to your repository

### 2. Railway Deployment

1. **Connect repository** to Railway
2. **Add environment variables**:
   ```
   NODE_ENV=production
   ```
3. **Add Dockerfile** (Railway auto-detects Docker)
4. **Deploy** automatically

### 3. Digital Ocean App Platform

1. **Create new app** from GitHub repository
2. **Configure build settings**:
   - Build Command: `npm install && pip3 install yt-dlp`
   - Run Command: `npm start`
3. **Add environment variables**
4. **Deploy**

### 4. VPS Deployment (Ubuntu)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies
sudo apt install -y ffmpeg python3-pip nginx
pip3 install yt-dlp

# Clone and setup application
git clone <your-repo> /var/www/youtube-converter
cd /var/www/youtube-converter
npm install

# Create systemd service
sudo tee /etc/systemd/system/youtube-converter.service > /dev/null << EOL
[Unit]
Description=YouTube Converter Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/youtube-converter
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOL

# Start service
sudo systemctl enable youtube-converter
sudo systemctl start youtube-converter

# Configure Nginx reverse proxy
sudo tee /etc/nginx/sites-available/youtube-converter > /dev/null << EOL
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable site
sudo ln -s /etc/nginx/sites-available/youtube-converter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 API Documentation

### Endpoints

#### `POST /api/prepare`
Prepare a conversion job and fetch video metadata.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=example"
}
```

**Response:**
```json
{
  "jobId": "uuid-string",
  "metadata": {
    "title": "Video Title",
    "thumbnail": "https://...",
    "duration": 180,
    "uploader": "Channel Name"
  }
}
```

#### `POST /api/convert`
Start video conversion.

**Request:**
```json
{
  "jobId": "uuid-string",
  "format": "mp3|mp4",
  "quality": "360p|720p|1080p"
}
```

**Response:**
```json
{
  "message": "Conversion started",
  "jobId": "uuid-string",
  "status": "downloading"
}
```

#### `GET /api/status/:jobId`
Check conversion status.

**Response:**
```json
{
  "jobId": "uuid-string",
  "status": "queued|downloading|converting|ready|error",
  "progress": 75,
  "message": "Converting to MP3...",
  "error": null
}
```

#### `GET /api/download/:jobId`
Download converted file.

**Response:** File download with appropriate headers.

#### `GET /api/health`
System health check.

**Response:**
```json
{
  "status": "ok",
  "jobs": 3,
  "uptime": 1234567,
  "message": "Educational YouTube converter demo is running"
}
```

## 🧪 Testing

### Manual Testing URLs

Use these public domain/Creative Commons videos for testing:

1. **Big Buck Bunny**: `https://www.youtube.com/watch?v=YE7VzlLtp-4`
2. **Sintel Trailer**: `https://www.youtube.com/watch?v=eRsGyueVLvQ`
3. **Tears of Steel**: `https://www.youtube.com/watch?v=R6MlUcmOul8`

### Testing Checklist

- [ ] URL validation works correctly
- [ ] Video preview shows metadata
- [ ] Format selection toggles quality options
- [ ] Legal consent checkbox is enforced
- [ ] Progress updates show during conversion
- [ ] Download works and file is correct format
- [ ] Error handling displays meaningful messages
- [ ] Mobile responsive design works
- [ ] Rate limiting prevents abuse

### Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test concurrent requests
ab -n 100 -c 10 http://localhost:3000/api/health
```

## 🔒 Security Considerations

### Implemented Security Measures

1. **Input Validation**: Strict YouTube URL pattern matching
2. **Rate Limiting**: 10 requests per 15 minutes per IP
3. **File Sanitization**: Clean filenames and paths
4. **Legal Consent**: Required checkbox for user acknowledgment
5. **Error Handling**: No sensitive information in error messages
6. **Timeouts**: Prevent long-running processes
7. **File Cleanup**: Automatic temp file removal

### Additional Security Recommendations

```bash
# Set up firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Install fail2ban
sudo apt install fail2ban

# Configure SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "yt-dlp command not found"
```bash
# Verify installation
which yt-dlp
pip3 show yt-dlp

# Reinstall if needed
pip3 install --upgrade yt-dlp
```

#### 2. "ffmpeg command not found"
```bash
# Verify installation
which ffmpeg
ffmpeg -version

# Install if missing
sudo apt install ffmpeg
```

#### 3. "Permission denied" errors
```bash
# Fix file permissions
chmod +x node_modules/.bin/*
sudo chown -R $USER:$USER temp/
```

#### 4. "Port already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### 5. "Conversion timeout"
- Check internet connection
- Verify video is not too long
- Increase timeout in server.js if needed

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```

View logs:
```bash
# View live logs
tail -f /var/log/youtube-converter.log

# View systemd logs
sudo journalctl -u youtube-converter -f
```

## 📈 Monitoring

### Basic Monitoring Setup

```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server.js --name youtube-converter

# Monitor
pm2 monit
pm2 logs youtube-converter

# Setup startup script
pm2 startup
pm2 save
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```bash
NODE_ENV=production
PORT=3000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=10
CONVERSION_TIMEOUT=600000
TEMP_FILE_TTL=3600000
LOG_LEVEL=info
```

### Custom Configuration

Modify `server.js` to adjust:
- Rate limiting parameters
- File size limits
- Conversion timeouts
- Supported formats
- Quality options

## 📚 Additional Resources

### Documentation Links

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)

### Legal Resources

- [YouTube Terms of Service](https://www.youtube.com/static?template=terms)
- [Copyright Fair Use](https://www.copyright.gov/fair-use/more-info.html)
- [DMCA Guidelines](https://www.copyright.gov/dmca/)

## 🤝 Contributing

This is an educational project. Contributions should focus on:
- Educational value improvements
- Code quality enhancements
- Security improvements
- Documentation updates
- Bug fixes

Please ensure all contributions maintain the educational focus and legal compliance.

## ⚖️ License

MIT License - See LICENSE file for details.

**Important**: This license covers the source code only. Users are responsible for complying with YouTube's Terms of Service, copyright laws, and other applicable regulations.

## 🙏 Acknowledgments

- **yt-dlp team** for the excellent video downloading tool
- **FFmpeg project** for multimedia processing capabilities
- **Express.js community** for the robust web framework
- **Educational use** community for promoting responsible learning

---

**Remember**: This tool is for educational purposes only. Always respect copyright laws and content creators' rights. Use responsibly and ethically.
