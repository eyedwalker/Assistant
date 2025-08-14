import { 
  DocumentMetadata, 
  ProcessingOptions, 
  DocumentProcessingStatus, 
  ProcessingStage, 
  ProcessingLog,
  ProcessingLogStatus,
  AccessLevel,
  ExtractionResult 
} from '@/types';
import mongoService from './mongodb-service';
import s3Service from './s3-service';
import contentExtractor from './robust-content-extractor';
import aiAnalysisService from './ai-analysis-service';
import crypto from 'crypto';

interface ProcessingResult {
  success: boolean;
  documentId?: string;
  error?: string;
  processingTime: number;
}

class DocumentProcessor {
  private readonly maxConcurrentJobs: number;
  private readonly processingTimeout: number;
  private activeJobs = new Map<string, AbortController>();

  constructor() {
    this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS || '5');
    this.processingTimeout = parseInt(process.env.PROCESSING_TIMEOUT_SECONDS || '300') * 1000;
  }

  /**
   * Process URLs with comprehensive extraction and analysis
   */
  async processUrls(
    urls: string[],
    options: ProcessingOptions,
    uploadedBy: string
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    // Process URLs in batches to respect concurrency limits
    const batches = this.createBatches(urls, this.maxConcurrentJobs);
    
    for (const batch of batches) {
      const batchPromises = batch.map(url => 
        this.processSingleUrl(url, options, uploadedBy)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: `Failed to process ${batch[index]}: ${result.reason}`,
            processingTime: 0
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Process uploaded files
   */
  async processFiles(
    files: Array<{ buffer: Buffer; originalName: string; mimetype: string }>,
    options: ProcessingOptions,
    uploadedBy: string
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.processSingleFile(file, options, uploadedBy);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: `Failed to process ${file.originalName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTime: 0
        });
      }
    }
    
    return results;
  }

  /**
   * Process a single URL through the complete pipeline
   */
  private async processSingleUrl(
    url: string,
    options: ProcessingOptions,
    uploadedBy: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const jobId = crypto.randomUUID();
    
    this.activeJobs.set(jobId, abortController);
    
    try {
      // Create document record
      const documentId = await this.createDocumentRecord(url, options, uploadedBy, 'url');
      
      // Stage 1: Content Extraction
      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.EXTRACTION,
        status: ProcessingLogStatus.STARTED,
        message: 'Starting content extraction'
      });

      const extractionResult = await this.extractContentWithTimeout(url, options, abortController);
      
      if (!extractionResult.success) {
        await this.markDocumentFailed(documentId, 'Content extraction failed', extractionResult.error);
        return {
          success: false,
          documentId,
          error: extractionResult.error,
          processingTime: Date.now() - startTime
        };
      }

      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.EXTRACTION,
        status: ProcessingLogStatus.COMPLETED,
        message: 'Content extraction completed',
        duration: extractionResult.processingTime,
        metadata: {
          method: extractionResult.extractionMethod,
          title: extractionResult.title,
          linksFound: extractionResult.links?.length || 0
        }
      });

      // Store content in S3
      const contentHash = this.generateContentHash(extractionResult.content);
      const s3Key = await s3Service.uploadFile(
        extractionResult.content,
        `${documentId}.txt`,
        'text/plain',
        options.accessLevel,
        options.accessId,
        {
          documentId,
          extractionMethod: extractionResult.extractionMethod,
          contentHash
        }
      );

      // Store screenshots if available
      let screenshotKeys: string[] = [];
      if (extractionResult.screenshots && extractionResult.screenshots.length > 0) {
        for (let i = 0; i < extractionResult.screenshots.length; i++) {
          const screenshot = extractionResult.screenshots[i];
          const screenshotBuffer = Buffer.from(screenshot, 'base64');
          const screenshotKey = await s3Service.uploadScreenshot(
            screenshotBuffer,
            documentId,
            options.accessLevel,
            options.accessId
          );
          screenshotKeys.push(screenshotKey);
        }
      }

      // Update document with extraction results
      await mongoService.updateDocument(documentId, {
        s3Key,
        extractedText: extractionResult.content.substring(0, 5000), // Store preview
        contentHash,
        screenshots: screenshotKeys,
        status: DocumentProcessingStatus.PROCESSING
      });

      // Stage 2: AI Analysis (if enabled)
      if (options.enableAIAnalysis) {
        await this.performAIAnalysis(documentId, extractionResult, options);
      }

      // Stage 3: Vector Embeddings
      await this.generateVectorEmbeddings(documentId, extractionResult.content);

      // Mark as completed
      await mongoService.updateDocument(documentId, {
        status: DocumentProcessingStatus.COMPLETED
      });

      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.INDEXING,
        status: ProcessingLogStatus.COMPLETED,
        message: 'Document stored successfully',
        duration: Date.now() - startTime
      });

      return {
        success: true,
        documentId,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Document processing failed for ${url}:`, error);
      
      return {
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Process a single file through the complete pipeline
   */
  private async processSingleFile(
    file: { buffer: Buffer; originalName: string; mimetype: string },
    options: ProcessingOptions,
    uploadedBy: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Create document record
      const documentId = await this.createDocumentRecord(
        file.originalName, 
        options, 
        uploadedBy, 
        'file',
        file.mimetype,
        file.buffer.length
      );

      // Store file in S3
      const s3Key = await s3Service.uploadFile(
        file.buffer,
        file.originalName,
        file.mimetype,
        options.accessLevel,
        options.accessId,
        { documentId }
      );

      // Extract text content based on file type
      let extractedText = '';
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/html') {
        extractedText = file.buffer.toString('utf-8');
      } else {
        // For other file types, you'd implement specific extractors
        extractedText = `File uploaded: ${file.originalName} (${file.mimetype})`;
      }

      const contentHash = this.generateContentHash(extractedText);

      // Update document with file info
      await mongoService.updateDocument(documentId, {
        s3Key,
        extractedText: extractedText.substring(0, 5000),
        contentHash,
        status: DocumentProcessingStatus.PROCESSING
      });

      // AI Analysis (if enabled)
      if (options.enableAIAnalysis && extractedText.length > 50) {
        await this.performAIAnalysis(documentId, {
          success: true,
          content: extractedText,
          title: file.originalName,
          extractionMethod: 'file_upload',
          processingTime: 0
        }, options);
      }

      // Vector Embeddings
      if (extractedText.length > 50) {
        await this.generateVectorEmbeddings(documentId, extractedText);
      }

      // Mark as completed
      await mongoService.updateDocument(documentId, {
        status: DocumentProcessingStatus.COMPLETED
      });

      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.INDEXING,
        status: ProcessingLogStatus.COMPLETED,
        message: 'Document stored successfully',
        duration: Date.now() - startTime
      });

      return {
        success: true,
        documentId,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`File processing failed for ${file.originalName}:`, error);
      
      return {
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create initial document record
   */
  private async createDocumentRecord(
    nameOrUrl: string,
    options: ProcessingOptions,
    uploadedBy: string,
    type: 'url' | 'file',
    fileType?: string,
    fileSize?: number
  ): Promise<string> {
    const documentId = crypto.randomUUID();
    
    const document: Omit<DocumentMetadata, 'id'> = {
      name: type === 'url' ? new URL(nameOrUrl).hostname : nameOrUrl,
      url: type === 'url' ? nameOrUrl : undefined,
      s3Key: '', // Will be updated later
      fileType: fileType || 'text/html',
      fileSize: fileSize || 0,
      accessLevel: options.accessLevel,
      accessId: options.accessId,
      status: DocumentProcessingStatus.PENDING,
      uploadedBy,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      processingLogs: []
    };

    await mongoService.createDocument(document);
    return documentId;
  }

  /**
   * Extract content with timeout protection
   */
  private async extractContentWithTimeout(
    url: string,
    options: ProcessingOptions,
    abortController: AbortController
  ): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        abortController.abort();
        reject(new Error('Content extraction timeout'));
      }, this.processingTimeout);

      contentExtractor.extractContent(url, {
        enableJavaScript: options.enableJavaScript,
        enableScreenshots: options.enableScreenshots,
        timeout: 30000
      }).then(result => {
        clearTimeout(timeout);
        resolve(result);
      }).catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Perform AI analysis on extracted content
   */
  private async performAIAnalysis(
    documentId: string,
    extractionResult: ExtractionResult,
    options: ProcessingOptions
  ): Promise<void> {
    await this.addProcessingLog(documentId, {
      stage: ProcessingStage.ANALYSIS,
      status: ProcessingLogStatus.STARTED,
      message: 'Starting AI analysis'
    });

    try {
      const analysis = await aiAnalysisService.analyzeContent(
        extractionResult.content,
        extractionResult.title,
        extractionResult.metadata?.url,
        {
          enablePHIDetection: true,
          enableSentimentAnalysis: true,
          enableTopicModeling: true
        }
      );

      await mongoService.updateDocument(documentId, {
        ai_analysis: analysis
      });

      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.ANALYSIS,
        status: ProcessingLogStatus.COMPLETED,
        message: `AI analysis completed with ${analysis.keywords.length} keywords identified`,
        metadata: {
          keywordCount: analysis.keywords.length,
          summaryLength: analysis.summary.length
        }
      });
    } catch (error) {
      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.INDEXING,
        status: ProcessingLogStatus.FAILED,
        message: `Finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Generate vector embeddings for the content
   */
  private async generateVectorEmbeddings(
    documentId: string,
    content: string
  ): Promise<void> {
    await this.addProcessingLog(documentId, {
      stage: ProcessingStage.INDEXING,
      status: ProcessingLogStatus.STARTED,
      message: 'Starting finalization'
    });

    try {
      const embeddings = await aiAnalysisService.generateEmbeddings(
        content,
        documentId,
        1000, // chunk size
        200   // overlap size
      );

      await mongoService.updateDocument(documentId, {
        vectorEmbeddings: embeddings
      });

      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.VECTORIZATION,
        status: ProcessingLogStatus.COMPLETED,
        message: `Generated ${embeddings.length} vector embeddings`,
        metadata: {
          embeddingCount: embeddings.length,
          totalChunks: embeddings.length
        }
      });
    } catch (error) {
      await this.addProcessingLog(documentId, {
        stage: ProcessingStage.VECTORIZATION,
        status: ProcessingLogStatus.FAILED,
        message: 'Vector embedding generation failed',
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add processing log entry
   */
  private async addProcessingLog(
    documentId: string,
    log: Omit<ProcessingLog, 'timestamp'>
  ): Promise<void> {
    await mongoService.addProcessingLog(documentId, {
      ...log,
      timestamp: new Date()
    });
  }

  /**
   * Mark document as failed
   */
  private async markDocumentFailed(
    documentId: string,
    message: string,
    error?: string
  ): Promise<void> {
    await mongoService.updateDocument(documentId, {
      status: DocumentProcessingStatus.FAILED
    });

    await this.addProcessingLog(documentId, {
      stage: ProcessingStage.EXTRACTION,
      status: ProcessingLogStatus.FAILED,
      message,
      errorDetails: error
    });
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create processing batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Cancel processing job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(documentId: string): Promise<DocumentMetadata | null> {
    return await mongoService.getDocument(documentId, AccessLevel.PUBLIC, '');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    activeJobs: number;
    services: {
      mongodb: boolean;
      s3: boolean;
      ai: boolean;
      contentExtractor: boolean;
    };
  }> {
    const services = {
      mongodb: await mongoService.healthCheck(),
      s3: await s3Service.healthCheck(),
      ai: (await aiAnalysisService.healthCheck()).status === 'healthy',
      contentExtractor: true // Assume healthy if no errors
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'down';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices > totalServices / 2) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    return {
      status,
      activeJobs: this.activeJobs.size,
      services
    };
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
export default documentProcessor;
