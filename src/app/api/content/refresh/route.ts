import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { WebCrawlingManager } from '@/lib/managers/WebCrawlingManager';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contentId, url } = await request.json();
    
    if (!contentId || !url) {
      return NextResponse.json({ error: 'Content ID and URL required' }, { status: 400 });
    }

    // Initialize accessors
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );
    const anthropicAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY!
    );

    // Initialize web crawling manager
    const webManager = new WebCrawlingManager(
      mongoAccessor,
      s3Accessor,
      anthropicAccessor
    );

    // Create refresh job
    const jobId = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store job in database
    await mongoAccessor.create('processing_jobs', {
      jobId,
      type: 'web_refresh',
      contentId,
      url,
      userId: session.user.id,
      tenantId: session.user.accessId || 'default',
      status: 'processing',
      createdAt: new Date()
    });

    // Start async refresh
    webManager.processWebContent(
      { type: 'url', source: url },
      {
        contentType: 'web',
        extractText: true,
        generateEmbeddings: true,
        enableTranscription: false,
        enableOCR: false,
        enableObjectDetection: false,
        quality: 'medium',
        maxPages: 1,
        crawlDepth: 1,
        phiDetection: false,
        auditLogging: true
      },
      session.user.id,
      session.user.accessId || 'default'
    ).then(async () => {
      // Update original content
      await mongoAccessor.update(
        'processed_content',
        contentId,
        {
          lastUpdated: new Date(),
          lastChecked: new Date(),
          needsRefresh: false
        }
      );

      // Update job status  
      const job = await mongoAccessor.findOne('processing_jobs', { jobId });
      if (job && job._id) {
        await mongoAccessor.update(
          'processing_jobs',
          job._id.toString(),
          { status: 'completed', completedAt: new Date() }
        );
      }
    }).catch(async (error) => {
      console.error('Refresh error:', error);
      const job = await mongoAccessor.findOne('processing_jobs', { jobId });
      if (job && job._id) {
        await mongoAccessor.update(
          'processing_jobs',
          job._id.toString(),
          { 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date()
          }
        );
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Content refresh started'
    });

  } catch (error) {
    console.error('Content refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
