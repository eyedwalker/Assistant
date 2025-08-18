/**
 * Web Crawling Manager - VBD Manager Layer
 * 
 * Orchestrates comprehensive web content processing including:
 * - Website crawling with depth control
 * - Multi-page content extraction
 * - Media resource discovery and processing
 * - Sitemap generation and analysis
 * - Content relationship mapping
 */

import { WebContent, ProcessingConfig, ProcessingJob, ProcessingStatus, ContentSource, CrawledPage, LinkedResource } from '@/lib/types/content';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { WebCrawlingEngine, AuthConfig } from '@/lib/engines/WebCrawlingEngine';
import * as crypto from 'crypto';

export class WebCrawlingManager {
  private crawlingEngine: WebCrawlingEngine;

  constructor(
    private mongoAccessor: MongoDBAccessor,
    private s3Accessor: S3Accessor,
    private anthropicAccessor: AnthropicAccessor
  ) {
    this.crawlingEngine = new WebCrawlingEngine();
  }

  /**
   * Process web content with comprehensive crawling
   */
  async processWebContent(
    source: ContentSource,
    config: ProcessingConfig,
    userId: string,
    tenantId: string
  ): Promise<{ jobId: string; contentId: string }> {
    // Validate access and create processing job
    await this.validateWebAccess(userId, tenantId, source.source);
    
    const contentId = this.generateContentId();
    const jobId = this.generateJobId();

    // Create initial content record
    const webContent: Partial<WebContent> = {
      id: contentId,
      contentType: 'web',
      source,
      title: await this.extractInitialTitle(source.source),
      processingStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      tenantId,
      accessLevel: 'ACCOUNT'
    };

    // Save initial content record
    await this.mongoAccessor.create('contents', webContent);

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
    this.processWebContentAsync(contentId, jobId, source, config).catch(error => {
      console.error(`Web crawling failed for job ${jobId}:`, error);
      this.handleProcessingError(jobId, error);
    });

    return { jobId, contentId };
  }

  /**
   * Async web content processing workflow
   */
  private async processWebContentAsync(
    contentId: string,
    jobId: string,
    source: ContentSource,
    config: ProcessingConfig
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update status to processing
      await this.updateProcessingStatus(jobId, 'processing', 5);

      // Step 1: Initialize crawling session with authentication if provided
      const crawlSession = await this.crawlingEngine.initializeCrawlSession(source.source, {
        maxDepth: config.crawlDepth || 3,
        maxPages: config.maxPages || 100,
        allowedDomains: config.allowedDomains || [],
        respectRobotsTxt: true,
        delayBetweenRequests: 1000, // 1 second delay
        userAgent: 'AI-Assistant-Platform/1.0',
        auth: config.auth
      });

      await this.updateProcessingStatus(jobId, 'processing', 10);

      // Step 2: Crawl website pages
      await this.updateProcessingStatus(jobId, 'extracting', 15);
      const crawledPages = await this.crawlingEngine.crawlWebsite(crawlSession);
      await this.updateProcessingStatus(jobId, 'processing', 40);

      // Step 3: Extract and process linked resources
      const linkedResources: LinkedResource[] = [];
      for (const page of crawledPages) {
        const pageResources = await this.crawlingEngine.extractLinkedResources(page.url, page.content);
        linkedResources.push(...pageResources);
      }
      await this.updateProcessingStatus(jobId, 'processing', 55);

      // Step 4: Process media resources
      const processedResources = await this.processLinkedResources(linkedResources, contentId, config);
      await this.updateProcessingStatus(jobId, 'processing', 70);

      // Step 5: Extract comprehensive metadata
      const webMetadata = await this.crawlingEngine.extractWebMetadata(source.source, crawledPages, config.auth);
      await this.updateProcessingStatus(jobId, 'analyzing', 75);

      // Step 6: Generate consolidated content
      const consolidatedText = this.consolidatePageContent(crawledPages);
      
      // Step 7: AI-powered content analysis
      let aiAnalysis = '';
      let categories: string[] = [];
      let tags: string[] = [];
      let learningObjectives: string[] = [];
      
      if (consolidatedText.length > 100) {
        const response = await this.anthropicAccessor.generateChatResponse(
          `Analyze this website content and provide a comprehensive summary focusing on educational value, key topics, and relevance to eyecare/medical training:\n\n${consolidatedText.substring(0, 4000)}`
        );
        aiAnalysis = response.message;

        categories = await this.extractCategories(consolidatedText);
        tags = await this.extractTags(consolidatedText);
        learningObjectives = await this.extractLearningObjectives(consolidatedText);
      }

      await this.updateProcessingStatus(jobId, 'processing', 85);

      // Step 8: Generate embeddings
      let embeddings: number[] = [];
      if (config.generateEmbeddings && consolidatedText.trim()) {
        embeddings = await this.anthropicAccessor.generateEmbeddings(consolidatedText);
      }

      // Step 9: Store content and resources in S3
      await this.updateProcessingStatus(jobId, 'processing', 90);
      
      // Store main content
      const contentKey = `web/${contentId}/content.json`;
      await this.s3Accessor.uploadContent(JSON.stringify({
        pages: crawledPages,
        metadata: webMetadata,
        analysis: aiAnalysis
      }), contentKey);

      // Store processed resources
      for (const resource of processedResources) {
        if (resource.processed && resource.content) {
          const resourceKey = `web/${contentId}/resources/${resource.id}.json`;
          await this.s3Accessor.uploadContent(JSON.stringify(resource), resourceKey);
        }
      }

      // Step 10: Analyze content for PHI/PII
      let phiDetected = false;
      if (config.phiDetection) {
        phiDetected = await this.detectPHI(consolidatedText);
      }

      // Step 11: Generate sitemap and navigation structure
      const sitemap = this.generateSitemap(crawledPages);
      
      // Step 12: Create final web content record
      const finalContent: WebContent = {
        id: contentId,
        contentType: 'web',
        source,
        title: webMetadata.title || this.generateTitleFromUrl(source.source),
        description: webMetadata.description || aiAnalysis.substring(0, 500),
        extractedText: consolidatedText,
        embeddings,
        processingStatus: 'completed',
        processingTime: Date.now() - startTime,
        fileSize: this.calculateTotalSize(crawledPages),
        quality: config.quality,
        language: webMetadata.language || 'en',
        confidence: this.calculateConfidence(crawledPages, linkedResources),
        tags,
        categories,
        learningObjectives,
        difficultyLevel: await this.assessDifficultyLevel(consolidatedText),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: (await this.mongoAccessor.findById('contents', contentId) as any).userId,
        tenantId: (await this.mongoAccessor.findById('contents', contentId) as any).tenantId,
        accessLevel: 'ACCOUNT',
        webMetadata,
        crawledPages,
        sitemap,
        linkedResources: processedResources
      };

      // Update content record
      await this.mongoAccessor.update('contents', contentId, finalContent);

      // Complete processing job
      await this.updateProcessingStatus(jobId, 'completed', 100);

      // Log audit trail
      if (config.auditLogging) {
        await this.logAuditEvent('web_content_processed', {
          contentId,
          jobId,
          userId: finalContent.userId,
          tenantId: finalContent.tenantId,
          pagesProcessed: crawledPages.length,
          resourcesProcessed: processedResources.length,
          processingTime: Date.now() - startTime,
          phiDetected
        });
      }

      // Cleanup temporary files
      await this.crawlingEngine.cleanup(crawlSession.id);

    } catch (error) {
      console.error(`Web crawling error for job ${jobId}:`, error);
      await this.handleProcessingError(jobId, error);
      throw error;
    }
  }

  /**
   * Process linked resources (videos, documents, images)
   */
  private async processLinkedResources(
    resources: LinkedResource[],
    contentId: string,
    config: ProcessingConfig
  ): Promise<LinkedResource[]> {
    const processedResources: LinkedResource[] = [];

    for (const resource of resources.slice(0, 50)) { // Limit to 50 resources
      try {
        const processedResource = { ...resource };

        switch (resource.type) {
          case 'video':
            if (config.enableTranscription) {
              // Process video resource (simplified)
              processedResource.metadata = await this.crawlingEngine.extractVideoMetadata(resource.url);
              processedResource.processed = true;
            }
            break;

          case 'document':
            // Process document resource
            const docContent = await this.crawlingEngine.extractDocumentContent(resource.url, config.auth);
            if (docContent) {
              processedResource.content = docContent;
              processedResource.processed = true;
            }
            break;

          case 'image':
            if (config.enableOCR) {
              // Extract text from images
              const imageText = await this.crawlingEngine.extractTextFromImage(resource.url);
              if (imageText) {
                processedResource.content = imageText;
                processedResource.processed = true;
              }
            }
            break;

          default:
            processedResource.processed = false;
        }

        processedResources.push(processedResource);
      } catch (error) {
        console.error(`Failed to process resource ${resource.url}:`, error);
        processedResources.push({ ...resource, processed: false });
      }
    }

    return processedResources;
  }

  /**
   * Consolidate content from all crawled pages
   */
  private consolidatePageContent(pages: CrawledPage[]): string {
    return pages
      .filter(page => page.status === 'success')
      .map(page => `${page.title}\n${page.content}`)
      .join('\n\n')
      .substring(0, 50000); // Limit to 50k characters
  }

  /**
   * Generate sitemap from crawled pages
   */
  private generateSitemap(pages: CrawledPage[]): string[] {
    return pages
      .filter(page => page.status === 'success')
      .sort((a, b) => a.depth - b.depth)
      .map(page => page.url);
  }

  /**
   * Calculate total size of crawled content
   */
  private calculateTotalSize(pages: CrawledPage[]): number {
    return pages.reduce((total, page) => total + page.size, 0);
  }

  /**
   * Calculate processing confidence score
   */
  private calculateConfidence(pages: CrawledPage[], resources: LinkedResource[]): number {
    const successfulPages = pages.filter(p => p.status === 'success').length;
    const totalPages = pages.length;
    const processedResources = resources.filter(r => r.processed).length;
    const totalResources = resources.length;

    const pageSuccess = totalPages > 0 ? successfulPages / totalPages : 0;
    const resourceSuccess = totalResources > 0 ? processedResources / totalResources : 1;

    return Math.round((pageSuccess * 0.7 + resourceSuccess * 0.3) * 100) / 100;
  }

  /**
   * Validate user access for web crawling
   */
  private async validateWebAccess(userId: string, tenantId: string, url: string): Promise<void> {
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
        console.log(`Demo user ${userId} already exists or creation failed:`, error);
      }
      return;
    }

    // For real users, validate access
    const user = await this.mongoAccessor.findById('users', userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Validate URL domain restrictions
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Check if domain is in allowed list (if configured)
      const allowedDomains = process.env.ALLOWED_CRAWL_DOMAINS?.split(',') || [];
      if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
        throw new Error(`Domain not allowed for crawling: ${domain}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Domain not allowed')) {
        throw error;
      }
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  /**
   * Extract initial title from URL
   */
  private async extractInitialTitle(url: string, authConfig?: AuthConfig): Promise<string> {
    try {
      return await this.crawlingEngine.extractPageTitle(url, authConfig);
    } catch (error) {
      return this.generateTitleFromUrl(url);
    }
  }

  /**
   * Generate title from URL
   */
  private generateTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return `Web Content - ${new Date().toISOString()}`;
    }
  }

  /**
   * Extract categories from content
   */
  private async extractCategories(content: string): Promise<string[]> {
    const categories = [
      'clinical-procedures', 'patient-care', 'optical-calculations',
      'equipment-training', 'diagnosis', 'treatment', 'education',
      'compliance', 'safety', 'technology', 'research', 'documentation'
    ];

    const lowerContent = content.toLowerCase();
    return categories.filter(category => {
      const keywords = category.split('-');
      return keywords.some(keyword => lowerContent.includes(keyword));
    });
  }

  /**
   * Extract tags from content
   */
  private async extractTags(content: string): Promise<string[]> {
    if (!content.trim()) return [];

    try {
      const prompt = `Extract 8-12 relevant tags from this web content. Focus on medical, eyecare, educational, and technical topics. Return as comma-separated list:\n\n${content.substring(0, 3000)}`;
      const response = await this.anthropicAccessor.generateChatResponse(prompt);
      
      return response.message.split(',').map((tag: string) => tag.trim().toLowerCase()).filter(Boolean);
    } catch (error) {
      console.error('Error extracting tags:', error);
      return [];
    }
  }

  /**
   * Extract learning objectives
   */
  private async extractLearningObjectives(content: string): Promise<string[]> {
    if (!content || content.length < 200) return [];

    try {
      const prompt = `Extract 3-6 learning objectives from this web content. Focus on what users will learn or understand. Format as bullet points:\n\n${content.substring(0, 3000)}`;
      const response = await this.anthropicAccessor.generateChatResponse(prompt);
      
      return response.message.split('\n')
        .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map((line: string) => line.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);
    } catch (error) {
      console.error('Error extracting learning objectives:', error);
      return [];
    }
  }

  /**
   * Assess difficulty level
   */
  private async assessDifficultyLevel(content: string): Promise<'beginner' | 'intermediate' | 'advanced'> {
    if (!content || content.length < 200) return 'beginner';

    const advancedKeywords = ['complex', 'advanced', 'sophisticated', 'specialized', 'technical', 'research'];
    const intermediateKeywords = ['procedure', 'protocol', 'standard', 'clinical', 'professional'];
    
    const lowerContent = content.toLowerCase();
    const advancedCount = advancedKeywords.filter(word => lowerContent.includes(word)).length;
    const intermediateCount = intermediateKeywords.filter(word => lowerContent.includes(word)).length;

    if (advancedCount > 3) return 'advanced';
    if (intermediateCount > 2 || content.length > 10000) return 'intermediate';
    return 'beginner';
  }

  /**
   * Detect PHI/PII in content
   */
  private async detectPHI(content: string): Promise<boolean> {
    if (!content) return false;

    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,11}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /patient\s+\w+/i, // Patient names
      /mr\.|mrs\.|ms\.|dr\.\s+\w+/i // Titles with names
    ];

    return phiPatterns.some(pattern => pattern.test(content));
  }

  // Utility methods (same as VideoProcessingManager)
  private generateContentId(): string {
    return `web_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  private async updateProcessingStatus(jobId: string, status: ProcessingStatus, progress: number): Promise<void> {
    await this.mongoAccessor.update('processing_jobs', jobId, {
      status,
      progress,
      updatedAt: new Date()
    });
  }

  private async handleProcessingError(jobId: string, error: any): Promise<void> {
    const processingError = {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'Unknown processing error',
      timestamp: new Date(),
      severity: 'high' as const,
      context: { stack: error.stack, jobId }
    };

    await this.mongoAccessor.update('processing_jobs', jobId, {
      status: 'failed' as ProcessingStatus,
      errors: [processingError],
      endTime: new Date()
    });
  }

  private async logAuditEvent(event: string, data: Record<string, any>): Promise<void> {
    const auditLog = {
      event,
      data,
      timestamp: new Date(),
      source: 'WebCrawlingManager'
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
   * Get processed web content
   */
  async getWebContent(contentId: string): Promise<WebContent | null> {
    return await this.mongoAccessor.findById('contents', contentId) as WebContent;
  }

  /**
   * Search web content
   */
  async searchWebContent(
    query: string,
    userId: string,
    tenantId: string,
    filters?: any
  ): Promise<WebContent[]> {
    const searchCriteria = {
      contentType: 'web',
      tenantId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { extractedText: { $regex: query, $options: 'i' } },
        { tags: { $in: [query.toLowerCase()] } }
      ]
    };

    if (filters) {
      Object.assign(searchCriteria, filters);
    }

    return await this.mongoAccessor.find('contents', searchCriteria) as WebContent[];
  }
}
