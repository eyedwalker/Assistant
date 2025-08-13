/**
 * Video Processing Engine - VBD Engine Layer
 * 
 * Core algorithms for video processing including:
 * - Video download and validation
 * - Metadata extraction
 * - Audio extraction and transcription
 * - Key frame extraction
 * - OCR and object detection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { promisify } from 'util';

export interface VideoMetadata {
  duration: number;
  resolution: string;
  frameRate: number;
  codec: string;
  bitrate: number;
  fileSize: number;
  title?: string;
  description?: string;
  subtitles?: any[];
}

export interface KeyFrameOptions {
  interval: number; // seconds
  maxFrames: number;
  quality: 'low' | 'medium' | 'high';
}

export interface KeyFrame {
  timestamp: number;
  imageUrl: string;
  localPath: string;
  description?: string;
  objects?: any[];
  text?: string;
}

export class VideoProcessingEngine {
  private tempDir: string;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
  private readonly MAX_DURATION = 4 * 60 * 60; // 4 hours

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'video-processing');
    this.ensureTempDir();
  }

  /**
   * Download video from URL
   */
  async downloadVideo(url: string): Promise<string> {
    const videoId = crypto.randomBytes(16).toString('hex');
    const outputPath = path.join(this.tempDir, `${videoId}.mp4`);

    try {
      // Handle different video sources
      if (this.isYouTubeUrl(url)) {
        return await this.downloadYouTubeVideo(url, outputPath);
      } else if (this.isDirectVideoUrl(url)) {
        return await this.downloadDirectVideo(url, outputPath);
      } else {
        throw new Error(`Unsupported video source: ${url}`);
      }
    } catch (error) {
      console.error('Video download failed:', error);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Extract comprehensive video metadata
   */
  async extractVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    try {
      const stats = await fs.stat(videoPath);
      
      // Use ffprobe to extract detailed metadata
      const metadata = await this.runFFProbe(videoPath);
      
      return {
        duration: metadata.format?.duration || 0,
        resolution: `${metadata.streams?.[0]?.width || 0}x${metadata.streams?.[0]?.height || 0}`,
        frameRate: this.parseFrameRate(metadata.streams?.[0]?.r_frame_rate),
        codec: metadata.streams?.[0]?.codec_name || 'unknown',
        bitrate: parseInt(metadata.format?.bit_rate) || 0,
        fileSize: stats.size,
        title: metadata.format?.tags?.title,
        description: metadata.format?.tags?.description
      };
    } catch (error) {
      console.error('Metadata extraction failed:', error);
      throw new Error(`Failed to extract video metadata: ${error.message}`);
    }
  }

  /**
   * Extract audio from video for transcription
   */
  async extractAudio(videoPath: string): Promise<string> {
    const audioId = crypto.randomBytes(16).toString('hex');
    const audioPath = path.join(this.tempDir, `${audioId}.wav`);

    try {
      await this.runFFMpeg([
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // PCM 16-bit
        '-ar', '16000', // 16kHz sample rate
        '-ac', '1', // Mono
        audioPath
      ]);

      return audioPath;
    } catch (error) {
      console.error('Audio extraction failed:', error);
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper or AWS Transcribe
   */
  async transcribeAudio(audioPath: string): Promise<string> {
    try {
      // For now, we'll use a placeholder implementation
      // In production, integrate with OpenAI Whisper API or AWS Transcribe
      
      // Check if Whisper is available locally
      if (await this.isWhisperAvailable()) {
        return await this.transcribeWithWhisper(audioPath);
      }
      
      // Fallback to cloud transcription service
      return await this.transcribeWithCloud(audioPath);
    } catch (error) {
      console.error('Audio transcription failed:', error);
      return ''; // Return empty string instead of failing
    }
  }

  /**
   * Extract key frames from video
   */
  async extractKeyFrames(videoPath: string, options: KeyFrameOptions): Promise<KeyFrame[]> {
    const metadata = await this.extractVideoMetadata(videoPath);
    const duration = metadata.duration;
    
    if (duration === 0) {
      throw new Error('Invalid video duration');
    }

    const frameCount = Math.min(
      Math.floor(duration / options.interval),
      options.maxFrames
    );

    const keyFrames: KeyFrame[] = [];
    const frameId = crypto.randomBytes(8).toString('hex');

    try {
      for (let i = 0; i < frameCount; i++) {
        const timestamp = i * options.interval;
        const framePath = path.join(this.tempDir, `frame_${frameId}_${i}.jpg`);

        // Extract frame at specific timestamp
        await this.runFFMpeg([
          '-i', videoPath,
          '-ss', timestamp.toString(),
          '-vframes', '1',
          '-q:v', this.getQualityValue(options.quality),
          framePath
        ]);

        // Verify frame was created
        const frameExists = await fs.access(framePath).then(() => true).catch(() => false);
        if (frameExists) {
          keyFrames.push({
            timestamp,
            imageUrl: `file://${framePath}`, // Will be updated to S3 URL later
            localPath: framePath
          });
        }
      }

      return keyFrames;
    } catch (error) {
      console.error('Key frame extraction failed:', error);
      throw new Error(`Failed to extract key frames: ${error.message}`);
    }
  }

  /**
   * Extract text from video frame using OCR
   */
  async extractTextFromFrame(imagePath: string): Promise<string> {
    try {
      // For now, return placeholder text
      // In production, integrate with Tesseract OCR or AWS Textract
      return await this.runOCR(imagePath);
    } catch (error) {
      console.error('OCR failed for frame:', error);
      return '';
    }
  }

  /**
   * Detect objects in video frame
   */
  async detectObjectsInFrame(imagePath: string): Promise<any[]> {
    try {
      // For now, return empty array
      // In production, integrate with AWS Rekognition or similar
      return await this.runObjectDetection(imagePath);
    } catch (error) {
      console.error('Object detection failed for frame:', error);
      return [];
    }
  }

  /**
   * Get YouTube video title
   */
  async getYouTubeTitle(url: string): Promise<string> {
    try {
      // Use yt-dlp to get video info
      const info = await this.runYtDlp(['--get-title', url]);
      return info.trim() || 'YouTube Video';
    } catch (error) {
      console.error('Failed to get YouTube title:', error);
      return 'YouTube Video';
    }
  }

  /**
   * Extract title from generic URL
   */
  async extractTitleFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentDisposition = response.headers.get('content-disposition');
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          return filenameMatch[1].replace(/\.[^/.]+$/, '');
        }
      }

      // Extract from URL path
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || 'video';
      return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    } catch (error) {
      return 'Video';
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(videoPath: string): Promise<void> {
    try {
      const dir = path.dirname(videoPath);
      const files = await fs.readdir(dir);
      
      // Remove all files related to this processing session
      const baseId = path.basename(videoPath, path.extname(videoPath));
      const relatedFiles = files.filter(file => file.includes(baseId));
      
      for (const file of relatedFiles) {
        await fs.unlink(path.join(dir, file)).catch(() => {});
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // Private helper methods

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private isYouTubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  private isDirectVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    const urlPath = new URL(url).pathname.toLowerCase();
    return videoExtensions.some(ext => urlPath.endsWith(ext));
  }

  private async downloadYouTubeVideo(url: string, outputPath: string): Promise<string> {
    try {
      // Use yt-dlp to download YouTube videos
      await this.runYtDlp([
        '-f', 'best[height<=720]', // Limit to 720p for processing efficiency
        '-o', outputPath,
        url
      ]);

      return outputPath;
    } catch (error) {
      throw new Error(`YouTube download failed: ${error.message}`);
    }
  }

  private async downloadDirectVideo(url: string, outputPath: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_FILE_SIZE) {
        throw new Error('Video file too large');
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(buffer));

      return outputPath;
    } catch (error) {
      throw new Error(`Direct download failed: ${error.message}`);
    }
  }

  private async runFFProbe(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let output = '';
      let error = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        error += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (parseError) {
            reject(new Error(`Failed to parse ffprobe output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`ffprobe failed with code ${code}: ${error}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`ffprobe spawn error: ${err.message}`));
      });
    });
  }

  private async runFFMpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-y', ...args]); // -y to overwrite output files

      let error = '';

      ffmpeg.stderr.on('data', (data) => {
        error += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg failed with code ${code}: ${error}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`ffmpeg spawn error: ${err.message}`));
      });
    });
  }

  private async runYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', args);

      let output = '';
      let error = '';

      ytdlp.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        error += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`yt-dlp failed with code ${code}: ${error}`));
        }
      });

      ytdlp.on('error', (err) => {
        reject(new Error(`yt-dlp spawn error: ${err.message}`));
      });
    });
  }

  private parseFrameRate(frameRateStr: string): number {
    if (!frameRateStr) return 0;
    
    const parts = frameRateStr.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(frameRateStr) || 0;
  }

  private getQualityValue(quality: 'low' | 'medium' | 'high'): string {
    switch (quality) {
      case 'low': return '10';
      case 'medium': return '5';
      case 'high': return '2';
      default: return '5';
    }
  }

  private async isWhisperAvailable(): Promise<boolean> {
    try {
      await this.runCommand('whisper', ['--help']);
      return true;
    } catch {
      return false;
    }
  }

  private async transcribeWithWhisper(audioPath: string): Promise<string> {
    try {
      const output = await this.runCommand('whisper', [
        audioPath,
        '--model', 'base',
        '--output_format', 'txt',
        '--output_dir', this.tempDir
      ]);

      // Read the generated transcript file
      const baseName = path.basename(audioPath, path.extname(audioPath));
      const transcriptPath = path.join(this.tempDir, `${baseName}.txt`);
      
      try {
        const transcript = await fs.readFile(transcriptPath, 'utf-8');
        return transcript.trim();
      } catch {
        return '';
      }
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      return '';
    }
  }

  private async transcribeWithCloud(audioPath: string): Promise<string> {
    // Placeholder for cloud transcription service integration
    // In production, integrate with AWS Transcribe, Google Speech-to-Text, etc.
    console.log('Cloud transcription not implemented yet');
    return '';
  }

  private async runOCR(imagePath: string): Promise<string> {
    try {
      // Placeholder for OCR implementation
      // In production, integrate with Tesseract, AWS Textract, etc.
      const output = await this.runCommand('tesseract', [
        imagePath,
        'stdout',
        '-l', 'eng'
      ]);
      return output.trim();
    } catch (error) {
      console.error('OCR failed:', error);
      return '';
    }
  }

  private async runObjectDetection(imagePath: string): Promise<any[]> {
    // Placeholder for object detection implementation
    // In production, integrate with AWS Rekognition, Google Vision API, etc.
    console.log('Object detection not implemented yet');
    return [];
  }

  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`${command} failed with code ${code}: ${error}`));
        }
      });

      process.on('error', (err) => {
        reject(new Error(`${command} spawn error: ${err.message}`));
      });
    });
  }
}
