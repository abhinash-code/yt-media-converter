const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// EDUCATIONAL USE ONLY - DO NOT USE FOR COPYRIGHTED CONTENT WITHOUT PERMISSION
console.log('\n⚠️  EDUCATIONAL DEMO ONLY - RESPECT COPYRIGHT LAWS ⚠️\n');

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(cors());

// Rate limiting - 10 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many requests from this IP. Please try again later.',
    resetTime: new Date(Date.now() + 15 * 60 * 1000)
  }
});
app.use('/api/', limiter);

// In-memory job storage (use Redis in production)
const jobs = new Map();
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory exists
fs.ensureDirSync(tempDir);

// Job status enum
const JobStatus = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  CONVERTING: 'converting',
  READY: 'ready',
  ERROR: 'error'
};

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '_')     // Replace spaces with underscores
    .replace(/-+/g, '-')      // Replace multiple dashes
    .trim()
    .substring(0, 100);       // Limit length
}

// Helper function to get video metadata using yt-dlp
async function getVideoMetadata(url) {
  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [
      '--print-json',
      '--no-download',
      '--extract-flat',
      url
    ]);

    let stdout = '';
    let stderr = '';

    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout.trim());
          resolve({
            title: metadata.title || 'Unknown Title',
            thumbnail: metadata.thumbnail || metadata.thumbnails?.[0]?.url || null,
            duration: metadata.duration || null,
            uploader: metadata.uploader || 'Unknown',
            view_count: metadata.view_count || null
          });
        } catch (error) {
          console.error('Failed to parse metadata:', error);
          reject(new Error('Failed to parse video metadata'));
        }
      } else {
        console.error('yt-dlp error:', stderr);
        reject(new Error(`Failed to fetch metadata: ${stderr.trim()}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      ytDlp.kill();
      reject(new Error('Metadata fetch timeout'));
    }, 30000);
  });
}

// Helper function to perform conversion
async function performConversion(jobId, url, format, quality = '720p') {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job not found');

  const outputFilename = sanitizeFilename(`${job.metadata.title}_${Date.now()}`);
  const outputPath = path.join(tempDir, `${outputFilename}.${format}`);

  return new Promise((resolve, reject) => {
    // Update job status
    job.status = JobStatus.DOWNLOADING;
    job.progress = 10;
    jobs.set(jobId, job);

    let ytDlpArgs = [
      '--no-playlist',
      '--extract-flat', 'false'
    ];

    if (format === 'mp3') {
      ytDlpArgs.push(
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '192K',
        '--output', outputPath.replace('.mp3', '.%(ext)s')
      );
    } else if (format === 'mp4') {
      const formatSelector = quality === '1080p' ? 'best[height<=1080]' : 
                           quality === '720p' ? 'best[height<=720]' : 
                           'best[height<=360]';
      ytDlpArgs.push(
        '--format', formatSelector,
        '--merge-output-format', 'mp4',
        '--output', outputPath.replace('.mp4', '.%(ext)s')
      );
    }

    ytDlpArgs.push(url);

    console.log(`Starting conversion for job ${jobId}:`, ytDlpArgs.join(' '));

    const ytDlp = spawn('yt-dlp', ytDlpArgs);
    let stderr = '';

    ytDlp.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      
      // Parse progress from yt-dlp output
      if (output.includes('[download]')) {
        if (output.includes('100%')) {
          job.status = JobStatus.CONVERTING;
          job.progress = 80;
        } else if (output.includes('%')) {
          const match = output.match(/(\d+(?:\.\d+)?)%/);
          if (match) {
            const progress = Math.min(70, parseInt(match[1]) * 0.7);
            job.progress = Math.max(job.progress, progress);
          }
        }
        jobs.set(jobId, job);
      }
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        // Find the actual output file (yt-dlp might change extension)
        const possibleFiles = [
          outputPath,
          outputPath.replace(`.${format}`, '.mp3'),
          outputPath.replace(`.${format}`, '.mp4'),
          outputPath.replace(`.${format}`, '.webm'),
          outputPath.replace(`.${format}`, '.m4a')
        ];

        const actualFile = possibleFiles.find(file => fs.existsSync(file));
        
        if (actualFile) {
          // Update job with final status
          job.status = JobStatus.READY;
          job.progress = 100;
          job.outputPath = actualFile;
          job.completedAt = new Date();
          jobs.set(jobId, job);
          
          console.log(`Conversion completed for job ${jobId}: ${actualFile}`);
          resolve(actualFile);
        } else {
          console.error(`Output file not found for job ${jobId}`);
          job.status = JobStatus.ERROR;
          job.error = 'Output file not generated';
          jobs.set(jobId, job);
          reject(new Error('Conversion completed but output file not found'));
        }
      } else {
        console.error(`Conversion failed for job ${jobId}:`, stderr);
        job.status = JobStatus.ERROR;
        job.error = stderr.trim() || 'Unknown conversion error';
        jobs.set(jobId, job);
        reject(new Error(`Conversion failed: ${stderr.trim()}`));
      }
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      ytDlp.kill();
      job.status = JobStatus.ERROR;
      job.error = 'Conversion timeout';
      jobs.set(jobId, job);
      reject(new Error('Conversion timeout'));
    }, 600000);
  });
}

// API Endpoints

// Prepare endpoint - get metadata and create job
app.post('/api/prepare', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Please provide a valid YouTube URL' 
      });
    }

    console.log(`Preparing job for URL: ${url}`);

    // Get video metadata
    const metadata = await getVideoMetadata(url);
    
    // Create job
    const jobId = uuidv4();
    const job = {
      id: jobId,
      url,
      metadata,
      status: JobStatus.QUEUED,
      progress: 0,
      createdAt: new Date(),
      outputPath: null,
      error: null
    };

    jobs.set(jobId, job);

    res.json({
      jobId,
      metadata,
      message: 'Job prepared successfully'
    });

  } catch (error) {
    console.error('Prepare error:', error.message);
    res.status(500).json({ 
      error: 'Failed to prepare conversion: ' + error.message 
    });
  }
});

// Convert endpoint - start conversion
app.post('/api/convert', async (req, res) => {
  try {
    const { jobId, format, quality } = req.body;

    if (!jobId || !jobs.has(jobId)) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!['mp3', 'mp4'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use mp3 or mp4' });
    }

    const job = jobs.get(jobId);
    
    console.log(`Starting conversion for job ${jobId}: ${format} ${quality || 'default'}`);

    // Start conversion in background
    performConversion(jobId, job.url, format, quality)
      .catch(error => {
        console.error(`Conversion failed for job ${jobId}:`, error.message);
      });

    res.json({
      message: 'Conversion started',
      jobId,
      status: JobStatus.DOWNLOADING
    });

  } catch (error) {
    console.error('Convert error:', error.message);
    res.status(500).json({ 
      error: 'Failed to start conversion: ' + error.message 
    });
  }
});

// Status endpoint - check job status
app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const statusMessages = {
    [JobStatus.QUEUED]: 'Preparing conversion...',
    [JobStatus.DOWNLOADING]: 'Downloading video...',
    [JobStatus.CONVERTING]: 'Converting to ' + (job.outputPath?.includes('.mp3') ? 'MP3' : 'MP4') + '...',
    [JobStatus.READY]: 'Conversion complete!',
    [JobStatus.ERROR]: 'Conversion failed'
  };

  res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    message: statusMessages[job.status] || 'Processing...',
    error: job.error,
    metadata: job.metadata
  });
});

// Download endpoint - serve converted file
app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || !job.outputPath || job.status !== JobStatus.READY) {
    return res.status(404).json({ error: 'File not ready for download' });
  }

  const filePath = job.outputPath;
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filename = path.basename(filePath);
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  const fileStream = fs.createReadStream(filePath);
  
  fileStream.pipe(res);

  // Cleanup file after download
  fileStream.on('end', () => {
    setTimeout(() => {
      fs.remove(filePath).catch(console.error);
      jobs.delete(jobId);
      console.log(`Cleaned up job ${jobId} and file ${filePath}`);
    }, 5000); // 5 second delay to ensure download completes
  });

  fileStream.on('error', (error) => {
    console.error('File stream error:', error);
    res.status(500).json({ error: 'Download failed' });
  });
});

// Cleanup endpoint for old jobs and files
app.post('/api/cleanup', (req, res) => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  let cleanedJobs = 0;

  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        fs.removeSync(job.outputPath);
      }
      jobs.delete(jobId);
      cleanedJobs++;
    }
  }

  res.json({ message: `Cleaned up ${cleanedJobs} old jobs` });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    jobs: jobs.size,
    uptime: process.uptime(),
    message: 'Educational YouTube converter demo is running'
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cleanup old jobs on startup
function cleanupOnStartup() {
  fs.emptyDirSync(tempDir);
  console.log('Cleaned temp directory on startup');
}

// Start server
app.listen(PORT, () => {
  cleanupOnStartup();
  console.log(`\n🚀 Educational YouTube Converter Demo`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`⚠️  EDUCATIONAL USE ONLY - RESPECT COPYRIGHT LAWS\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  fs.emptyDirSync(tempDir);
  process.exit(0);
});

module.exports = app;
