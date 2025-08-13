/**
 * VBD Document Processing API Route - Clean Implementation
 * 
 * Uses Volatility-Based Decomposition architecture:
 * - DocumentManager (Manager Layer): Business rules and orchestration
 * - DocumentProcessingEngine (Engine Layer): Core algorithms
 * - MongoDBAccessor, S3Accessor, AnthropicAccessor (Accessor Layer): Data/API interfaces
 */

import { NextRequest, NextResponse } from 'next/server';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { z } from 'zod';

// Initialize VBD components
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

// Initialize MongoDB connection
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    await mongoAccessor.connect();
    isConnected = true;
  }
}

// Request validation schema for demo
const processUrlSchema = z.object({
  url: z.string().url(),
  userId: z.string().optional(),
  tenantId: z.string().optional(),
  accessLevel: z.enum(['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE']).optional()
});

export async function POST(request: NextRequest) {
  try {
    await ensureConnection();
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = processUrlSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { url, userId, tenantId, accessLevel } = validationResult.data;

    // Use default values for demo purposes
    const documentRequest = {
      url,
      userId: userId || 'demo-user-001',
      tenantId: tenantId || 'demo-tenant-001',
      accessLevel: accessLevel || 'ACCOUNT' as const,
      metadata: {
        source: 'dashboard-url-processing',
        title: `Document from ${new URL(url).hostname}`,
        tags: ['url-processed', 'dashboard']
      }
    };

    // Process document using VBD DocumentManager
    const result = await documentManager.processDocument(documentRequest);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      progress: result.progress,
      message: 'Document processing started successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('VBD Document processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check processing status
export async function GET(request: NextRequest) {
  try {
    await ensureConnection();
    
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const userId = searchParams.get('userId') || 'demo-user-001';
    const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job status using MongoDB accessor
    const job = await mongoAccessor.findProcessingJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('VBD Job status API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve job status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
