/**
 * API endpoint for authenticated web crawling
 * Supports various authentication methods: Basic, Bearer, OAuth, Cookie, Custom
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { WebCrawlingManager } from '@/lib/managers/WebCrawlingManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { ProcessingConfig, ContentSource } from '@/lib/types/content';
import { AuthConfig } from '@/lib/engines/WebCrawlingEngine';

/**
 * POST /api/content/crawl-authenticated
 * Start an authenticated web crawling job
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      url, 
      auth,
      maxPages = 50,
      crawlDepth = 3,
      allowedDomains = [],
      extractText = true,
      generateEmbeddings = true,
      enableOCR = false,
      phiDetection = true
    } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Validate authentication config if provided
    if (auth) {
      const validAuthTypes = ['none', 'basic', 'bearer', 'oauth', 'cookie', 'custom'];
      if (!validAuthTypes.includes(auth.type)) {
        return NextResponse.json(
          { error: 'Invalid authentication type' },
          { status: 400 }
        );
      }

      // Validate required credentials for each auth type
      switch (auth.type) {
        case 'basic':
          if (!auth.credentials?.username || !auth.credentials?.password) {
            return NextResponse.json(
              { error: 'Basic auth requires username and password' },
              { status: 400 }
            );
          }
          break;
        case 'bearer':
          if (!auth.credentials?.token) {
            return NextResponse.json(
              { error: 'Bearer auth requires token' },
              { status: 400 }
            );
          }
          break;
        case 'oauth':
          if (!auth.credentials?.clientId || !auth.credentials?.clientSecret || !auth.credentials?.tokenUrl) {
            return NextResponse.json(
              { error: 'OAuth requires clientId, clientSecret, and tokenUrl' },
              { status: 400 }
            );
          }
          break;
        case 'cookie':
          if (!auth.cookies || auth.cookies.length === 0) {
            return NextResponse.json(
              { error: 'Cookie auth requires at least one cookie' },
              { status: 400 }
            );
          }
          break;
        case 'custom':
          if (!auth.headers || Object.keys(auth.headers).length === 0) {
            return NextResponse.json(
              { error: 'Custom auth requires headers' },
              { status: 400 }
            );
          }
          break;
      }
    }

    // Initialize accessors
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );

    const anthropicAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY!
    );

    // Initialize WebCrawlingManager
    const crawlingManager = new WebCrawlingManager(
      mongoAccessor,
      s3Accessor,
      anthropicAccessor
    );

    // Prepare content source
    const contentSource: ContentSource = {
      type: 'url',
      source: url,
      metadata: {
        authenticated: !!auth,
        authType: auth?.type || 'none'
      }
    };

    // Prepare processing config with authentication
    const processingConfig: ProcessingConfig = {
      contentType: 'web',
      extractText,
      generateEmbeddings,
      enableTranscription: false,
      enableOCR,
      enableObjectDetection: false,
      quality: 'medium',
      maxPages,
      crawlDepth,
      allowedDomains,
      auth: auth as AuthConfig,
      phiDetection,
      auditLogging: true
    };

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const contentId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create processing job in database
    const job = {
      id: jobId,
      contentId: contentId,
      status: 'pending' as const,
      progress: 0,
      startTime: new Date(),
      config: processingConfig,
      userId: session.user.id,
      tenantId: session.user.accessId || 'default',
      accessLevel: session.user.accessLevel || 'ACCOUNT'
    };

    await mongoAccessor.create('processing_jobs', job);

    // Process the content asynchronously
    crawlingManager.processWebContent(
      contentSource,
      processingConfig,
      session.user.id,
      session.user.accessId || 'default'
    ).catch(error => {
      console.error('Web crawling failed:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      contentId: job.contentId,
      status: job.status,
      message: `Authenticated crawling started for ${url}`,
      authType: auth?.type || 'none'
    });

  } catch (error) {
    console.error('Authenticated crawling error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start authenticated crawling',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/content/crawl-authenticated
 * Get the status of an authenticated crawling job
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get job ID from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Initialize MongoDB accessor
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    // Get job status
    const job = await mongoAccessor.findById('processing_jobs', jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify user owns this job
    if (job.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to job' },
        { status: 403 }
      );
    }

    // Get content details if processing is complete
    let content = null;
    if (job.status === 'completed' && job.contentId) {
      content = await mongoAccessor.findById('web_content', job.contentId);
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        startTime: job.startTime,
        endTime: job.endTime,
        errors: job.errors
      },
      content: content ? {
        id: content.id,
        title: content.title,
        description: content.description,
        pagesCount: content.crawledPages?.length || 0,
        resourcesCount: content.linkedResources?.length || 0,
        extractedTextLength: content.extractedText?.length || 0,
        hasEmbeddings: !!content.embeddings?.length
      } : null
    });

  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
