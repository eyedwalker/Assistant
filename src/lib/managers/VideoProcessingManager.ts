/**
 * Video Processing Manager - VBD Manager Layer
 * 
 * Orchestrates video content processing including:
 * - Video download and validation
 * - Audio extraction and transcription
 * - Key frame extraction and analysis
 * - Metadata extraction
 * - Secure storage and indexing
 */

import { VideoContent, ProcessingConfig, ProcessingJob, ProcessingStatus, ContentSource } from '@/lib/types/content';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { VideoProcessingEngine } from '@/lib/engines/VideoProcessingEngine';
import * as crypto from 'crypto';

export class VideoProcessingManager {
  private videoEngine: VideoProcessingEngine;

  constructor(
    private mongoAccessor: MongoDBAccessor,
    private s3Accessor: S3Accessor,
    private anthropicAccessor: AnthropicAccessor
  ) {
    this.videoEngine = new VideoProcessingEngine();
  }

  /**
   * Process video content from various sources
   */
  async processVideo(
    source: ContentSource,
    config: ProcessingConfig,
    userId: string,
    tenantId: string
  ): Promise<{ jobId: string; contentId: string }> {
    // Validate access and create processing job
    await this.validateVideoAccess(userId, tenantId);
    
    const contentId = this.generateContentId();
    const jobId = this.generateJobId();

    // Create initial content record
    const videoContent: Partial<VideoContent> = {
      id: contentId,
      contentType: 'video',
      source,
      title: await this.extractInitialTitle(source),
      processingStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      tenantId,
      accessLevel: 'ACCOUNT' // Default, can be overridden
    };

    // Save initial content record
    await this.mongoAccessor.create('contents', videoContent);

    // Create processing job
    const job: ProcessingJob = {
      id: jobId,
      contentId,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      config,
      errors: [],
      metrics: {
        processingTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        storageUsed: 0,
        apiCalls: 0
      }
    };

    await this.mongoAccessor.create('processing_jobs', job);

    // Start async processing
    this.processVideoAsync(contentId, jobId, source, config).catch(error => {
      console.error(`Video processing failed for job ${jobId}:`, error);
      this.handleProcessingError(jobId, error);
    });

    return { jobId, contentId };
  }

  /**
   * Async video processing workflow
   */
  private async processVideoAsync(
    contentId: string,
    jobId: string,
    source: ContentSource,
    config: ProcessingConfig
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update status to processing
      await this.updateProcessingStatus(jobId, 'processing', 5);

      // Step 1: Download and validate video
      const videoPath = await this.videoEngine.downloadVideo(source.source);
      await this.updateProcessingStatus(jobId, 'processing', 15);

      // Step 2: Extract video metadata
      const videoMetadata = await this.videoEngine.extractVideoMetadata(videoPath);
      await this.updateProcessingStatus(jobId, 'processing', 25);

      // Step 3: Extract audio for transcription
      let transcription = '';
      if (config.enableTranscription) {
        await this.updateProcessingStatus(jobId, 'transcribing', 30);
        const audioPath = await this.videoEngine.extractAudio(videoPath);
        transcription = await this.videoEngine.transcribeAudio(audioPath);
        await this.updateProcessingStatus(jobId, 'processing', 50);
      }

      // Step 4: Extract key frames
      let keyFrames: any[] = [];
      if (config.enableObjectDetection || config.enableOCR) {
        await this.updateProcessingStatus(jobId, 'extracting', 55);
        keyFrames = await this.videoEngine.extractKeyFrames(videoPath, {
          interval: 30, // Every 30 seconds
          maxFrames: 100,
          quality: config.quality
        });
        await this.updateProcessingStatus(jobId, 'processing', 70);
      }

      // Step 5: Analyze key frames with AI
      if (keyFrames.length > 0) {
        await this.updateProcessingStatus(jobId, 'analyzing', 75);
        for (let i = 0; i < keyFrames.length; i++) {
          const frame = keyFrames[i];
          
          // OCR text extraction
          if (config.enableOCR) {
            frame.text = await this.videoEngine.extractTextFromFrame(frame.imageUrl);
          }

          // Object detection
          if (config.enableObjectDetection) {
            frame.objects = await this.videoEngine.detectObjectsInFrame(frame.imageUrl);
          }

          // AI description
          frame.description = await this.anthropicAccessor.analyzeImage(
            frame.imageUrl,
            'Describe what you see in this video frame, focusing on educational or training content.'
          );
        }
        await this.updateProcessingStatus(jobId, 'processing', 85);
      }

      // Step 6: Generate embeddings
      let embeddings: number[] = [];
      if (config.generateEmbeddings) {
        const textContent = [
          videoMetadata.title || '',
          videoMetadata.description || '',
          transcription,
          ...keyFrames.map(f => f.description || '').filter(Boolean)
        ].join(' ');

        if (textContent.trim()) {
          embeddings = await this.anthropicAccessor.generateEmbeddings(textContent);
        }
      }

      // Step 7: Store video file in S3
      await this.updateProcessingStatus(jobId, 'processing', 90);
      const s3Key = `videos/${contentId}/${path.basename(videoPath)}`;
      await this.s3Accessor.uploadFile(videoPath, s3Key);

      // Step 8: Store key frames in S3
      for (const frame of keyFrames) {
        const frameKey = `videos/${contentId}/frames/frame_${frame.timestamp}.jpg`;
        await this.s3Accessor.uploadFile(frame.localPath, frameKey);
        frame.imageUrl = await this.s3Accessor.getSignedUrl(frameKey);
      }

      // Step 9: Analyze content for PHI/PII
      let phiDetected = false;
      if (config.phiDetection) {
        const contentToScan = [transcription, ...keyFrames.map(f => f.text || '')].join(' ');
        phiDetected = await this.detectPHI(contentToScan);
      }

      // Step 10: Create final video content record
      const finalContent: VideoContent = {
        id: contentId,
        contentType: 'video',
        source,
        title: videoMetadata.title || this.generateTitleFromSource(source.source),
        description: videoMetadata.description,
        extractedText: keyFrames.map(f => f.text || '').join(' '),
        transcription,
        embeddings,
        processingStatus: 'completed',
        processingTime: Date.now() - startTime,
        fileSize: videoMetadata.fileSize,
        duration: videoMetadata.duration,
        quality: config.quality,
        language: await this.detectLanguage(transcription),
        confidence: this.calculateConfidence(transcription, keyFrames),
        tags: await this.extractTags(transcription, keyFrames),
        categories: await this.categorizeContent(transcription, keyFrames),
        learningObjectives: await this.extractLearningObjectives(transcription),
        difficultyLevel: await this.assessDifficultyLevel(transcription),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: (await this.mongoAccessor.findById('contents', contentId) as any).userId,
        tenantId: (await this.mongoAccessor.findById('contents', contentId) as any).tenantId,
        accessLevel: 'ACCOUNT',
        videoMetadata: {
          duration: videoMetadata.duration,
          resolution: videoMetadata.resolution,
          frameRate: videoMetadata.frameRate,
          codec: videoMetadata.codec,
          bitrate: videoMetadata.bitrate,
          chapters: await this.extractChapters(transcription, keyFrames),
          subtitles: videoMetadata.subtitles || [],
          keyFrames: keyFrames.map(f => ({
            timestamp: f.timestamp,
            imageUrl: f.imageUrl,
            description: f.description,
            objects: f.objects || [],
            text: f.text || ''
          }))
        }
      };

      // Update content record
      await this.mongoAccessor.update('contents', contentId, finalContent);

      // Complete processing job
      await this.updateProcessingStatus(jobId, 'completed', 100);

      // Log audit trail
      if (config.auditLogging) {
        await this.logAuditEvent('video_processed', {
          contentId,
          jobId,
          userId: finalContent.userId,
          tenantId: finalContent.tenantId,
          processingTime: Date.now() - startTime,
          phiDetected
        });
      }

      // Clean up temporary files
      await this.videoEngine.cleanup(videoPath);

    } catch (error) {
      console.error(`Video processing error for job ${jobId}:`, error);
      await this.handleProcessingError(jobId, error);
      throw error;
    }
  }

  /**
   * Validate user access for video processing
   */
  private async validateVideoAccess(userId: string, tenantId: string): Promise<void> {
    // Auto-create demo users for testing
    if (userId.startsWith('demo_') || userId.startsWith('test_')) {
      const demoUser = {
        id: userId,
        name: `Demo User ${userId}`,
        email: `${userId}@demo.com`,
        tenantId,
        role: 'user',
        accessLevel: 'ACCOUNT',
        createdAt: new Date(),
        isDemo: true
      };

      try {
        await this.mongoAccessor.create('users', demoUser);
      } catch (error) {
        // User might already exist, that's okay
        console.log(`Demo user ${userId} already exists or creation failed:`, error);
      }
      return;
    }

    // For real users, validate access
    const user = await this.mongoAccessor.findById('users', userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Additional access validation logic here
    // Check quotas, permissions, etc.
  }

  /**
   * Update processing status and progress
   */
  private async updateProcessingStatus(
    jobId: string,
    status: ProcessingStatus,
    progress: number
  ): Promise<void> {
    await this.mongoAccessor.update('processing_jobs', jobId, {
      status,
      progress,
      updatedAt: new Date()
    });
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(jobId: string, error: any): Promise<void> {
    const processingError = {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'Unknown processing error',
      timestamp: new Date(),
      severity: 'high' as const,
      context: {
        stack: error.stack,
        jobId
      }
    };

    await this.mongoAccessor.update('processing_jobs', jobId, {
      status: 'failed' as ProcessingStatus,
      errors: [processingError],
      endTime: new Date()
    });
  }

  /**
   * Generate unique content ID
   */
  private generateContentId(): string {
    return `video_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Extract initial title from source
   */
  private async extractInitialTitle(source: ContentSource): Promise<string> {
    if (source.type === 'url') {
      try {
        const url = new URL(source.source);
        
        // YouTube URL handling
        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
          return await this.videoEngine.getYouTubeTitle(source.source);
        }
        
        // Generic URL title extraction
        return await this.videoEngine.extractTitleFromUrl(source.source);
      } catch (error) {
        return `Video from ${source.source}`;
      }
    }
    
    return `Video - ${new Date().toISOString()}`;
  }

  /**
   * Generate title from source URL
   */
  private generateTitleFromSource(source: string): string {
    try {
      const url = new URL(source);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop() || 'video';
      return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    } catch {
      return `Video - ${new Date().toISOString()}`;
    }
  }

  /**
   * Detect language from transcription
   */
  private async detectLanguage(text: string): Promise<string> {
    if (!text || text.length < 50) return 'unknown';
    
    // Simple language detection - in production, use a proper language detection service
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'];
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    return englishCount > words.length * 0.1 ? 'en' : 'unknown';
  }

  /**
   * Calculate processing confidence score
   */
  private calculateConfidence(transcription: string, keyFrames: any[]): number {
    let confidence = 0.5; // Base confidence
    
    if (transcription && transcription.length > 100) confidence += 0.2;
    if (keyFrames.length > 5) confidence += 0.1;
    if (keyFrames.some(f => f.text && f.text.length > 10)) confidence += 0.1;
    if (keyFrames.some(f => f.objects && f.objects.length > 0)) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Extract tags from content
   */
  private async extractTags(transcription: string, keyFrames: any[]): Promise<string[]> {
    const content = [
      transcription,
      ...keyFrames.map(f => f.description || '').filter(Boolean)
    ].join(' ');

    if (!content.trim()) return [];

    // Use AI to extract relevant tags
    try {
      const prompt = `Extract 5-10 relevant tags from this video content. Focus on medical, eyecare, and educational topics. Return as comma-separated list:\n\n${content.substring(0, 2000)}`;
      const response = await this.anthropicAccessor.generateChatResponse([
        { role: 'user', content: prompt }
      ]);
      
      return response.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
    } catch (error) {
      console.error('Error extracting tags:', error);
      return [];
    }
  }

  /**
   * Categorize content
   */
  private async categorizeContent(transcription: string, keyFrames: any[]): Promise<string[]> {
    const categories = [
      'clinical-procedures', 'patient-care', 'optical-calculations', 
      'equipment-training', 'diagnosis', 'treatment', 'education',
      'compliance', 'safety', 'technology'
    ];

    // Simple keyword-based categorization for now
    const content = (transcription + ' ' + keyFrames.map(f => f.description || '').join(' ')).toLowerCase();
    
    return categories.filter(category => {
      const keywords = category.split('-');
      return keywords.some(keyword => content.includes(keyword));
    });
  }

  /**
   * Extract learning objectives
   */
  private async extractLearningObjectives(transcription: string): Promise<string[]> {
    if (!transcription || transcription.length < 100) return [];

    try {
      const prompt = `Extract 3-5 learning objectives from this video transcription. Focus on what viewers will learn. Format as bullet points:\n\n${transcription.substring(0, 2000)}`;
      const response = await this.anthropicAccessor.generateChatResponse([
        { role: 'user', content: prompt }
      ]);
      
      return response.split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);
    } catch (error) {
      console.error('Error extracting learning objectives:', error);
      return [];
    }
  }

  /**
   * Assess difficulty level
   */
  private async assessDifficultyLevel(transcription: string): Promise<'beginner' | 'intermediate' | 'advanced'> {
    if (!transcription || transcription.length < 100) return 'beginner';

    const advancedKeywords = ['complex', 'advanced', 'sophisticated', 'intricate', 'specialized'];
    const intermediateKeywords = ['moderate', 'standard', 'typical', 'common', 'regular'];
    
    const content = transcription.toLowerCase();
    const advancedCount = advancedKeywords.filter(word => content.includes(word)).length;
    const intermediateCount = intermediateKeywords.filter(word => content.includes(word)).length;

    if (advancedCount > 2) return 'advanced';
    if (intermediateCount > 1 || transcription.length > 5000) return 'intermediate';
    return 'beginner';
  }

  /**
   * Extract chapters from content
   */
  private async extractChapters(transcription: string, keyFrames: any[]): Promise<any[]> {
    // Simple chapter extraction based on key frames and transcription patterns
    const chapters = [];
    const chapterInterval = Math.max(300, Math.floor(keyFrames.length / 5)); // At least 5 minutes apart

    for (let i = 0; i < keyFrames.length; i += chapterInterval) {
      const frame = keyFrames[i];
      const nextFrame = keyFrames[i + chapterInterval];
      
      chapters.push({
        title: `Chapter ${chapters.length + 1}`,
        startTime: frame.timestamp,
        endTime: nextFrame ? nextFrame.timestamp : keyFrames[keyFrames.length - 1]?.timestamp || frame.timestamp + 300,
        description: frame.description || '',
        keyTopics: []
      });
    }

    return chapters;
  }

  /**
   * Detect PHI/PII in content
   */
  private async detectPHI(content: string): Promise<boolean> {
    if (!content) return false;

    // Simple PHI detection patterns
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,11}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Dates
      /patient\s+\w+/i, // Patient names
      /mr\.|mrs\.|ms\.|dr\.\s+\w+/i // Titles with names
    ];

    return phiPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Log audit events
   */
  private async logAuditEvent(event: string, data: Record<string, any>): Promise<void> {
    const auditLog = {
      event,
      data,
      timestamp: new Date(),
      source: 'VideoProcessingManager'
    };

    try {
      await this.mongoAccessor.create('audit_logs', auditLog);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Get processing job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    return await this.mongoAccessor.findById('processing_jobs', jobId) as ProcessingJob;
  }

  /**
   * Get processed video content
   */
  async getVideoContent(contentId: string): Promise<VideoContent | null> {
    return await this.mongoAccessor.findById('contents', contentId) as VideoContent;
  }

  /**
   * Search video content
   */
  async searchVideos(
    query: string,
    userId: string,
    tenantId: string,
    filters?: any
  ): Promise<VideoContent[]> {
    const searchCriteria = {
      contentType: 'video',
      tenantId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { transcription: { $regex: query, $options: 'i' } },
        { tags: { $in: [query.toLowerCase()] } }
      ]
    };

    if (filters) {
      Object.assign(searchCriteria, filters);
    }

    return await this.mongoAccessor.find('contents', searchCriteria) as VideoContent[];
  }
}
