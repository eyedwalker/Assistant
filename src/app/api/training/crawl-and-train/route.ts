/**
 * Recursive Web Crawler & Training API
 * Discovers and trains AI on ALL Eyefinity help pages automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';

interface CrawlResult {
  url: string;
  title: string;
  links: string[];
  processed: boolean;
  error?: string;
}

class EyefinityCrawler {
  private visited = new Set<string>();
  private discovered = new Set<string>();
  private results: CrawlResult[] = [];
  private documentManager: DocumentManager;
  private baseUrl = 'https://help.eyefinity.com';
  private maxDepth = 3;
  private maxPages = 100;
  private delayMs = 1000;

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
  }

  async crawlAndTrain(startUrls: string[], options: {
    maxDepth?: number;
    maxPages?: number;
    delayMs?: number;
    userId?: string;
    tenantId?: string;
  } = {}) {
    this.maxDepth = options.maxDepth || 3;
    this.maxPages = options.maxPages || 100;
    this.delayMs = options.delayMs || 1000;

    const userId = options.userId || 'crawler-admin';
    const tenantId = options.tenantId || 'demo-tenant';

    console.log(`🕷️ Starting recursive crawl with max depth ${this.maxDepth}, max pages ${this.maxPages}`);

    // Initialize with start URLs
    startUrls.forEach(url => this.discovered.add(url));

    let currentDepth = 0;
    let processedCount = 0;

    while (currentDepth < this.maxDepth && processedCount < this.maxPages) {
      const urlsToProcess = Array.from(this.discovered).filter(url => !this.visited.has(url));
      
      if (urlsToProcess.length === 0) break;

      console.log(`📊 Depth ${currentDepth + 1}: Processing ${urlsToProcess.length} URLs`);

      for (const url of urlsToProcess.slice(0, this.maxPages - processedCount)) {
        if (processedCount >= this.maxPages) break;

        try {
          const result = await this.crawlPage(url);
          this.results.push(result);
          this.visited.add(url);

          // Add newly discovered links
          result.links.forEach(link => {
            if (this.isValidEyefinityUrl(link) && !this.visited.has(link)) {
              this.discovered.add(link);
            }
          });

          // Train AI on this page
          if (result.processed) {
            await this.trainOnPage(url, userId, tenantId);
          }

          processedCount++;
          console.log(`✅ Processed ${processedCount}/${this.maxPages}: ${url}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, this.delayMs));

        } catch (error) {
          console.error(`❌ Failed to process ${url}:`, error);
          this.results.push({
            url,
            title: '',
            links: [],
            processed: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          this.visited.add(url);
        }
      }

      currentDepth++;
    }

    return {
      totalDiscovered: this.discovered.size,
      totalProcessed: this.visited.size,
      totalTrained: this.results.filter(r => r.processed).length,
      results: this.results
    };
  }

  private async crawlPage(url: string): Promise<CrawlResult> {
    const axios = require('axios');
    const cheerio = require('cheerio');

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 5,
        validateStatus: (status: number) => status < 400,
      });

      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

      // Extract all links
      const links: string[] = [];
      $('a[href]').each((_: number, element: any) => {
        const href = $(element).attr('href');
        if (href) {
          const absoluteUrl = this.resolveUrl(href, url);
          if (absoluteUrl && this.isValidEyefinityUrl(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        }
      });

      return {
        url,
        title,
        links: [...new Set(links)], // Remove duplicates
        processed: true
      };

    } catch (error) {
      return {
        url,
        title: '',
        links: [],
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async trainOnPage(url: string, userId: string, tenantId: string) {
    try {
      await this.documentManager.processDocument({
        url: url,
        userId,
        tenantId,
        accessLevel: 'COMPANY',
        metadata: {
          title: url.split('/').pop() || 'unknown',
          source: 'recursive-crawler',
          tags: ['eyefinity-help', 'training-data']
        }
      });
    } catch (error) {
      console.error(`❌ Failed to train on ${url}:`, error);
      throw error;
    }
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${href}`;
      }
      if (href.startsWith('../') || href.startsWith('./') || !href.includes('/')) {
        return new URL(href, baseUrl).href;
      }
      return null;
    } catch {
      return null;
    }
  }

  private isValidEyefinityUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('eyefinity.com') &&
        urlObj.pathname.includes('/epm/Content/') &&
        (urlObj.pathname.endsWith('.htm') || urlObj.pathname.endsWith('.html')) &&
        !urlObj.pathname.includes('/images/') &&
        !urlObj.pathname.includes('/css/') &&
        !urlObj.pathname.includes('/js/')
      );
    } catch {
      return false;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startUrls = [
        'https://help.eyefinity.com/epm/Content/HowCanWeHelp.htm',
        'https://help.eyefinity.com/epm/Content/FrontOffice/NavigatingFO.htm',
        'https://help.eyefinity.com/epm/Content/Administration/NavigatingAdmin.htm'
      ],
      maxDepth = 3,
      maxPages = 100,
      delayMs = 1000,
      userId = 'crawler-admin',
      tenantId = 'demo-tenant'
    } = body;

    console.log(`🚀 Starting recursive crawl and train process`);

    // Initialize managers
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'eyecare-ai'
    );
    
    const anthropicAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY || ''
    );
    
    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );
    
    const documentManager = new DocumentManager(mongoAccessor, s3Accessor, anthropicAccessor);
    const crawler = new EyefinityCrawler(documentManager);

    const results = await crawler.crawlAndTrain(startUrls, {
      maxDepth,
      maxPages,
      delayMs,
      userId,
      tenantId
    });

    console.log(`🎉 Crawl and train completed: ${results.totalTrained}/${results.totalProcessed} pages trained`);

    return NextResponse.json({
      success: true,
      message: 'Recursive crawl and train completed',
      results: {
        summary: {
          totalDiscovered: results.totalDiscovered,
          totalProcessed: results.totalProcessed,
          totalTrained: results.totalTrained,
          successRate: `${Math.round((results.totalTrained / results.totalProcessed) * 100)}%`
        },
        pages: results.results.map(r => ({
          url: r.url,
          title: r.title,
          processed: r.processed,
          linksFound: r.links.length,
          error: r.error
        }))
      }
    });

  } catch (error) {
    console.error('❌ Recursive crawl and train failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Recursive crawl and train failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';

    // Get crawl training status
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB || 'eyecare-ai'
    );

    const crawlerStats = await mongoAccessor.aggregate('processing_jobs', [
      {
        $match: {
          tenantId,
          'metadata.source': 'recursive-crawler'
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          pages: { $push: '$metadata.filename' }
        }
      }
    ]);

    const contentStats = await mongoAccessor.aggregate('contents', [
      {
        $match: {
          tenantId,
          'metadata.source': 'recursive-crawler'
        }
      },
      {
        $group: {
          _id: null,
          totalPages: { $sum: 1 },
          totalEmbeddings: { $sum: { $cond: [{ $ne: ['$embeddings', null] }, 1, 0] } },
          avgContentLength: { $avg: { $strLenCP: '$content' } },
          categories: { $addToSet: '$metadata.category' }
        }
      }
    ]);

    return NextResponse.json({
      success: true,
      crawlStatus: {
        jobs: crawlerStats,
        content: contentStats[0] || { totalPages: 0, totalEmbeddings: 0, avgContentLength: 0, categories: [] },
        lastCrawl: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get crawl status:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get crawl status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
