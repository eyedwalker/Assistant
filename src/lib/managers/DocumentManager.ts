/**
 * DocumentManager - VBD Manager Layer
 * 
 * Orchestrates document processing workflow and applies business rules
 * Handles volatile, domain-specific logic for eyecare professionals
 */

import { DocumentProcessingEngine, ProcessingResult, ProcessingOptions } from '../engines/DocumentProcessingEngine';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { S3Accessor } from '../accessors/S3Accessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';

export interface DocumentProcessingRequest {
  url?: string;
  content?: string;
  userId: string;
  accessLevel: 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';
  tenantId: string;
  metadata?: {
    source: string;
    title?: string;
    tags?: string[];
  };
}

export interface DocumentProcessingJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ProcessingResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentManager {
  constructor(
    private mongoAccessor: MongoDBAccessor,
    private s3Accessor: S3Accessor,
    private aiAccessor: AnthropicAccessor
  ) {}

  /**
   * Orchestrates the complete document processing workflow
   * Applies business rules specific to eyecare professionals
   */
  async processDocument(request: DocumentProcessingRequest): Promise<DocumentProcessingJob> {
    // Create processing job
    const job = await this.createProcessingJob(request);

    try {
      // Apply business rules for access control
      await this.validateAccess(request);

      // Apply business rules for content limits
      this.validateBusinessRules(request);

      // Step 1: Extract raw content
      const rawContent = await this.extractRawContent(request);
      await this.updateJobProgress(job.jobId, 25, 'Content extracted');

      // Step 2: Process content using engine (core algorithms)
      const processingOptions = this.buildProcessingOptions(request);
      const processedResult = DocumentProcessingEngine.extractContent(rawContent, processingOptions);
      
      if (!processedResult.success) {
        throw new Error(processedResult.error);
      }
      await this.updateJobProgress(job.jobId, 50, 'Content processed');

      // Step 3: Apply AI analysis (business rule: only for certain access levels)
      let aiAnalysis;
      if (this.shouldPerformAIAnalysis(request.accessLevel)) {
        aiAnalysis = await this.performAIAnalysis(processedResult.content!);
        await this.updateJobProgress(job.jobId, 75, 'AI analysis completed');
      }

      // Step 4: Store results with tenant isolation
      const documentId = await this.storeDocument({
        ...processedResult,
        aiAnalysis,
        userId: request.userId,
        tenantId: request.tenantId,
        accessLevel: request.accessLevel,
        metadata: request.metadata
      });

      // Step 5: Complete job
      const completedJob = await this.completeJob(job.jobId, {
        documentId,
        ...processedResult,
        aiAnalysis
      });

      return completedJob;

    } catch (error) {
      await this.failJob(job.jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Business rule: Validate user access permissions
   */
  private async validateAccess(request: DocumentProcessingRequest): Promise<void> {
    let user = await this.mongoAccessor.findUser(request.userId);
    
    // Auto-create demo users if they don't exist
    if (!user && request.userId.startsWith('demo-')) {
      const demoUser = {
        id: request.userId,
        name: `Demo User ${request.userId.split('-').pop()}`,
        email: `${request.userId}@demo.com`,
        role: 'user',
        tenantId: request.tenantId,
        accessLevel: request.accessLevel,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      try {
        await this.mongoAccessor.createUser(demoUser);
        user = demoUser;
        console.log(`Auto-created demo user: ${request.userId}`);
      } catch (error) {
        console.error('Failed to create demo user:', error);
        // Try to find the user again in case it was created by another request
        user = await this.mongoAccessor.findUser(request.userId);
      }
    }
    
    if (!user) {
      throw new Error('User not found and could not be created');
    }

    if (!this.hasProcessingPermission(user.role, request.accessLevel)) {
      throw new Error('Insufficient permissions for document processing');
    }

    // Business rule: Check tenant-specific limits
    const tenantLimits = await this.mongoAccessor.getTenantLimits(request.tenantId);
    const currentUsage = await this.mongoAccessor.getTenantUsage(request.tenantId);

    if (currentUsage.documentsProcessed >= tenantLimits.maxDocuments) {
      throw new Error('Tenant document processing limit exceeded');
    }
  }

  /**
   * Business rule: Validate content and processing rules
   */
  private validateBusinessRules(request: DocumentProcessingRequest): void {
    // Business rule: Content size limits based on access level
    const maxSizes = {
      PUBLIC: 100000,    // 100KB
      ACCOUNT: 500000,   // 500KB
      COMPANY: 2000000,  // 2MB
      OFFICE: 10000000   // 10MB
    };

    const maxSize = maxSizes[request.accessLevel];
    const contentSize = request.content?.length || 0;

    if (contentSize > maxSize) {
      throw new Error(`Content size exceeds limit for ${request.accessLevel} access level`);
    }

    // Business rule: URL validation for eyecare domains
    if (request.url && !this.isAllowedDomain(request.url)) {
      throw new Error('URL domain not allowed for processing');
    }
  }

  /**
   * Business rule: Determine if AI analysis should be performed
   */
  private shouldPerformAIAnalysis(accessLevel: string): boolean {
    // Business rule: AI analysis only for COMPANY and OFFICE levels
    return ['COMPANY', 'OFFICE'].includes(accessLevel);
  }

  /**
   * Business rule: Check if domain is allowed for eyecare professionals
   */
  private isAllowedDomain(url: string): boolean {
    const allowedDomains = [
      'aao.org',
      'reviewofoptometry.com',
      'optometrytimes.com',
      'eyeworld.org',
      'healio.com',
      'pubmed.ncbi.nlm.nih.gov',
      // Eyefinity/VSP domains for Encompass training content
      'help.eyefinity.com',
      'eyefinity.com',
      'vsp.com',
      'encompasseyecare.com',
      // Additional educational domains for training content
      'wikipedia.org',
      'youtube.com',
      'youtu.be',
      'vimeo.com'
    ];

    try {
      const domain = new URL(url).hostname.toLowerCase();
      return allowedDomains.some(allowed => domain.includes(allowed));
    } catch {
      return false;
    }
  }

  /**
   * Extract raw content based on source type
   */
  private async extractRawContent(request: DocumentProcessingRequest): Promise<string> {
    if (request.content) {
      return request.content;
    }

    if (request.url) {
      // Use existing robust content extractor
      const contentExtractor = (await import('../services/robust-content-extractor')).default;
      const result = await contentExtractor.extractContent(request.url);
      
      if (!result.success) {
        throw new Error(`Failed to extract content from URL: ${result.error}`);
      }
      
      return result.content || '';
    }

    throw new Error('No content or URL provided');
  }

  /**
   * Build processing options based on business rules
   */
  private buildProcessingOptions(request: DocumentProcessingRequest): ProcessingOptions {
    const maxLengths = {
      PUBLIC: 5000,
      ACCOUNT: 20000,
      COMPANY: 50000,
      OFFICE: 100000
    };

    return {
      maxLength: maxLengths[request.accessLevel],
      includeMetadata: true,
      timeout: 30000,
      retryAttempts: 3
    };
  }

  /**
   * Perform AI analysis using accessor
   */
  private async performAIAnalysis(content: string) {
    const chunks = DocumentProcessingEngine.chunkContent(content);
    const analyses = await Promise.all(
      chunks.map(chunk => this.aiAccessor.analyzeContent(chunk))
    );

    return {
      summary: analyses.map(a => a.summary).join(' '),
      keywords: [...new Set(analyses.flatMap(a => a.keywords))],
      sentiment: this.aggregateSentiment(analyses),
      phiDetected: analyses.some(a => a.phiDetected),
      confidence: analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length
    };
  }

  /**
   * Business rule: Aggregate sentiment analysis
   */
  private aggregateSentiment(analyses: any[]): string {
    const sentiments = analyses.map(a => a.sentiment);
    const counts = sentiments.reduce((acc, sentiment) => {
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b)[0];
  }

  /**
   * Store processed document with tenant isolation
   */
  private async storeDocument(data: any): Promise<string> {
    // Store content in S3 with tenant prefix
    const s3Key = `${data.tenantId}/documents/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.s3Accessor.uploadContent(s3Key, data.content);

    // Store metadata in MongoDB with tenant isolation
    const document = {
      tenantId: data.tenantId,
      userId: data.userId,
      accessLevel: data.accessLevel,
      s3Key,
      metadata: data.metadata,
      aiAnalysis: data.aiAnalysis,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.mongoAccessor.createDocument(document);
  }

  /**
   * Create processing job
   */
  private async createProcessingJob(request: DocumentProcessingRequest): Promise<DocumentProcessingJob> {
    const job: DocumentProcessingJob = {
      jobId: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.mongoAccessor.createProcessingJob(job);
    return job;
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    await this.mongoAccessor.updateProcessingJob(jobId, {
      progress,
      status: 'processing',
      updatedAt: new Date(),
      ...(message && { statusMessage: message })
    });
  }

  /**
   * Complete processing job
   */
  private async completeJob(jobId: string, result: any): Promise<DocumentProcessingJob> {
    const updatedJob = await this.mongoAccessor.updateProcessingJob(jobId, {
      status: 'completed',
      progress: 100,
      result,
      updatedAt: new Date()
    });

    return updatedJob;
  }

  /**
   * Fail processing job
   */
  private async failJob(jobId: string, error: string): Promise<void> {
    await this.mongoAccessor.updateProcessingJob(jobId, {
      status: 'failed',
      error,
      updatedAt: new Date()
    });
  }

  /**
   * Business rule: Check processing permissions
   */
  private hasProcessingPermission(userRole: string, accessLevel: string): boolean {
    const permissions = {
      admin: ['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE'],
      manager: ['PUBLIC', 'ACCOUNT', 'COMPANY'],
      user: ['PUBLIC', 'ACCOUNT'],
      viewer: ['PUBLIC']
    };

    return permissions[userRole as keyof typeof permissions]?.includes(accessLevel) || false;
  }
}
