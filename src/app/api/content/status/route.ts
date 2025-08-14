/**
 * Content Processing Status API
 * Shows what content was processed and stored for RAG
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';

    // Initialize MongoDB accessor
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );

    // Get all processed content for the user/tenant
    const processedContent = await mongoAccessor.find('contents', {
      tenantId,
      processingStatus: 'completed'
    }, {
      sort: { updatedAt: -1 },
      limit: 20
    });

    // Get processing jobs/logs
    const processingJobs = await mongoAccessor.find('processing_jobs', {
      tenantId,
      userId
    }, {
      sort: { createdAt: -1 },
      limit: 10
    });

    // Get processing logs for detailed status
    const processingLogs = await mongoAccessor.find('processing_logs', {
      tenantId
    }, {
      sort: { timestamp: -1 },
      limit: 50
    });

    // Format response with detailed processing information
    const contentStatus = processedContent.map((content: any) => ({
      id: content._id,
      title: content.title || content.metadata?.title || 'Untitled',
      contentType: content.contentType,
      processingStatus: content.processingStatus,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      
      // Processing details
      extractedText: content.extractedText ? content.extractedText.substring(0, 200) + '...' : null,
      transcription: content.transcription ? content.transcription.substring(0, 200) + '...' : null,
      
      // AI Analysis results
      aiAnalysis: {
        summary: content.aiAnalysis?.summary,
        keyPoints: content.aiAnalysis?.keyPoints,
        categories: content.categories,
        tags: content.tags,
        learningObjectives: content.learningObjectives,
        quality: content.aiAnalysis?.quality,
        confidence: content.confidence
      },
      
      // RAG-ready indicators
      hasEmbeddings: !!content.vectorEmbeddings || !!content.embeddings,
      embeddingCount: content.vectorEmbeddings?.length || content.embeddings?.length || 0,
      
      // Storage information
      s3Key: content.s3Key,
      fileSize: content.fileSize,
      accessLevel: content.accessLevel
    }));

    const jobStatus = processingJobs.map((job: any) => ({
      id: job._id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.error,
      processingTime: job.processingTime
    }));

    const logStatus = processingLogs.map((log: any) => ({
      id: log._id,
      documentId: log.documentId,
      stage: log.stage,
      status: log.status,
      message: log.message,
      timestamp: log.timestamp,
      duration: log.duration,
      metadata: log.metadata
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessedContent: processedContent.length,
        totalJobs: processingJobs.length,
        totalLogs: processingLogs.length,
        contentWithEmbeddings: contentStatus.filter((c: any) => c.hasEmbeddings).length,
        ragReadyContent: contentStatus.filter((c: any) => c.hasEmbeddings && c.aiAnalysis.summary).length
      },
      processedContent: contentStatus,
      processingJobs: jobStatus,
      processingLogs: logStatus,
      ragStatus: {
        enabled: true,
        searchableFields: [
          'title', 'description', 'extractedText', 'transcription', 
          'aiAnalysis.summary', 'aiAnalysis.keyPoints', 'tags', 'categories'
        ],
        accessLevels: ['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE']
      }
    });

  } catch (error) {
    console.error('Error fetching content processing status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: {
        totalProcessedContent: 0,
        totalJobs: 0,
        totalLogs: 0,
        contentWithEmbeddings: 0,
        ragReadyContent: 0
      },
      processedContent: [],
      processingJobs: [],
      processingLogs: [],
      ragStatus: {
        enabled: true,
        error: 'Failed to retrieve status'
      }
    }, { status: 500 });
  }
}
