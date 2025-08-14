/**
 * Document Processing Diagnostics API
 * Provides detailed visibility into what was actually processed
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log('🔍 Processing Diagnostics Request:', { userId, tenantId, limit });

    // Initialize MongoDB accessor
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );

    // Connect to database
    await mongoAccessor.connect();

    // Get recent processing jobs
    console.log('🔍 Searching for processing jobs with:', { userId, tenantId });
    
    // First, get ALL jobs to see what's in the database
    const allJobs = await mongoAccessor.find('processing_jobs', {}, { limit: 50 });
    console.log('📊 All jobs in database:', allJobs.length, allJobs.map(job => ({
      jobId: job.jobId,
      userId: job.userId,
      tenantId: job.tenantId,
      status: job.status,
      createdAt: job.createdAt
    })));
    
    const processingJobs = await mongoAccessor.find('processing_jobs', {
      $or: [{ userId }, { tenantId }]
    }, {
      sort: { createdAt: -1 },
      limit: limit
    });
    
    console.log('🎯 Filtered jobs for user/tenant:', processingJobs.length);

    // Get recent processed content - FIXED: Use AND logic instead of OR
    const processedContent = await mongoAccessor.find('contents', {
      userId: userId,
      tenantId: tenantId
    }, {
      sort: { updatedAt: -1 },
      limit: limit
    });

    // Get recent processing logs
    const processingLogs = await mongoAccessor.find('processing_logs', {
      $or: [{ userId }, { tenantId }]
    }, {
      sort: { timestamp: -1 },
      limit: limit * 3 // More logs for detailed view
    });

    // Get document metadata
    const documents = await mongoAccessor.find('documents', {
      $or: [{ userId }, { tenantId }]
    }, {
      sort: { createdAt: -1 },
      limit: limit
    });

    // Analyze processing patterns
    const diagnostics = {
      processingJobs: processingJobs.map((job: any) => ({
        id: job._id,
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        processingTime: job.completedAt && job.createdAt ? 
          new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime() : null,
        error: job.error,
        result: job.result ? {
          contentId: job.result.contentId,
          success: job.result.success,
          extractedTextLength: job.result.extractedText?.length || 0,
          hasAiAnalysis: !!job.result.aiAnalysis,
          hasEmbeddings: !!job.result.embeddings || !!job.result.vectorEmbeddings
        } : null
      })),

      processedContent: processedContent.map((content: any) => ({
        id: content._id,
        title: content.title || content.metadata?.title || 'Untitled',
        contentType: content.contentType,
        processingStatus: content.processingStatus,
        source: content.source || content.url,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        
        // Content analysis
        extractedTextLength: content.extractedText?.length || 0,
        transcriptionLength: content.transcription?.length || 0,
        hasAiAnalysis: !!content.aiAnalysis,
        aiAnalysisQuality: content.aiAnalysis?.quality,
        categoriesCount: content.categories?.length || 0,
        tagsCount: content.tags?.length || 0,
        learningObjectivesCount: content.learningObjectives?.length || 0,
        
        // RAG readiness
        hasEmbeddings: !!content.vectorEmbeddings || !!content.embeddings,
        embeddingCount: content.vectorEmbeddings?.length || content.embeddings?.length || 0,
        
        // Storage info
        s3Key: content.s3Key,
        fileSize: content.fileSize,
        accessLevel: content.accessLevel,
        
        // Preview of content
        contentPreview: {
          extractedText: content.extractedText?.substring(0, 200) + '...' || null,
          transcription: content.transcription?.substring(0, 200) + '...' || null,
          aiSummary: content.aiAnalysis?.summary?.substring(0, 200) + '...' || null,
          keyPoints: content.aiAnalysis?.keyPoints?.slice(0, 3) || [],
          categories: content.categories?.slice(0, 5) || [],
          tags: content.tags?.slice(0, 10) || []
        }
      })),

      processingLogs: processingLogs.map((log: any) => ({
        id: log._id,
        documentId: log.documentId,
        stage: log.stage,
        status: log.status,
        message: log.message,
        timestamp: log.timestamp,
        duration: log.duration,
        metadata: log.metadata,
        errorDetails: log.errorDetails
      })),

      documents: documents.map((doc: any) => ({
        id: doc._id,
        name: doc.name || doc.metadata?.title || 'Untitled',
        s3Key: doc.s3Key,
        metadata: doc.metadata,
        aiAnalysis: doc.ai_analysis ? {
          summary: doc.ai_analysis.summary?.substring(0, 200) + '...',
          quality: doc.ai_analysis.quality,
          keywordsCount: doc.ai_analysis.keywords?.length || 0
        } : null,
        createdAt: doc.createdAt,
        accessLevel: doc.accessLevel
      }))
    };

    // Generate processing insights
    const insights = {
      totalJobs: processingJobs.length,
      completedJobs: processingJobs.filter((job: any) => job.status === 'completed').length,
      failedJobs: processingJobs.filter((job: any) => job.status === 'failed').length,
      averageProcessingTime: processingJobs
        .filter((job: any) => job.completedAt && job.createdAt)
        .reduce((acc: number, job: any) => {
          const time = new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime();
          return acc + time;
        }, 0) / Math.max(1, processingJobs.filter((job: any) => job.completedAt).length),
      
      totalContent: processedContent.length,
      contentWithText: processedContent.filter((c: any) => c.extractedText || c.transcription).length,
      contentWithAI: processedContent.filter((c: any) => c.aiAnalysis).length,
      ragReadyContent: processedContent.filter((c: any) => 
        (c.vectorEmbeddings || c.embeddings) && c.aiAnalysis
      ).length,
      
      suspiciouslyFastJobs: processingJobs.filter((job: any) => {
        if (!job.completedAt || !job.createdAt) return false;
        const time = new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime();
        return time < 5000; // Less than 5 seconds
      }).length
    };

    await mongoAccessor.disconnect();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics,
      insights,
      recommendations: generateRecommendations(insights, diagnostics)
    });

  } catch (error) {
    console.error('❌ Processing diagnostics failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      diagnostics: null,
      insights: null
    }, { status: 500 });
  }
}

function generateRecommendations(insights: any, diagnostics: any) {
  const recommendations = [];

  if (insights.suspiciouslyFastJobs > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Suspiciously Fast Processing',
      message: `${insights.suspiciouslyFastJobs} jobs completed in under 5 seconds. This may indicate processing errors or skipped steps.`,
      action: 'Check processing logs for errors or incomplete processing stages.'
    });
  }

  if (insights.ragReadyContent === 0 && insights.totalContent > 0) {
    recommendations.push({
      type: 'error',
      title: 'No RAG-Ready Content',
      message: 'Content was processed but lacks embeddings or AI analysis needed for RAG functionality.',
      action: 'Verify AI analysis and embedding generation are working properly.'
    });
  }

  if (insights.failedJobs > insights.completedJobs) {
    recommendations.push({
      type: 'error',
      title: 'High Failure Rate',
      message: 'More jobs are failing than completing successfully.',
      action: 'Check error logs and processing pipeline configuration.'
    });
  }

  if (insights.contentWithText === 0 && insights.totalContent > 0) {
    recommendations.push({
      type: 'warning',
      title: 'No Text Extraction',
      message: 'Content was processed but no text was extracted.',
      action: 'Verify text extraction and OCR functionality.'
    });
  }

  return recommendations;
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/processing/diagnostics',
    description: 'Document Processing Diagnostics Dashboard',
    usage: {
      method: 'GET',
      parameters: {
        userId: 'User ID (optional, defaults to demo-user)',
        tenantId: 'Tenant ID (optional, defaults to demo-tenant)',
        limit: 'Number of records to return (optional, defaults to 10)'
      }
    },
    features: [
      'Processing job analysis with timing',
      'Processed content inspection',
      'Processing logs with error details',
      'RAG readiness assessment',
      'Performance insights and recommendations'
    ]
  });
}
