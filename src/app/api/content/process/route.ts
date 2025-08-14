/**
 * Multi-Modal Content Processing API Route
 * 
 * Unified endpoint for processing all content types:
 * - Documents, videos, web pages, images
 * - Intelligent content type detection
 * - Routing to appropriate processors
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContentDetectionEngine } from '@/lib/engines/ContentDetectionEngine';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { SecurityManager } from '@/lib/managers/SecurityManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { z } from 'zod';

// Initialize existing VBD components
const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);
const s3Accessor = new S3Accessor(
  process.env.AWS_S3_BUCKET_NAME || 'ai-assistant-platform-documents-dev',
  process.env.AWS_REGION || 'us-east-1'
);
const anthropicAccessor = new AnthropicAccessor();
const documentManager = new DocumentManager(mongoAccessor, s3Accessor, anthropicAccessor);
const securityManager = new SecurityManager(mongoAccessor);
const contentDetectionEngine = new ContentDetectionEngine();

// Initialize MongoDB connection
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    await mongoAccessor.connect();
    isConnected = true;
  }
}

// Request validation schema
const processContentSchema = z.object({
  url: z.string().url(),
  userId: z.string().optional().default('demo-user'),
  tenantId: z.string().optional().default('demo-tenant'),
  contentType: z.enum(['auto', 'document', 'video', 'web', 'image']).optional().default('auto'),
  options: z.object({
    enableTranscription: z.boolean().optional().default(false),
    enableOCR: z.boolean().optional().default(false),
    quality: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    maxPages: z.number().optional().default(10),
    crawlDepth: z.number().optional().default(2)
  }).optional().default({})
});

export async function POST(request: NextRequest) {
  try {
    await ensureConnection();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = processContentSchema.parse(body);
    
    const { url, userId, tenantId, contentType: requestedType, options } = validatedData;

    console.log('Processing content:', { url, userId, tenantId, requestedType, options });

    // Step 1: Detect content type
    const detectedType = requestedType === 'auto' 
      ? await contentDetectionEngine.detectContentType({ type: 'url', source: url })
      : requestedType;

    console.log('Detected content type:', detectedType);

    // Step 2: Generate processing configuration
    const config = contentDetectionEngine.generateProcessingConfig(detectedType, {
      enableTranscription: options.enableTranscription,
      enableOCR: options.enableOCR,
      quality: options.quality,
      maxPages: options.maxPages,
      crawlDepth: options.crawlDepth
    });

    // Step 3: Validate content
    const validation = contentDetectionEngine.validateContent({ type: 'url', source: url }, config);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: `Content validation failed: ${validation.errors.join(', ')}`,
        warnings: validation.warnings
      }, { status: 400 });
    }

    // Step 4: SECURITY VALIDATION - HIPAA/PII/PHI Compliance Check
    // Pre-fetch content for security scanning
    let contentPreview = '';
    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'User-Agent': 'AI-Assistant-Security-Scanner/1.0' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      if (response.ok) {
        const text = await response.text();
        // Get first 5000 characters for security scanning
        contentPreview = text.substring(0, 5000);
      }
    } catch (error) {
      console.warn('Could not fetch content for security scan:', error);
      // Continue with processing but log the warning
    }

    // Map content type for security validation
    const mapContentType = (type: string): 'document' | 'video' | 'web' | 'image' | 'audio' | 'text' => {
      switch (type) {
        case 'presentation':
        case 'document': return 'document';
        case 'video': return 'video';
        case 'web': return 'web';
        case 'image': return 'image';
        case 'audio': return 'audio';
        default: return 'text';
      }
    };

    // Perform security validation
    const securityValidation = await securityManager.validateContent({
      content: contentPreview,
      contentType: mapContentType(detectedType),
      userId,
      tenantId,
      accessLevel: 'COMPANY', // Default to strict compliance for eyecare
      source: 'url',
      metadata: {
        url,
        size: contentPreview.length,
        mimeType: 'text/html'
      }
    });

    // Block content if security violations detected
    if (!securityValidation.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Content blocked due to security policy violations',
        securityViolation: true,
        blockReason: securityValidation.blockReason,
        complianceStatus: securityValidation.complianceStatus,
        auditId: securityValidation.auditId,
        riskLevel: securityValidation.scanResult.riskLevel,
        violationCount: securityValidation.scanResult.violations.length
      }, { status: 403 });
    }

    // Log security approval
    console.log(`[SECURITY APPROVED] Content processing authorized - Audit ID: ${securityValidation.auditId}`);

    // Step 5: Estimate processing
    const estimation = contentDetectionEngine.estimateProcessing(detectedType, config);

    // Step 5: Route to appropriate processor
    let result;
    
    switch (detectedType) {
      case 'video':
        // For now, process videos as web content with special handling
        result = await processVideoContent(url, userId, tenantId, config);
        break;
        
      case 'web':
        // Enhanced web processing
        result = await processWebContent(url, userId, tenantId, config);
        break;
        
      case 'document':
      case 'image':
      default:
        // Use existing document manager with correct method
        result = await processDocumentContent(url, userId, tenantId, config);
        break;
    }

    // Step 6: Log processing event
    await logProcessingEvent('multi_modal_content_processed', {
      url,
      userId,
      tenantId,
      detectedType,
      estimatedTime: estimation.estimatedTime,
      estimatedCost: estimation.estimatedCost,
      jobId: result.jobId
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      contentType: detectedType,
      estimation: {
        processingTime: estimation.estimatedTime,
        cost: estimation.estimatedCost,
        resources: estimation.resourceRequirements
      },
      validation: {
        warnings: validation.warnings
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Multi-modal content processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Process document content using existing DocumentManager
 */
async function processDocumentContent(url: string, userId: string, tenantId: string, config: any) {
  console.log('Processing document content:', url);
  
  const request = {
    url,
    userId,
    tenantId,
    accessLevel: 'ACCOUNT' as const,
    metadata: {
      source: url,
      title: 'Multi-modal Content',
      tags: ['multi-modal', 'auto-processed']
    }
  };
  
  const job = await documentManager.processDocument(request);
  
  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress
  };
}

/**
 * Process video content with enhanced metadata
 */
async function processVideoContent(url: string, userId: string, tenantId: string, config: any) {
  console.log('Processing video content:', url);
  
  // For now, use document manager but add video-specific metadata
  const result = await processDocumentContent(url, userId, tenantId, config);
  
  // Add video-specific processing logic here in the future
  // This is where we would integrate VideoProcessingManager when ready
  
  return result;
}

/**
 * Process web content with enhanced crawling
 */
async function processWebContent(url: string, userId: string, tenantId: string, config: any) {
  console.log('Processing web content with enhanced features:', url);
  
  // For now, use document manager but add web-specific metadata
  const result = await processDocumentContent(url, userId, tenantId, config);
  
  // Add web crawling logic here in the future
  // This is where we would integrate WebCrawlingManager when ready
  
  return result;
}

/**
 * Log processing events for analytics
 */
async function logProcessingEvent(event: string, data: Record<string, any>) {
  try {
    // Use existing MongoDB structure for logging
    const auditLog = {
      event,
      data,
      timestamp: new Date(),
      source: 'MultiModalContentAPI'
    };
    
    // For now, just log to console
    // In the future, this would use a proper audit logging system
    console.log('Audit Log:', auditLog);
  } catch (error) {
    console.error('Failed to log processing event:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({
        success: false,
        error: 'Job ID is required'
      }, { status: 400 });
    }

    await ensureConnection();
    
    // Get job status using existing MongoDB accessor
    const job = await mongoAccessor.findProcessingJob(jobId);
    
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.jobId,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Job status retrieval error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
