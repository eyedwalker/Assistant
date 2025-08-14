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
      console.log('🔄 Step 1: Extracting raw content...');
      const rawContent = await this.extractRawContent(request);
      console.log('📄 Raw content extracted:', { 
        length: rawContent?.length || 0, 
        preview: rawContent?.substring(0, 200) || 'NO CONTENT'
      });
      await this.updateJobProgress(job.jobId, 25, 'Content extracted');

      // Step 2: Process content using engine (core algorithms)
      console.log('🔄 Step 2: Processing content with engine...');
      const processingOptions = this.buildProcessingOptions(request);
      const processedResult = DocumentProcessingEngine.extractContent(rawContent, processingOptions);
      
      console.log('📊 Processing result:', { 
        success: processedResult.success, 
        contentLength: processedResult.content?.length || 0,
        error: processedResult.error,
        hasContent: !!processedResult.content
      });
      
      if (!processedResult.success) {
        console.error('❌ Processing failed:', processedResult.error);
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

      // Step 5: Store content for RAG retrieval (CRITICAL MISSING STEP)
      if (processedResult.content) {
        console.log('🔄 Storing content for RAG retrieval...');
        await this.storeContentForRAG({
          documentId,
          content: processedResult.content,
          title: processedResult.metadata?.title || request.metadata?.title || 'Untitled Document',
          source: request.url || 'uploaded-file',
          userId: request.userId,
          tenantId: request.tenantId,
          accessLevel: request.accessLevel
        });
        console.log('✅ Content stored for RAG retrieval');
        await this.updateJobProgress(job.jobId, 90, 'Content stored for RAG');
      } else {
        console.log('❌ No content available for RAG storage');
      }

      // Step 6: Complete job
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
    console.log('🔄 extractRawContent called with:', { hasContent: !!request.content, url: request.url });
    
    if (request.content) {
      console.log('✅ Using provided content, length:', request.content.length);
      return request.content;
    }

    if (request.url) {
      console.log('🔄 Extracting content from URL:', request.url);
      
      try {
        // Use robust content extractor for advanced multi-layer, video-embedded content
        const { default: robustExtractor } = await import('../services/robust-content-extractor');
        const result = await robustExtractor.extractContent(request.url, {
          enableJavaScript: true,
          timeout: 45000,
          waitForSelector: 'body',
          followRedirects: true,
          maxRedirects: 10
        });
        
        console.log('📄 Content extraction result:', { 
          success: result.success, 
          contentLength: result.content?.length || 0,
          error: result.error 
        });
        
        if (!result.success) {
          throw new Error(`Failed to extract content from URL: ${result.error}`);
        }
        
        if (!result.content || result.content.trim().length === 0) {
          throw new Error('No content extracted from URL');
        }
        
        console.log('✅ Content extracted successfully, length:', result.content.length);
        return result.content;
        
      } catch (error) {
        console.error('❌ Content extraction failed:', error);
        throw error;
      }
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
   * Store content for RAG retrieval with MongoDB Atlas Vector Search
   */
  private async storeContentForRAG(data: {
    documentId: string;
    content: string;
    title: string;
    source: string;
    userId: string;
    tenantId: string;
    accessLevel: string;
  }): Promise<void> {
    try {
      console.log('🔄 storeContentForRAG called with content length:', data.content?.length || 0);
      
      // Validate content exists
      if (!data.content || data.content.trim().length === 0) {
        console.warn('⚠️ No content to store for RAG - content is empty');
        return;
      }

      // Store content metadata in MongoDB with proper documentId linkage
      const contentDoc = {
        documentId: data.documentId,  // Use documentId for proper linkage
        title: data.title,
        content: data.content,
        source: data.source,
        userId: data.userId,
        tenantId: data.tenantId,
        accessLevel: data.accessLevel,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const contentResult = await this.mongoAccessor.create('contents', contentDoc);
      console.log('✅ Content metadata stored in MongoDB with documentId:', data.documentId);

      // Generate embeddings and store in MongoDB Atlas Vector Search
      try {
        console.log('🔄 Generating embeddings for MongoDB Atlas Vector Search...');
        
        // Import services dynamically to avoid circular dependencies
        const { default: EmbeddingService } = await import('../services/embedding-service');
        const { default: MongoVectorAccessor } = await import('../accessors/MongoVectorAccessor');
        
        const embeddingService = new EmbeddingService();
        const mongoVectorAccessor = new MongoVectorAccessor();
        
        // Initialize vector search index if needed
        await mongoVectorAccessor.initializeIndex();
        
        // Chunk content for better embeddings
        const chunks = this.chunkContent(data.content, 1000);
        console.log(`📝 Content chunked into ${chunks.length} pieces`);
        
        // Generate embeddings for each chunk
        const vectorDocs = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const result = await embeddingService.generateEmbedding(chunk);
          
          vectorDocs.push({
            id: `${data.documentId}_chunk_${i}`,
            vector: result.embedding,
            metadata: {
              userId: data.userId,
              tenantId: data.tenantId,
              title: data.title,
              source: data.source,
              accessLevel: data.accessLevel,
              contentType: 'text',
              createdAt: new Date().toISOString(),
              textChunk: chunk,
              chunkIndex: i,
              totalChunks: chunks.length,
              documentId: data.documentId
            }
          });
        }
        
        // Store vectors in MongoDB Atlas
        await mongoVectorAccessor.storeVectors(vectorDocs);
        console.log(`✅ ${vectorDocs.length} embeddings stored in MongoDB Atlas Vector Search`);
        
      } catch (error) {
        console.error('❌ Failed to generate/store embeddings:', error);
        // Continue without embeddings rather than failing the entire job
      }
      
    } catch (error) {
      console.error('❌ Failed to store content for RAG:', error);
      throw error;
    }
  }

  /**
   * Chunk content into smaller pieces for better embeddings
   */
  private chunkContent(content: string, maxChunkSize: number = 1000): string[] {
    if (!content || content.length <= maxChunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }
    
    return chunks.length > 0 ? chunks : [content];
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
