/**
 * Unified Content Manager - VBD Manager Layer
 * 
 * Central orchestrator for all content types:
 * - Documents, videos, audio, web content, images
 * - Intelligent routing to specialized processors
 * - Unified job tracking and status management
 * - Cross-modal content relationships
 * - Comprehensive search and retrieval
 */

import { 
  ContentType, 
  ContentSource, 
  ProcessingConfig, 
  ProcessingJob, 
  ProcessedContent,
  SearchQuery,
  SearchResult,
  SearchFilters
} from '@/lib/types/content';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { ContentDetectionEngine } from '@/lib/engines/ContentDetectionEngine';
import { DocumentManager } from './DocumentManager';
import { VideoProcessingManager } from './VideoProcessingManager';
import { WebCrawlingManager } from './WebCrawlingManager';
import * as crypto from 'crypto';

export class UnifiedContentManager {
  private contentDetectionEngine: ContentDetectionEngine;
  private documentManager: DocumentManager;
  private videoProcessingManager: VideoProcessingManager;
  private webCrawlingManager: WebCrawlingManager;

  constructor(
    private mongoAccessor: MongoDBAccessor,
    private s3Accessor: S3Accessor,
    private anthropicAccessor: AnthropicAccessor
  ) {
    this.contentDetectionEngine = new ContentDetectionEngine();
    this.documentManager = new DocumentManager(mongoAccessor, s3Accessor, anthropicAccessor);
    this.videoProcessingManager = new VideoProcessingManager(mongoAccessor, s3Accessor, anthropicAccessor);
    this.webCrawlingManager = new WebCrawlingManager(mongoAccessor, s3Accessor, anthropicAccessor);
  }

  /**
   * Process any type of content with intelligent routing
   */
  async processContent(
    source: ContentSource,
    userId: string,
    tenantId: string,
    userPreferences?: Partial<ProcessingConfig>
  ): Promise<{ jobId: string; contentId: string; contentType: ContentType; estimatedTime: number }> {
    try {
      // Step 1: Detect content type
      const contentType = await this.contentDetectionEngine.detectContentType(source);
      
      // Step 2: Generate processing configuration
      const config = this.contentDetectionEngine.generateProcessingConfig(contentType, userPreferences);
      
      // Step 3: Validate content and configuration
      const validation = this.contentDetectionEngine.validateContent(source, config);
      if (!validation.valid) {
        throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 4: Estimate processing requirements
      const estimation = this.contentDetectionEngine.estimateProcessing(contentType, config, source.metadata);

      // Step 5: Route to appropriate processor
      let result: { jobId: string; contentId: string };

      switch (contentType) {
        case 'video':
          result = await this.videoProcessingManager.processVideo(source, config, userId, tenantId);
          break;

        case 'web':
          result = await this.webCrawlingManager.processWebContent(source, config, userId, tenantId);
          break;

        case 'document':
        case 'presentation':
        case 'spreadsheet':
        case 'image':
        default:
          // Use existing document manager for these types
          result = await this.processWithDocumentManager(source, config, userId, tenantId);
          break;
      }

      // Step 6: Log unified processing event
      await this.logUnifiedProcessingEvent('content_processing_started', {
        contentId: result.contentId,
        jobId: result.jobId,
        contentType,
        userId,
        tenantId,
        source: source.source,
        estimatedTime: estimation.estimatedTime,
        estimatedCost: estimation.estimatedCost
      });

      return {
        ...result,
        contentType,
        estimatedTime: estimation.estimatedTime
      };

    } catch (error) {
      console.error('Unified content processing failed:', error);
      throw new Error(`Content processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process batch content (multiple items)
   */
  async processBatchContent(
    sources: ContentSource[],
    userId: string,
    tenantId: string,
    userPreferences?: Partial<ProcessingConfig>
  ): Promise<Array<{ jobId: string; contentId: string; contentType: ContentType; source: string }>> {
    const results = [];
    const batchId = this.generateBatchId();

    // Log batch processing start
    await this.logUnifiedProcessingEvent('batch_processing_started', {
      batchId,
      itemCount: sources.length,
      userId,
      tenantId
    });

    for (const source of sources) {
      try {
        const result = await this.processContent(source, userId, tenantId, userPreferences);
        results.push({
          ...result,
          source: source.source
        });

        // Add small delay between batch items to prevent overwhelming the system
        await this.delay(500);
      } catch (error) {
        console.error(`Failed to process batch item ${source.source}:`, error);
        results.push({
          jobId: '',
          contentId: '',
          contentType: 'document' as ContentType,
          source: source.source,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Log batch processing completion
    await this.logUnifiedProcessingEvent('batch_processing_completed', {
      batchId,
      itemCount: sources.length,
      successCount: results.filter(r => r.jobId).length,
      failureCount: results.filter(r => !r.jobId).length,
      userId,
      tenantId
    });

    return results;
  }

  /**
   * Get processing job status across all content types
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    return await this.mongoAccessor.findById('processing_jobs', jobId) as ProcessingJob;
  }

  /**
   * Get processed content regardless of type
   */
  async getContent(contentId: string): Promise<ProcessedContent | null> {
    return await this.mongoAccessor.findById('contents', contentId) as ProcessedContent;
  }

  /**
   * Unified search across all content types
   */
  async searchContent(
    query: SearchQuery,
    userId: string,
    tenantId: string
  ): Promise<SearchResult[]> {
    try {
      // Build search criteria
      const searchCriteria: any = {
        tenantId,
        $or: [
          { title: { $regex: query.query, $options: 'i' } },
          { description: { $regex: query.query, $options: 'i' } },
          { extractedText: { $regex: query.query, $options: 'i' } },
          { transcription: { $regex: query.query, $options: 'i' } },
          { tags: { $in: [query.query.toLowerCase()] } }
        ]
      };

      // Apply content type filters
      if (query.contentTypes && query.contentTypes.length > 0) {
        searchCriteria.contentType = { $in: query.contentTypes };
      }

      // Apply additional filters
      if (query.filters) {
        this.applySearchFilters(searchCriteria, query.filters);
      }

      // Execute search
      const contents = await this.mongoAccessor.find('contents', searchCriteria, {
        limit: query.limit || 20,
        skip: query.offset || 0,
        sort: { updatedAt: -1 }
      }) as ProcessedContent[];

      // Convert to search results with scoring
      const searchResults: SearchResult[] = contents.map(content => ({
        content,
        score: this.calculateRelevanceScore(content, query.query),
        highlights: this.extractHighlights(content, query.query),
        relatedContent: [] // Could be populated with related content
      }));

      // Sort by relevance score
      searchResults.sort((a, b) => b.score - a.score);

      return searchResults;

    } catch (error) {
      console.error('Unified search failed:', error);
      return [];
    }
  }

  /**
   * Get content analytics and insights
   */
  async getContentAnalytics(
    userId: string,
    tenantId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalContent: number;
    contentByType: Record<ContentType, number>;
    processingStats: {
      totalJobs: number;
      completedJobs: number;
      failedJobs: number;
      averageProcessingTime: number;
    };
    topCategories: Array<{ category: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
    recentActivity: ProcessedContent[];
  }> {
    try {
      const baseQuery: any = { tenantId };
      
      if (timeRange) {
        baseQuery.createdAt = {
          $gte: timeRange.start,
          $lte: timeRange.end
        };
      }

      // Get total content count
      const totalContent = await this.mongoAccessor.count('contents', baseQuery);

      // Get content by type
      const contentByTypeResults = await this.mongoAccessor.aggregate('contents', [
        { $match: baseQuery },
        { $group: { _id: '$contentType', count: { $sum: 1 } } }
      ]);

      const contentByType = {
        'documentation': 0,
        'training': 0,
        'reference': 0,
        'policy': 0
      } as unknown as Record<ContentType, number>;
      contentByTypeResults.forEach((result: any) => {
        contentByType[result._id as ContentType] = result.count;
      });

      // Get processing stats
      const processingJobs = await this.mongoAccessor.find('processing_jobs', baseQuery) as ProcessingJob[];
      const completedJobs = processingJobs.filter(job => job.status === 'completed');
      const failedJobs = processingJobs.filter(job => job.status === 'failed');
      const averageProcessingTime = completedJobs.length > 0 
        ? completedJobs.reduce((sum, job) => sum + (job.metrics?.processingTime || 0), 0) / completedJobs.length
        : 0;

      // Get top categories
      const categoryResults = await this.mongoAccessor.aggregate('contents', [
        { $match: baseQuery },
        { $unwind: '$categories' },
        { $group: { _id: '$categories', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const topCategories = categoryResults.map((result: any) => ({
        category: result._id,
        count: result.count
      }));

      // Get top tags
      const tagResults = await this.mongoAccessor.aggregate('contents', [
        { $match: baseQuery },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const topTags = tagResults.map((result: any) => ({
        tag: result._id,
        count: result.count
      }));

      // Get recent activity
      const recentActivity = await this.mongoAccessor.find('contents', baseQuery, {
        sort: { updatedAt: -1 },
        limit: 10
      }) as ProcessedContent[];

      return {
        totalContent,
        contentByType,
        processingStats: {
          totalJobs: processingJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          averageProcessingTime
        },
        topCategories,
        topTags,
        recentActivity
      };

    } catch (error) {
      console.error('Failed to get content statistics:', error);
      return {
        totalContent: 0,
        contentByType: {
          'documentation': 0,
          'training': 0,
          'reference': 0,
          'policy': 0
        } as unknown as Record<ContentType, number>,
        processingStats: {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          averageProcessingTime: 0
        },
        topCategories: [],
        topTags: [],
        recentActivity: []
      };
    }
  }

  /**
   * Get content recommendations based on user activity
   */
  async getContentRecommendations(
    userId: string,
    tenantId: string,
    limit: number = 10
  ): Promise<ProcessedContent[]> {
    try {
      // Simple recommendation based on user's recent content and categories
      const userContent = await this.mongoAccessor.find('contents', {
        userId,
        tenantId,
        processingStatus: 'completed'
      }, {
        sort: { updatedAt: -1 },
        limit: 5
      }) as ProcessedContent[];

      if (userContent.length === 0) {
        // Return popular content if no user history
        return await this.mongoAccessor.find('contents', {
          tenantId,
          processingStatus: 'completed'
        }, {
          sort: { updatedAt: -1 },
          limit
        }) as ProcessedContent[];
      }

      // Extract user's preferred categories and tags
      const userCategories = [...new Set(userContent.flatMap(c => c.categories || []))];
      const userTags = [...new Set(userContent.flatMap(c => c.tags || []))];

      // Find similar content
      const recommendations = await this.mongoAccessor.find('contents', {
        tenantId,
        userId: { $ne: userId }, // Exclude user's own content
        processingStatus: 'completed',
        $or: [
          { categories: { $in: userCategories } },
          { tags: { $in: userTags } }
        ]
      }, {
        sort: { updatedAt: -1 },
        limit
      }) as ProcessedContent[];

      return recommendations;

    } catch (error) {
      console.error('Failed to cleanup old content:', error);
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processWithDocumentManager(
    source: ContentSource,
    config: ProcessingConfig,
    userId: string,
    tenantId: string
  ): Promise<{ jobId: string; contentId: string }> {
    // For now, use the existing document processing logic
    // This would be enhanced to handle different document types
    if (source.type === 'url') {
      // Use document processing for URL content
      const request = {
        url: source.source,
        userId: userId,
        uploadedBy: userId,
        tenantId: tenantId,
        accessLevel: 'ACCOUNT' as const,
        processingOptions: config
      };
      const result = await this.documentManager.processDocument(request);
      return { jobId: result.jobId, contentId: result.jobId };
    } else {
      throw new Error('File upload processing not implemented yet');
    }
  }

  private applySearchFilters(criteria: any, filters: SearchFilters): void {
    if (filters.dateRange) {
      criteria.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    if (filters.duration) {
      const durationFilter: any = {};
      if (filters.duration.min !== undefined) durationFilter.$gte = filters.duration.min;
      if (filters.duration.max !== undefined) durationFilter.$lte = filters.duration.max;
      if (Object.keys(durationFilter).length > 0) {
        criteria.duration = durationFilter;
      }
    }

    if (filters.quality && filters.quality.length > 0) {
      criteria.quality = { $in: filters.quality };
    }

    if (filters.categories && filters.categories.length > 0) {
      criteria.categories = { $in: filters.categories };
    }

    if (filters.tags && filters.tags.length > 0) {
      criteria.tags = { $in: filters.tags };
    }

    if (filters.difficultyLevel && filters.difficultyLevel.length > 0) {
      criteria.difficultyLevel = { $in: filters.difficultyLevel };
    }

    if (filters.language && filters.language.length > 0) {
      criteria.language = { $in: filters.language };
    }

    if (filters.accessLevel && filters.accessLevel.length > 0) {
      criteria.accessLevel = { $in: filters.accessLevel };
    }
  }

  private calculateRelevanceScore(content: ProcessedContent, query: string): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    // Title match (highest weight)
    if (content.title?.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // Description match
    if (content.description?.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    // Content match
    if (content.extractedText?.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }

    // Transcription match (for videos/audio)
    if (content.transcription?.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }

    // Tag match
    if (content.tags?.some(tag => tag.includes(lowerQuery))) {
      score += 2;
    }

    // Category match
    if (content.categories?.some(cat => cat.includes(lowerQuery))) {
      score += 2;
    }

    // Boost recent content
    const daysSinceUpdate = (Date.now() - new Date(content.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score += 1;

    return score;
  }

  private extractHighlights(content: ProcessedContent, query: string): any[] {
    const highlights = [];
    const lowerQuery = query.toLowerCase();

    // Extract highlights from different fields
    const fields = [
      { field: 'title', text: content.title },
      { field: 'description', text: content.description },
      { field: 'extractedText', text: content.extractedText },
      { field: 'transcription', text: content.transcription }
    ];

    for (const { field, text } of fields) {
      if (text && text.toLowerCase().includes(lowerQuery)) {
        const index = text.toLowerCase().indexOf(lowerQuery);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 50);
        
        highlights.push({
          field,
          text: text.substring(start, end),
          startOffset: start,
          endOffset: end
        });
      }
    }

    return highlights;
  }

  private async getContentS3Keys(contentId: string, contentType: ContentType): Promise<string[]> {
    // Generate S3 keys based on content type
    const baseKey = `${contentType}/${contentId}`;
    const keys = [baseKey];

    // Add type-specific keys
    switch (contentType) {
      case 'video':
        keys.push(`${baseKey}/frames/`);
        break;
      case 'web':
        keys.push(`${baseKey}/content.json`, `${baseKey}/resources/`);
        break;
    }

    return keys;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async logUnifiedProcessingEvent(event: string, data: Record<string, any>): Promise<void> {
    const auditLog = {
      event,
      data,
      timestamp: new Date(),
      source: 'UnifiedContentManager'
    };

    try {
      await this.mongoAccessor.create('audit_logs', auditLog);
    } catch (error) {
      console.error('Failed to log unified processing event:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
