/**
 * Content Detection Engine - VBD Engine Layer
 * 
 * Detects and classifies content types from various sources
 * Supports documents, videos, audio, web content, and more
 */

import { ContentType, ContentSource, ProcessingConfig } from '@/lib/types/content';
// Using URL for path operations to avoid Node.js path module issues
import { URL } from 'url';

export class ContentDetectionEngine {
  private static readonly DOCUMENT_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages',
    '.md', '.markdown', '.tex', '.html', '.htm'
  ]);

  private static readonly PRESENTATION_EXTENSIONS = new Set([
    '.ppt', '.pptx', '.odp', '.key'
  ]);

  private static readonly SPREADSHEET_EXTENSIONS = new Set([
    '.xls', '.xlsx', '.ods', '.csv', '.numbers'
  ]);

  private static readonly VIDEO_EXTENSIONS = new Set([
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', 
    '.m4v', '.3gp', '.ogv', '.ts', '.mts'
  ]);

  private static readonly AUDIO_EXTENSIONS = new Set([
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
    '.opus', '.amr', '.aiff', '.au'
  ]);

  private static readonly IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
    '.webp', '.svg', '.ico', '.heic', '.heif'
  ]);

  private static readonly ARCHIVE_EXTENSIONS = new Set([
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'
  ]);

  private static readonly VIDEO_PLATFORMS = new Set([
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'twitch.tv', 'wistia.com', 'brightcove.com', 'kaltura.com'
  ]);

  private static readonly AUDIO_PLATFORMS = new Set([
    'soundcloud.com', 'spotify.com', 'anchor.fm', 'buzzsprout.com',
    'libsyn.com', 'podbean.com'
  ]);

  private static readonly DOCUMENT_PLATFORMS = new Set([
    'docs.google.com', 'drive.google.com', 'dropbox.com',
    'onedrive.live.com', 'box.com', 'scribd.com', 'slideshare.net'
  ]);

  /**
   * Detect content type from various sources
   */
  async detectContentType(source: ContentSource): Promise<ContentType> {
    switch (source.type) {
      case 'url':
        return this.detectFromUrl(source.source);
      case 'file':
        return this.detectFromFilePath(source.source);
      case 'batch':
        return this.detectFromBatch(source.source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  /**
   * Detect content type from URL
   */
  private async detectFromUrl(url: string): Promise<ContentType> {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check video platforms
      if (ContentDetectionEngine.VIDEO_PLATFORMS.has(hostname)) {
        return 'video';
      }

      // Check audio platforms
      if (ContentDetectionEngine.AUDIO_PLATFORMS.has(hostname)) {
        return 'audio';
      }

      // Check document platforms
      if (ContentDetectionEngine.DOCUMENT_PLATFORMS.has(hostname)) {
        return this.detectDocumentTypeFromUrl(pathname);
      }

      // Check file extension in URL path
      const extension = pathname.substring(pathname.lastIndexOf('.'));
      if (extension) {
        const contentType = this.detectFromExtension(extension);
        if (contentType !== 'web') {
          return contentType;
        }
      }

      // Check Content-Type header if possible
      const contentType = await this.detectFromHttpHeaders(url);
      if (contentType !== 'web') {
        return contentType;
      }

      // Default to web content
      return 'web';
    } catch (error) {
      console.error('Error detecting content type from URL:', error);
      return 'web';
    }
  }

  /**
   * Detect content type from file path
   */
  private detectFromFilePath(filePath: string): ContentType {
    const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return this.detectFromExtension(extension);
  }

  /**
   * Detect content type from file extension
   */
  private detectFromExtension(extension: string): ContentType {
    if (ContentDetectionEngine.VIDEO_EXTENSIONS.has(extension)) {
      return 'video';
    }
    if (ContentDetectionEngine.AUDIO_EXTENSIONS.has(extension)) {
      return 'audio';
    }
    if (ContentDetectionEngine.PRESENTATION_EXTENSIONS.has(extension)) {
      return 'presentation';
    }
    if (ContentDetectionEngine.SPREADSHEET_EXTENSIONS.has(extension)) {
      return 'spreadsheet';
    }
    if (ContentDetectionEngine.DOCUMENT_EXTENSIONS.has(extension)) {
      return 'document';
    }
    if (ContentDetectionEngine.IMAGE_EXTENSIONS.has(extension)) {
      return 'image';
    }
    if (ContentDetectionEngine.ARCHIVE_EXTENSIONS.has(extension)) {
      return 'archive';
    }
    
    return 'document'; // Default fallback
  }

  /**
   * Detect document type from URL path patterns
   */
  private detectDocumentTypeFromUrl(pathname: string): ContentType {
    if (pathname.includes('/presentation') || pathname.includes('/slides')) {
      return 'presentation';
    }
    if (pathname.includes('/spreadsheet') || pathname.includes('/sheets')) {
      return 'spreadsheet';
    }
    return 'document';
  }

  /**
   * Detect content type from HTTP headers
   */
  private async detectFromHttpHeaders(url: string): Promise<ContentType> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const contentType = response.headers.get('content-type')?.toLowerCase();
      if (!contentType) return 'web';

      if (contentType.startsWith('video/')) return 'video';
      if (contentType.startsWith('audio/')) return 'audio';
      if (contentType.startsWith('image/')) return 'image';
      
      // Document MIME types
      if (contentType.includes('pdf')) return 'document';
      if (contentType.includes('msword') || contentType.includes('wordprocessingml')) return 'document';
      if (contentType.includes('ms-excel') || contentType.includes('spreadsheetml')) return 'spreadsheet';
      if (contentType.includes('ms-powerpoint') || contentType.includes('presentationml')) return 'presentation';
      if (contentType.includes('opendocument')) {
        if (contentType.includes('text')) return 'document';
        if (contentType.includes('spreadsheet')) return 'spreadsheet';
        if (contentType.includes('presentation')) return 'presentation';
      }

      return 'web';
    } catch (error) {
      console.error('Error fetching HTTP headers:', error);
      return 'web';
    }
  }

  /**
   * Detect content type from batch processing
   */
  private detectFromBatch(batchId: string): ContentType {
    // For batch processing, we'll need to analyze the batch contents
    // This is a placeholder for now
    return 'document';
  }

  /**
   * Generate processing configuration based on content type
   */
  generateProcessingConfig(
    contentType: ContentType,
    userPreferences?: Partial<ProcessingConfig>
  ): ProcessingConfig {
    const baseConfig: ProcessingConfig = {
      contentType,
      extractText: true,
      generateEmbeddings: true,
      enableTranscription: false,
      enableOCR: false,
      enableObjectDetection: false,
      quality: 'medium',
      phiDetection: true,
      auditLogging: true,
      ...userPreferences
    };

    // Customize config based on content type
    switch (contentType) {
      case 'video':
        return {
          ...baseConfig,
          enableTranscription: true,
          enableOCR: true,
          enableObjectDetection: true,
          maxDuration: 7200, // 2 hours max
          quality: 'high'
        };

      case 'audio':
        return {
          ...baseConfig,
          enableTranscription: true,
          maxDuration: 14400, // 4 hours max
          quality: 'high'
        };

      case 'web':
        return {
          ...baseConfig,
          enableOCR: true,
          crawlDepth: 3,
          maxPages: 100,
          allowedDomains: [] // Will be populated by the manager
        };

      case 'document':
      case 'presentation':
      case 'spreadsheet':
        return {
          ...baseConfig,
          enableOCR: true,
          maxPages: 1000
        };

      case 'image':
        return {
          ...baseConfig,
          enableOCR: true,
          enableObjectDetection: true,
          extractText: false // Images don't have extractable text directly
        };

      case 'archive':
        return {
          ...baseConfig,
          extractText: false, // Will extract individual files
          generateEmbeddings: false // Will process individual files
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Validate if content can be processed
   */
  validateContent(source: ContentSource, config: ProcessingConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    if (source.type === 'url') {
      try {
        const url = new URL(source.source);
        
        // Check protocol
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`Unsupported protocol: ${url.protocol}`);
        }

        // Check domain restrictions
        if (config.allowedDomains && config.allowedDomains.length > 0) {
          const hostname = url.hostname.toLowerCase();
          const isAllowed = config.allowedDomains.some(domain => 
            hostname === domain || hostname.endsWith(`.${domain}`)
          );
          if (!isAllowed) {
            errors.push(`Domain not allowed: ${hostname}`);
          }
        }
      } catch (error) {
        errors.push(`Invalid URL: ${source.source}`);
      }
    }

    // File validation
    if (source.type === 'file') {
      const extension = source.source.substring(source.source.lastIndexOf('.')).toLowerCase();
      if (!extension) {
        warnings.push('File has no extension, content type detection may be inaccurate');
      }
    }

    // Configuration validation
    if (config.maxDuration && config.maxDuration < 0) {
      errors.push('Maximum duration cannot be negative');
    }

    if (config.maxPages && config.maxPages < 1) {
      errors.push('Maximum pages must be at least 1');
    }

    if (config.crawlDepth && config.crawlDepth < 0) {
      errors.push('Crawl depth cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Estimate processing time and resources
   */
  estimateProcessing(
    contentType: ContentType,
    config: ProcessingConfig,
    metadata?: Record<string, any>
  ): {
    estimatedTime: number; // seconds
    estimatedCost: number; // USD
    resourceRequirements: {
      cpu: 'low' | 'medium' | 'high';
      memory: 'low' | 'medium' | 'high';
      storage: number; // GB
    };
  } {
    let baseTime = 30; // 30 seconds base
    let baseCost = 0.01; // $0.01 base
    let cpu: 'low' | 'medium' | 'high' = 'low';
    let memory: 'low' | 'medium' | 'high' = 'low';
    let storage = 0.1; // 100MB base

    switch (contentType) {
      case 'video':
        baseTime = 120; // 2 minutes base
        baseCost = 0.10;
        cpu = 'high';
        memory = 'high';
        storage = 2.0;
        if (metadata?.duration) {
          baseTime += metadata.duration * 0.1; // 10% of video duration
          baseCost += metadata.duration * 0.001; // $0.001 per second
        }
        break;

      case 'audio':
        baseTime = 60; // 1 minute base
        baseCost = 0.05;
        cpu = 'medium';
        memory = 'medium';
        storage = 0.5;
        if (metadata?.duration) {
          baseTime += metadata.duration * 0.05; // 5% of audio duration
          baseCost += metadata.duration * 0.0005; // $0.0005 per second
        }
        break;

      case 'web':
        baseTime = 180; // 3 minutes base
        baseCost = 0.02;
        cpu = 'medium';
        memory = 'medium';
        storage = 1.0;
        if (config.maxPages) {
          baseTime += config.maxPages * 2; // 2 seconds per page
          baseCost += config.maxPages * 0.001; // $0.001 per page
        }
        break;

      case 'document':
      case 'presentation':
      case 'spreadsheet':
        baseTime = 45; // 45 seconds base
        baseCost = 0.02;
        cpu = 'medium';
        memory = 'low';
        storage = 0.3;
        if (metadata?.pageCount) {
          baseTime += metadata.pageCount * 1; // 1 second per page
          baseCost += metadata.pageCount * 0.0002; // $0.0002 per page
        }
        break;
    }

    // Adjust for quality settings
    if (config.quality === 'high') {
      baseTime *= 1.5;
      baseCost *= 1.3;
      if (cpu === 'low') cpu = 'medium';
      if (cpu === 'medium') cpu = 'high';
      if (memory === 'low') memory = 'medium';
      if (memory === 'medium') memory = 'high';
    } else if (config.quality === 'low') {
      baseTime *= 0.7;
      baseCost *= 0.8;
    }

    // Adjust for additional features
    if (config.enableTranscription) {
      baseTime *= 1.2;
      baseCost *= 1.5;
    }
    if (config.enableOCR) {
      baseTime *= 1.1;
      baseCost *= 1.2;
    }
    if (config.enableObjectDetection) {
      baseTime *= 1.3;
      baseCost *= 1.4;
    }

    return {
      estimatedTime: Math.round(baseTime),
      estimatedCost: Math.round(baseCost * 100) / 100,
      resourceRequirements: {
        cpu,
        memory,
        storage: Math.round(storage * 10) / 10
      }
    };
  }
}
