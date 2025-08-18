import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { WebCrawlingEngine } from '@/lib/engines/WebCrawlingEngine';
import { WebCrawlingManager } from '@/lib/managers/WebCrawlingManager';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, maxDepth = 3, maxPages = 100 } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    // Create crawl job
    const crawlJobId = `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await mongoAccessor.connect();
    
    // Start discovery crawl (not processing, just finding URLs)
    console.log(`🕷️ Starting site crawl for ${url} with depth ${maxDepth}`);
    
    // Initialize crawl session for discovery
    const discoveredUrls = new Set<string>();
    discoveredUrls.add(url);
    
    // Use WebCrawlingEngine to discover URLs
    const crawlEngine = new WebCrawlingEngine();
    const crawlSession = await crawlEngine.initializeCrawlSession(url, {
      maxDepth,
      maxPages,
      respectRobotsTxt: true,
      userAgent: 'AI-Assistant-Crawler/1.0',
      followRedirects: true,
      timeout: 30000,
      delayBetweenRequests: 500,
      allowedDomains: []
    });
    
    // Run the crawl session
    const pages = await crawlEngine.crawlWebsite(crawlSession);

    // Extract all discovered URLs
    const allUrls: string[] = [];
    pages.forEach((page: any) => {
      allUrls.push(page.url);
      page.links?.forEach((link: any) => discoveredUrls.add(link));
    });

    // Store crawl job with discovered URLs
    const crawlJob = {
      crawlJobId,
      baseUrl: url,
      userId: session.user.id,
      tenantId: session.user.accessId || 'default',
      status: 'discovered',
      createdAt: new Date(),
      config: {
        maxDepth,
        maxPages
      },
      stats: {
        totalDiscovered: discoveredUrls.size,
        totalCrawled: pages.length,
        totalQueued: 0,
        totalProcessed: 0,
        totalFailed: 0
      },
      urls: Array.from(discoveredUrls).map(discoveredUrl => ({
        url: discoveredUrl,
        status: 'discovered',
        depth: pages.find((p: any) => p.url === discoveredUrl)?.depth || 0,
        title: pages.find((p: any) => p.url === discoveredUrl)?.title,
        discoveredAt: new Date(),
        processedAt: null,
        error: null,
        selected: true // Default to selected for processing
      }))
    };

    await mongoAccessor.create('crawl_jobs', crawlJob);

    return NextResponse.json({
      success: true,
      crawlJobId,
      message: `Discovered ${discoveredUrls.size} URLs from ${url}`,
      stats: crawlJob.stats,
      urls: crawlJob.urls
    });

  } catch (error) {
    console.error('Site crawler error:', error);
    return NextResponse.json(
      { error: 'Failed to crawl site', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch crawl job status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const crawlJobId = searchParams.get('crawlJobId');

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    if (crawlJobId) {
      // Get specific crawl job
      await mongoAccessor.connect();
      const crawlJobs = await mongoAccessor.find('crawl_jobs', {
        crawlJobId,
        userId: session.user.id
      });
      const crawlJob = crawlJobs[0];

      if (!crawlJob) {
        return NextResponse.json({ error: 'Crawl job not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        crawlJob
      });
    } else {
      // Get all crawl jobs for user
      await mongoAccessor.connect();
      const crawlJobs = await mongoAccessor.find('crawl_jobs', 
        { userId: session.user.id },
        { limit: 10, sort: { createdAt: -1 } }
      );

      return NextResponse.json({
        success: true,
        crawlJobs
      });
    }

  } catch (error) {
    console.error('Crawl job fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crawl jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT endpoint to process selected URLs from crawl job
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { crawlJobId, selectedUrls } = await request.json();
    
    if (!crawlJobId || !selectedUrls) {
      return NextResponse.json({ error: 'Crawl job ID and selected URLs required' }, { status: 400 });
    }

    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );

    // Update crawl job with selected URLs
    await mongoAccessor.connect();
    const jobs = await mongoAccessor.find('crawl_jobs', { crawlJobId, userId: session.user.id });
    if (jobs.length > 0) {
      await mongoAccessor.update('crawl_jobs', jobs[0]._id.toString(), {
        status: 'processing',
        stats: {
          ...jobs[0].stats,
          totalQueued: selectedUrls.length
        },
        updatedAt: new Date()
      });
    }

    // Create processing jobs for each selected URL
    const processingJobs = [];
    for (const url of selectedUrls) {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const job = {
        jobId,
        crawlJobId,
        type: 'web',
        url,
        userId: session.user.id,
        tenantId: session.user.accessId || 'default',
        status: 'pending',
        createdAt: new Date(),
        config: {
          extractContent: true,
          generateSummary: true,
          extractKeyTopics: true,
          generateEmbeddings: true
        }
      };

      await mongoAccessor.create('processing_jobs', job);
      processingJobs.push(jobId);

      // Update URL status in crawl job
      const crawlJobs = await mongoAccessor.find('crawl_jobs', { crawlJobId });
      if (crawlJobs.length > 0) {
        const crawlJob = crawlJobs[0];
        const updatedUrls = crawlJob.urls.map((u: any) => 
          u.url === url ? { ...u, status: 'queued', jobId } : u
        );
        await mongoAccessor.update('crawl_jobs', crawlJob._id.toString(), { urls: updatedUrls });
      }
    }

    // TODO: Trigger actual processing (would integrate with WebCrawlingManager)
    
    return NextResponse.json({
      success: true,
      message: `Queued ${selectedUrls.length} URLs for processing`,
      processingJobs
    });

  } catch (error) {
    console.error('URL processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process URLs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
