#!/usr/bin/env node

/**
 * Cleanup Script for YouTube Converter Demo
 * Removes old temporary files and clears expired jobs
 * 
 * Usage: node scripts/cleanup.js [--force] [--age=hours]
 */

const fs = require('fs-extra');
const path = require('path');

// Configuration
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const DEFAULT_MAX_AGE_HOURS = 1; // 1 hour default
const LOG_PREFIX = '[CLEANUP]';

class CleanupManager {
    constructor(options = {}) {
        this.tempDir = options.tempDir || TEMP_DIR;
        this.maxAgeHours = options.maxAgeHours || DEFAULT_MAX_AGE_HOURS;
        this.force = options.force || false;
        this.dryRun = options.dryRun || false;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `${LOG_PREFIX} [${timestamp}] [${type.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
    }

    async ensureTempDirectory() {
        try {
            await fs.ensureDir(this.tempDir);
            this.log(`Temp directory ensured: ${this.tempDir}`);
        } catch (error) {
            this.log(`Failed to ensure temp directory: ${error.message}`, 'error');
            throw error;
        }
    }

    async getFileStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const now = new Date();
            const ageMs = now.getTime() - stats.mtime.getTime();
            const ageHours = ageMs / (1000 * 60 * 60);

            return {
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                ageMs,
                ageHours,
                isOld: ageHours > this.maxAgeHours
            };
        } catch (error) {
            this.log(`Failed to get stats for ${filePath}: ${error.message}`, 'warn');
            return null;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(hours) {
        if (hours < 1) {
            const minutes = Math.floor(hours * 60);
            return `${minutes} minutes`;
        }
        return `${hours.toFixed(1)} hours`;
    }

    async scanTempFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const fileStats = [];

            this.log(`Found ${files.length} files in temp directory`);

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await this.getFileStats(filePath);
                
                if (stats) {
                    fileStats.push(stats);
                }
            }

            return fileStats;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log('Temp directory does not exist, creating it');
                await this.ensureTempDirectory();
                return [];
            }
            throw error;
        }
    }

    async cleanupFile(fileStats) {
        try {
            if (this.dryRun) {
                this.log(`[DRY RUN] Would delete: ${path.basename(fileStats.path)} (${this.formatBytes(fileStats.size)}, ${this.formatDuration(fileStats.ageHours)} old)`);
                return true;
            }

            await fs.remove(fileStats.path);
            this.log(`Deleted: ${path.basename(fileStats.path)} (${this.formatBytes(fileStats.size)}, ${this.formatDuration(fileStats.ageHours)} old)`, 'success');
            return true;
        } catch (error) {
            this.log(`Failed to delete ${path.basename(fileStats.path)}: ${error.message}`, 'error');
            return false;
        }
    }

    async run() {
        this.log('Starting cleanup process...');
        this.log(`Max age: ${this.maxAgeHours} hours`);
        this.log(`Force mode: ${this.force}`);
        this.log(`Dry run: ${this.dryRun}`);

        try {
            await this.ensureTempDirectory();
            const files = await this.scanTempFiles();

            if (files.length === 0) {
                this.log('No files found in temp directory');
                return;
            }

            // Categorize files
            const oldFiles = files.filter(f => f.isOld || this.force);
            const recentFiles = files.filter(f => !f.isOld && !this.force);

            // Calculate statistics
            const totalSize = files.reduce((sum, f) => sum + f.size, 0);
            const oldSize = oldFiles.reduce((sum, f) => sum + f.size, 0);

            this.log(`Total files: ${files.length} (${this.formatBytes(totalSize)})`);
            this.log(`Old files to clean: ${oldFiles.length} (${this.formatBytes(oldSize)})`);
            this.log(`Recent files to keep: ${recentFiles.length} (${this.formatBytes(totalSize - oldSize)})`);

            if (oldFiles.length === 0) {
                this.log('No old files to clean up');
                return;
            }

            // Clean up old files
            let successCount = 0;
            let failCount = 0;

            for (const file of oldFiles) {
                const success = await this.cleanupFile(file);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Summary
            this.log(`Cleanup completed: ${successCount} files removed, ${failCount} failed`);
            
            if (successCount > 0) {
                this.log(`Freed up ${this.formatBytes(oldSize)} of disk space`, 'success');
            }

        } catch (error) {
            this.log(`Cleanup failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // Clean up files by pattern
    async cleanupByPattern(pattern) {
        this.log(`Cleaning files matching pattern: ${pattern}`);
        
        try {
            const files = await this.scanTempFiles();
            const regex = new RegExp(pattern);
            const matchingFiles = files.filter(f => regex.test(path.basename(f.path)));

            this.log(`Found ${matchingFiles.length} files matching pattern`);

            let successCount = 0;
            for (const file of matchingFiles) {
                const success = await this.cleanupFile(file);
                if (success) successCount++;
            }

            this.log(`Cleaned ${successCount}/${matchingFiles.length} matching files`);
        } catch (error) {
            this.log(`Pattern cleanup failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // Emergency cleanup - remove all files
    async emergencyCleanup() {
        this.log('Starting emergency cleanup - removing ALL temp files', 'warn');
        
        if (!this.force) {
            this.log('Emergency cleanup requires --force flag', 'error');
            return;
        }

        try {
            await fs.emptyDir(this.tempDir);
            this.log('Emergency cleanup completed - all temp files removed', 'success');
        } catch (error) {
            this.log(`Emergency cleanup failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        force: args.includes('--force'),
        dryRun: args.includes('--dry-run'),
        emergency: args.includes('--emergency'),
        maxAgeHours: DEFAULT_MAX_AGE_HOURS
    };

    // Parse age parameter
    const ageArg = args.find(arg => arg.startsWith('--age='));
    if (ageArg) {
        const ageValue = parseFloat(ageArg.split('=')[1]);
        if (isNaN(ageValue) || ageValue < 0) {
            console.error('Invalid age value. Must be a positive number.');
            process.exit(1);
        }
        options.maxAgeHours = ageValue;
    }

    // Parse pattern parameter
    const patternArg = args.find(arg => arg.startsWith('--pattern='));
    const pattern = patternArg ? patternArg.split('=')[1] : null;

    const cleanup = new CleanupManager(options);

    try {
        if (options.emergency) {
            await cleanup.emergencyCleanup();
        } else if (pattern) {
            await cleanup.cleanupByPattern(pattern);
        } else {
            await cleanup.run();
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Cleanup process failed:', error.message);
        process.exit(1);
    }
}

// Show help
function showHelp() {
    console.log(`
YouTube Converter Cleanup Script

Usage: node scripts/cleanup.js [options]

Options:
  --age=<hours>     Maximum age of files to keep (default: ${DEFAULT_MAX_AGE_HOURS} hour)
  --force           Remove all files regardless of age
  --dry-run         Show what would be deleted without actually deleting
  --emergency       Remove ALL temp files (requires --force)
  --pattern=<regex> Clean files matching regex pattern
  --help            Show this help message

Examples:
  node scripts/cleanup.js                    # Clean files older than 1 hour
  node scripts/cleanup.js --age=0.5          # Clean files older than 30 minutes
  node scripts/cleanup.js --force            # Clean ALL files
  node scripts/cleanup.js --dry-run          # Preview what would be deleted
  node scripts/cleanup.js --pattern="\.mp3$" # Clean only MP3 files
  node scripts/cleanup.js --emergency --force # Emergency cleanup (all files)

Educational Use Only - Do not use for copyrighted content without permission.
    `);
}

// Handle command line
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
} else {
    main().catch(console.error);
}

module.exports = CleanupManager;
