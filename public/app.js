// Educational YouTube Converter Demo - Frontend JavaScript
// ⚠️ EDUCATIONAL USE ONLY - DO NOT USE FOR COPYRIGHTED CONTENT WITHOUT PERMISSION

class YouTubeConverter {
    constructor() {
        this.currentJobId = null;
        this.statusCheckInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkSystemHealth();
        
        // Show legal banner on first visit
        if (!localStorage.getItem('legalBannerDismissed')) {
            document.getElementById('legalBanner').classList.remove('hidden');
        }
    }

    bindEvents() {
        // Form submission
        document.getElementById('converterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConvert();
        });

        // Preview button
        document.getElementById('previewBtn').addEventListener('click', () => {
            this.handlePreview();
        });

        // URL input changes
        document.getElementById('youtubeUrl').addEventListener('input', () => {
            this.hideVideoPreview();
        });

        // Format selection changes
        document.querySelectorAll('input[name="format"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.toggleQualitySelection();
            });
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.handleDownload();
        });

        // Next button (reset form)
        document.getElementById('nextBtn').addEventListener('click', () => {
            this.resetForm();
        });

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.resetForm();
        });

        // Legal banner close
        const closeBannerBtn = document.querySelector('.close-banner');
        if (closeBannerBtn) {
            closeBannerBtn.addEventListener('click', () => {
                this.closeLegalBanner();
            });
        }

        // Modal close events
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                this.closeModal();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async checkSystemHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            if (data.status !== 'ok') {
                this.showError('System health check failed. Please try again later.');
            }
        } catch (error) {
            console.warn('Health check failed:', error);
            // Don't show error to user for health check failures
        }
    }

    validateUrl(url) {
        const patterns = [
            /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    async handlePreview() {
        const urlInput = document.getElementById('youtubeUrl');
        const previewBtn = document.getElementById('previewBtn');
        const url = urlInput.value.trim();

        if (!url) {
            this.showInputError('Please enter a YouTube URL first');
            return;
        }

        if (!this.validateUrl(url)) {
            this.showInputError('Please enter a valid YouTube URL');
            return;
        }

        try {
            previewBtn.disabled = true;
            previewBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
            `;

            const response = await fetch('/api/prepare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch video information');
            }

            this.currentJobId = data.jobId;
            this.showVideoPreview(data.metadata);
            this.clearInputError();

        } catch (error) {
            console.error('Preview error:', error);
            this.showInputError(error.message || 'Failed to fetch video information');
            this.hideVideoPreview();
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                </svg>
            `;
        }
    }

    showVideoPreview(metadata) {
        const preview = document.getElementById('videoPreview');
        const thumbnail = document.getElementById('thumbnailImg');
        const title = document.getElementById('videoTitle');
        const uploader = document.getElementById('videoUploader');
        const duration = document.getElementById('videoDuration');

        thumbnail.src = metadata.thumbnail || '';
        thumbnail.alt = `Thumbnail for ${metadata.title}`;
        title.textContent = metadata.title || 'Unknown Title';
        uploader.textContent = metadata.uploader || 'Unknown Channel';
        
        if (metadata.duration) {
            const minutes = Math.floor(metadata.duration / 60);
            const seconds = metadata.duration % 60;
            duration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            duration.textContent = 'Unknown Duration';
        }

        preview.classList.remove('hidden');
        preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideVideoPreview() {
        document.getElementById('videoPreview').classList.add('hidden');
        this.currentJobId = null;
    }

    async handleConvert() {
        // Check legal consent
        const legalConsent = document.getElementById('legalConsent');
        if (!legalConsent.checked) {
            this.showModal();
            return;
        }

        const url = document.getElementById('youtubeUrl').value.trim();
        const format = document.querySelector('input[name="format"]:checked').value;
        const quality = document.getElementById('qualitySelect').value;

        if (!url) {
            this.showInputError('Please enter a YouTube URL');
            return;
        }

        if (!this.validateUrl(url)) {
            this.showInputError('Please enter a valid YouTube URL');
            return;
        }

        try {
            // If no job exists, create one first
            if (!this.currentJobId) {
                await this.handlePreview();
                if (!this.currentJobId) {
                    return; // Preview failed
                }
            }

            this.showProgressSection();
            this.updateProgress(0, 'Starting conversion...');

            // Start conversion
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobId: this.currentJobId,
                    format,
                    quality: format === 'mp4' ? quality : undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start conversion');
            }

            // Start status polling
            this.startStatusPolling();

        } catch (error) {
            console.error('Conversion error:', error);
            this.showError(error.message || 'Failed to start conversion');
        }
    }

    startStatusPolling() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        this.statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/status/${this.currentJobId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to check status');
                }

                this.updateProgress(data.progress, data.message);

                if (data.status === 'ready') {
                    this.stopStatusPolling();
                    this.showDownloadSection();
                } else if (data.status === 'error') {
                    this.stopStatusPolling();
                    this.showError(data.error || 'Conversion failed');
                }

            } catch (error) {
                console.error('Status check error:', error);
                this.stopStatusPolling();
                this.showError('Failed to check conversion status');
            }
        }, 2000); // Check every 2 seconds
    }

    stopStatusPolling() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    updateProgress(percentage, message) {
        const progressFill = document.getElementById('progressFill');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressText = document.getElementById('progressText');

        progressFill.style.width = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
        progressText.textContent = message;
    }

    async handleDownload() {
        if (!this.currentJobId) {
            this.showError('No file available for download');
            return;
        }

        try {
            const downloadBtn = document.getElementById('downloadBtn');
            const originalText = downloadBtn.innerHTML;
            
            downloadBtn.innerHTML = `
                <span class="btn-text">Downloading...</span>
                <div class="btn-icon">⏳</div>
            `;
            downloadBtn.disabled = true;

            // Create download link
            const downloadUrl = `/api/download/${this.currentJobId}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = true;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Small delay to show downloading state
            setTimeout(() => {
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            }, 1500);

        } catch (error) {
            console.error('Download error:', error);
            this.showError('Failed to download file');
            
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.innerHTML = `
                <span class="btn-text">Download File</span>
                <div class="btn-icon">📥</div>
            `;
            downloadBtn.disabled = false;
        }
    }

    showProgressSection() {
        this.hideAllSections();
        document.getElementById('progressSection').classList.remove('hidden');
        
        // Disable form while processing
        document.getElementById('converterForm').style.opacity = '0.6';
        document.getElementById('converterForm').style.pointerEvents = 'none';
    }

    showDownloadSection() {
        this.hideAllSections();
        document.getElementById('downloadSection').classList.remove('hidden');
    }

    showError(message) {
        this.hideAllSections();
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorSection').classList.remove('hidden');
        
        // Re-enable form
        document.getElementById('converterForm').style.opacity = '1';
        document.getElementById('converterForm').style.pointerEvents = 'auto';
    }

    hideAllSections() {
        const sections = ['progressSection', 'downloadSection', 'errorSection'];
        sections.forEach(sectionId => {
            document.getElementById(sectionId).classList.add('hidden');
        });
    }

    resetForm() {
        // Reset form state
        document.getElementById('converterForm').reset();
        document.getElementById('youtubeUrl').value = '';
        document.getElementById('legalConsent').checked = false;
        
        // Reset UI state
        this.hideAllSections();
        this.hideVideoPreview();
        this.clearInputError();
        this.toggleQualitySelection();
        
        // Stop any ongoing polling
        this.stopStatusPolling();
        this.currentJobId = null;
        
        // Re-enable form
        document.getElementById('converterForm').style.opacity = '1';
        document.getElementById('converterForm').style.pointerEvents = 'auto';
        
        // Focus URL input
        document.getElementById('youtubeUrl').focus();
    }

    toggleQualitySelection() {
        const mp4Radio = document.querySelector('input[name="format"][value="mp4"]');
        const qualityGroup = document.getElementById('qualityGroup');
        
        if (mp4Radio.checked) {
            qualityGroup.classList.remove('hidden');
        } else {
            qualityGroup.classList.add('hidden');
        }
    }

    showInputError(message) {
        const urlInput = document.getElementById('youtubeUrl');
        const helpText = document.getElementById('url-help');
        
        urlInput.style.borderColor = 'var(--error)';
        helpText.textContent = message;
        helpText.style.color = 'var(--error)';
        
        // Clear error after delay
        setTimeout(() => {
            this.clearInputError();
        }, 5000);
    }

    clearInputError() {
        const urlInput = document.getElementById('youtubeUrl');
        const helpText = document.getElementById('url-help');
        
        urlInput.style.borderColor = '';
        helpText.textContent = 'Paste a YouTube video URL to get started';
        helpText.style.color = '';
    }

    showModal() {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Focus on modal for accessibility
        document.querySelector('.modal-btn').focus();
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.body.style.overflow = '';
    }

    closeLegalBanner() {
        document.getElementById('legalBanner').style.display = 'none';
        localStorage.setItem('legalBannerDismissed', 'true');
    }

    // Utility method to format file sizes
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Utility method to format duration
    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

// Global functions for HTML event handlers
window.closeModal = () => {
    if (window.converter) {
        window.converter.closeModal();
    }
};

window.closeLegalBanner = () => {
    if (window.converter) {
        window.converter.closeLegalBanner();
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 YouTube Converter Demo - Educational Use Only');
    console.log('⚠️ Do not use for copyrighted content without permission');
    
    window.converter = new YouTubeConverter();
});

// Handle page visibility changes (pause polling when tab is inactive)
document.addEventListener('visibilitychange', () => {
    if (window.converter) {
        if (document.hidden && window.converter.statusCheckInterval) {
            // Optionally pause polling when tab is hidden
            console.log('Tab hidden - conversion continues in background');
        } else if (!document.hidden && window.converter.currentJobId) {
            // Resume or check status when tab becomes visible
            console.log('Tab visible - checking conversion status');
        }
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    console.log('Connection restored');
    if (window.converter && window.converter.currentJobId && !window.converter.statusCheckInterval) {
        // Resume status checking if there's an active job
        window.converter.startStatusPolling();
    }
});

window.addEventListener('offline', () => {
    console.log('Connection lost');
    if (window.converter) {
        window.converter.stopStatusPolling();
    }
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    if (window.converter) {
        window.converter.resetForm();
    }
});

// Prevent accidental page refresh during conversion
window.addEventListener('beforeunload', (e) => {
    if (window.converter && window.converter.statusCheckInterval) {
        e.preventDefault();
        e.returnValue = 'Conversion is in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});

export default YouTubeConverter;
