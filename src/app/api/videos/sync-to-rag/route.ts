import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { RAGManager } from '@/lib/managers/RAGManager';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!session && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      forceSync = false, 
      category = 'eyecare-training',
      limit = 100,
      minConfidence = 0.7
    } = await request.json();

    console.log('🔄 Starting RAG sync for processed videos...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'ai-assistant';
    const mongoAccessor = new MongoDBAccessor(mongoUri, dbName);
    await mongoAccessor.connect();

    // Initialize RAG Manager
    const ragManager = new RAGManager();

    // Query for processed videos - check multiple collections and fields
    const query = {
      $or: [
        { contentType: 'video' },
        { processingStatus: 'processed' },
        { processedAt: { $exists: true } }
      ],
      $and: [
        {
          $or: [
            { transcript: { $exists: true, $ne: null, $ne: '' } },
            { aiSummary: { $exists: true, $ne: null, $ne: '' } }
          ]
        },
        { confidence: { $gte: minConfidence } }
      ],
      ...(forceSync ? {} : { ragSynced: { $ne: true } })
    };

    console.log('🔍 Finding processed videos to sync...');
    
    // Check both collections: documents and processedVideos
    const documentsResults = await mongoAccessor.find('documents', query, { limit: Math.floor(limit/2) });
    const processedVideosResults = await mongoAccessor.find('processedVideos', query, { limit: Math.floor(limit/2) });
    
    const processedVideos = [...documentsResults, ...processedVideosResults];

    console.log(`📊 Found ${processedVideos.length} videos to sync to RAG`);

    let syncedCount = 0;
    let errorCount = 0;
    const syncResults = [];

    for (const video of processedVideos) {
      try {
        console.log(`📹 Processing: ${video.title || video.name || 'Untitled'}`);

        // Prepare content for RAG
        const ragContent = formatVideoContentForRAG(video);
        
        // Add to RAG system
        await ragManager.addDocument(ragContent.content, ragContent.metadata);

        // Mark as synced in MongoDB
        await mongoAccessor.update('processedVideos', video._id, {
          ragSynced: true,
          ragSyncedAt: new Date(),
          ragContentLength: ragContent.content.length
        });

        syncedCount++;
        syncResults.push({
          id: video._id,
          title: video.title || video.name,
          status: 'synced',
          contentLength: ragContent.content.length
        });

        console.log(`✅ Synced: ${video.title || video.name}`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Error syncing video ${video.title}:`, error);
        
        syncResults.push({
          id: video._id,
          title: video.title || video.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await mongoAccessor.disconnect();

    return NextResponse.json({
      success: true,
      summary: {
        totalFound: processedVideos.length,
        synced: syncedCount,
        errors: errorCount,
        vectorStoreType: ragManager.getStoreType()
      },
      results: syncResults,
      message: `Successfully synced ${syncedCount} videos to RAG system`
    });

  } catch (error: any) {
    console.error('❌ RAG sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync videos to RAG',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Format video content for RAG ingestion
 */
function formatVideoContentForRAG(video: any) {
    const sections = [];
    
    // Video title and description
    if (video.title || video.name) {
      sections.push(`Title: ${video.title || video.name}`);
    }
    
    if (video.description) {
      sections.push(`Description: ${video.description}`);
    }

    // AI-generated summary
    if (video.aiSummary) {
      sections.push(`Summary: ${video.aiSummary}`);
    }

    // Key insights from AI analysis
    if (video.keyInsights && video.keyInsights.length > 0) {
      sections.push(`Key Insights: ${video.keyInsights.join('. ')}`);
    }

    // Topics extracted by AI
    if (video.topics && video.topics.length > 0) {
      sections.push(`Topics: ${video.topics.join(', ')}`);
    }

    // VSP Product information if available
    if (video.vspProduct) {
      sections.push(`VSP Product: ${video.vspProduct}`);
    }

    // Full transcript
    if (video.transcript) {
      sections.push(`Transcript: ${video.transcript}`);
    }

    // Combine all sections
    const content = sections.join('\n\n');

    // Prepare metadata
    const metadata = {
      title: video.title || video.name || 'Untitled Video',
      source: `video:${video.vimeoId || video._id}`,
      contentType: 'video' as const,
      accessLevel: video.accessLevel || 'PUBLIC',
      tenantId: video.tenantId || 'default',
      duration: video.duration,
      category: video.suggestedCategory || 'eyecare-training',
      topics: video.topics || [],
      confidence: video.confidence || 0,
      vimeoId: video.vimeoId,
      processedAt: video.processedAt,
      vspProduct: video.vspProduct,
      originalTags: video.tags || []
    };

    return { content, metadata };
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/videos/sync-to-rag',
    method: 'POST',
    description: 'Sync existing processed videos to RAG knowledge base',
    parameters: {
      forceSync: 'boolean - Re-sync already synced videos (optional)',
      category: 'string - Filter by video category (optional)',
      limit: 'number - Maximum videos to process (default: 100)',
      minConfidence: 'number - Minimum processing confidence (default: 0.7)'
    },
    workflow: [
      'Query MongoDB for processed videos with transcripts',
      'Format video content (title, summary, insights, transcript)',
      'Add formatted content to RAG system',
      'Mark videos as synced in database',
      'Return sync results and statistics'
    ]
  });
}
