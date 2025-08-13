/**
 * Web Crawling Engine - VBD Engine Layer
 * 
 * Core algorithms for web content extraction including:
 * - Intelligent website crawling with depth control
 * - Content extraction from various page types
 * - Media resource discovery and analysis
 * - Robots.txt compliance
 * - JavaScript-rendered content handling
 */

import { CrawledPage, LinkedResource, WebMetadata } from '@/lib/types/content';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import * as robots from 'robots-parser';

export interface CrawlSession {
  id: string;
  baseUrl: string;
  options: CrawlOptions;
  visitedUrls: Set<string>;
  queuedUrls: string[];
  robotsParser?: any;
  startTime: Date;
}

export interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  allowedDomains: string[];
  respectRobotsTxt: boolean;
  delayBetweenRequests: number;
  userAgent: string;
  followRedirects: boolean;
  timeout: number;
  includeMedia: boolean;
  includeDocuments: boolean;
}

export class WebCrawlingEngine {
  private readonly DEFAULT_OPTIONS: CrawlOptions = {
    maxDepth: 3,
    maxPages: 100,
    allowedDomains: [],
    respectRobotsTxt: true,
    delayBetweenRequests: 1000,
    userAgent: 'AI-Assistant-Platform/1.0 (+https://ai-assistant-platform.com/bot)',
    followRedirects: true,
    timeout: 30000,
    includeMedia: true,
    includeDocuments: true
  };

  /**
   * Initialize crawling session
   */
  async initializeCrawlSession(baseUrl: string, options: Partial<CrawlOptions> = {}): Promise<CrawlSession> {
    const sessionId = this.generateSessionId();
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Validate base URL
    const url = new URL(baseUrl);
    
    // Set allowed domains if not specified
    if (mergedOptions.allowedDomains.length === 0) {
      mergedOptions.allowedDomains = [url.hostname];
    }

    const session: CrawlSession = {
      id: sessionId,
      baseUrl,
      options: mergedOptions,
      visitedUrls: new Set(),
      queuedUrls: [baseUrl],
      startTime: new Date()
    };

    // Load robots.txt if required
    if (mergedOptions.respectRobotsTxt) {
      try {
        session.robotsParser = await this.loadRobotsTxt(baseUrl, mergedOptions.userAgent);
      } catch (error) {
        console.warn('Failed to load robots.txt:', error.message);
      }
    }

    return session;
  }

  /**
   * Crawl website with comprehensive content extraction
   */
  async crawlWebsite(session: CrawlSession): Promise<CrawledPage[]> {
    const crawledPages: CrawledPage[] = [];
    let currentDepth = 0;

    while (
      session.queuedUrls.length > 0 && 
      crawledPages.length < session.options.maxPages &&
      currentDepth <= session.options.maxDepth
    ) {
      const currentBatch = session.queuedUrls.splice(0, 10); // Process 10 URLs at a time
      
      for (const url of currentBatch) {
        if (session.visitedUrls.has(url)) continue;
        
        try {
          // Check robots.txt compliance
          if (session.robotsParser && !session.robotsParser.isAllowed(url, session.options.userAgent)) {
            console.log(`Skipping ${url} due to robots.txt restrictions`);
            continue;
          }

          // Crawl individual page
          const page = await this.crawlPage(url, currentDepth, session);
          if (page) {
            crawledPages.push(page);
            session.visitedUrls.add(url);

            // Extract and queue new URLs
            if (currentDepth < session.options.maxDepth) {
              const newUrls = this.extractUrls(page.content, url, session.options.allowedDomains);
              session.queuedUrls.push(...newUrls.filter(newUrl => !session.visitedUrls.has(newUrl)));
            }
          }

          // Respect delay between requests
          if (session.options.delayBetweenRequests > 0) {
            await this.delay(session.options.delayBetweenRequests);
          }

        } catch (error) {
          console.error(`Failed to crawl ${url}:`, error);
          crawledPages.push({
            url,
            title: 'Failed to load',
            content: '',
            depth: currentDepth,
            lastCrawled: new Date(),
            status: 'failed',
            statusCode: 0,
            size: 0
          });
        }
      }

      currentDepth++;
    }

    return crawledPages;
  }

  /**
   * Crawl individual page
   */
  private async crawlPage(url: string, depth: number, session: CrawlSession): Promise<CrawledPage | null> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': session.options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: AbortSignal.timeout(session.options.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Only process HTML content
      if (!contentType.includes('text/html')) {
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract page content
      const title = this.extractTitle($);
      const content = this.extractContent($);
      const cleanContent = this.cleanContent(content);

      return {
        url,
        title,
        content: cleanContent,
        depth,
        lastCrawled: new Date(),
        status: 'success',
        statusCode: response.status,
        contentType,
        size: html.length
      };

    } catch (error) {
      console.error(`Error crawling page ${url}:`, error);
      return {
        url,
        title: 'Error loading page',
        content: '',
        depth,
        lastCrawled: new Date(),
        status: 'failed',
        statusCode: 0,
        size: 0
      };
    }
  }

  /**
   * Extract comprehensive web metadata
   */
  async extractWebMetadata(baseUrl: string, pages: CrawledPage[]): Promise<WebMetadata> {
    try {
      const response = await fetch(baseUrl, {
        headers: { 'User-Agent': this.DEFAULT_OPTIONS.userAgent }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      const url = new URL(baseUrl);

      // Extract basic metadata
      const title = this.extractTitle($);
      const description = this.extractDescription($);
      const author = this.extractAuthor($);
      const language = this.extractLanguage($);
      const keywords = this.extractKeywords($);

      // Extract social media metadata
      const socialMedia = {
        ogTitle: $('meta[property="og:title"]').attr('content'),
        ogDescription: $('meta[property="og:description"]').attr('content'),
        ogImage: $('meta[property="og:image"]').attr('content'),
        twitterCard: $('meta[name="twitter:card"]').attr('content')
      };

      // Calculate technical information
      const totalSize = pages.reduce((sum, page) => sum + page.size, 0);
      const successfulPages = pages.filter(p => p.status === 'success').length;

      const technicalInfo = {
        loadTime: 0, // Would be calculated during crawling
        pageSize: totalSize,
        resources: pages.length,
        lighthouse: undefined // Would require Lighthouse integration
      };

      return {
        title,
        description,
        author,
        publishDate: this.extractPublishDate($),
        lastModified: this.extractLastModified($),
        siteName: this.extractSiteName($),
        url: baseUrl,
        canonicalUrl: this.extractCanonicalUrl($, baseUrl),
        language,
        keywords,
        socialMedia,
        technicalInfo
      };

    } catch (error) {
      console.error('Error extracting web metadata:', error);
      
      // Return minimal metadata
      const url = new URL(baseUrl);
      return {
        title: url.hostname,
        url: baseUrl,
        lastModified: new Date(),
        technicalInfo: {
          loadTime: 0,
          pageSize: 0,
          resources: 0
        }
      };
    }
  }

  /**
   * Extract linked resources (videos, documents, images)
   */
  async extractLinkedResources(pageUrl: string, content: string): Promise<LinkedResource[]> {
    const $ = cheerio.load(content);
    const resources: LinkedResource[] = [];
    const baseUrl = new URL(pageUrl);

    // Extract video links
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const absoluteUrl = this.resolveUrl(href, baseUrl.origin);
        const resourceType = this.determineResourceType(absoluteUrl);
        
        if (resourceType && resourceType !== 'link') {
          resources.push({
            type: resourceType,
            url: absoluteUrl,
            title: $(element).text().trim() || $(element).attr('title'),
            description: $(element).attr('alt') || $(element).attr('title'),
            processed: false
          });
        }
      }
    });

    // Extract embedded videos
    $('iframe[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src && this.isVideoEmbed(src)) {
        resources.push({
          type: 'video',
          url: src,
          title: $(element).attr('title') || 'Embedded Video',
          processed: false
        });
      }
    });

    // Extract images
    $('img[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl.origin);
        resources.push({
          type: 'image',
          url: absoluteUrl,
          title: $(element).attr('alt') || $(element).attr('title'),
          description: $(element).attr('alt'),
          processed: false
        });
      }
    });

    return resources;
  }

  /**
   * Extract page title
   */
  async extractPageTitle(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.DEFAULT_OPTIONS.userAgent }
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      return this.extractTitle($);
    } catch (error) {
      return 'Unknown Title';
    }
  }

  /**
   * Extract document content from URL
   */
  async extractDocumentContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/pdf')) {
        // PDF processing would require additional libraries
        return 'PDF document detected - content extraction not implemented';
      }
      
      if (contentType.includes('text/')) {
        return await response.text();
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting document content:', error);
      return null;
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(imageUrl: string): Promise<string | null> {
    try {
      // Placeholder for OCR implementation
      // In production, integrate with Tesseract.js or cloud OCR service
      console.log('OCR extraction not implemented for:', imageUrl);
      return null;
    } catch (error) {
      console.error('Error extracting text from image:', error);
      return null;
    }
  }

  /**
   * Extract video metadata from URL
   */
  async extractVideoMetadata(videoUrl: string): Promise<any> {
    try {
      // Basic video metadata extraction
      const url = new URL(videoUrl);
      
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        return await this.extractYouTubeMetadata(videoUrl);
      }
      
      return {
        platform: url.hostname,
        url: videoUrl,
        title: 'Video',
        description: '',
        duration: 0
      };
    } catch (error) {
      console.error('Error extracting video metadata:', error);
      return null;
    }
  }

  /**
   * Cleanup crawling session
   */
  async cleanup(sessionId: string): Promise<void> {
    // Cleanup any temporary files or resources
    console.log(`Cleaning up crawling session: ${sessionId}`);
  }

  // Private helper methods

  private generateSessionId(): string {
    return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadRobotsTxt(baseUrl: string, userAgent: string): Promise<any> {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await fetch(robotsUrl);
      
      if (response.ok) {
        const robotsTxt = await response.text();
        return robots(robotsUrl, robotsTxt);
      }
      
      return null;
    } catch (error) {
      console.warn('Could not load robots.txt:', error);
      return null;
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors for title
    const title = $('title').text().trim() ||
                 $('h1').first().text().trim() ||
                 $('meta[property="og:title"]').attr('content') ||
                 $('meta[name="title"]').attr('content') ||
                 'Untitled Page';
    
    return title.substring(0, 200); // Limit title length
  }

  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
    
    // Extract main content
    const mainContent = $('main').text() ||
                       $('article').text() ||
                       $('.content').text() ||
                       $('#content').text() ||
                       $('body').text();
    
    return mainContent;
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()
      .substring(0, 10000); // Limit content length
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    return $('meta[name="description"]').attr('content') ||
           $('meta[property="og:description"]').attr('content');
  }

  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    return $('meta[name="author"]').attr('content') ||
           $('meta[property="article:author"]').attr('content');
  }

  private extractLanguage($: cheerio.CheerioAPI): string | undefined {
    return $('html').attr('lang') ||
           $('meta[http-equiv="content-language"]').attr('content');
  }

  private extractKeywords($: cheerio.CheerioAPI): string[] {
    const keywords = $('meta[name="keywords"]').attr('content');
    return keywords ? keywords.split(',').map(k => k.trim()) : [];
  }

  private extractPublishDate($: cheerio.CheerioAPI): Date | undefined {
    const dateStr = $('meta[property="article:published_time"]').attr('content') ||
                   $('meta[name="date"]').attr('content') ||
                   $('time[datetime]').attr('datetime');
    
    return dateStr ? new Date(dateStr) : undefined;
  }

  private extractLastModified($: cheerio.CheerioAPI): Date | undefined {
    const dateStr = $('meta[property="article:modified_time"]').attr('content') ||
                   $('meta[http-equiv="last-modified"]').attr('content');
    
    return dateStr ? new Date(dateStr) : undefined;
  }

  private extractSiteName($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="og:site_name"]').attr('content');
  }

  private extractCanonicalUrl($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    const canonical = $('link[rel="canonical"]').attr('href');
    return canonical ? this.resolveUrl(canonical, baseUrl) : undefined;
  }

  private extractUrls(content: string, baseUrl: string, allowedDomains: string[]): string[] {
    const $ = cheerio.load(content);
    const urls: string[] = [];
    const base = new URL(baseUrl);

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const absoluteUrl = this.resolveUrl(href, base.origin);
          const url = new URL(absoluteUrl);
          
          if (allowedDomains.includes(url.hostname) && !urls.includes(absoluteUrl)) {
            urls.push(absoluteUrl);
          }
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });

    return urls;
  }

  private resolveUrl(url: string, base: string): string {
    try {
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  }

  private determineResourceType(url: string): 'video' | 'audio' | 'image' | 'document' | 'link' | null {
    const lowerUrl = url.toLowerCase();
    
    // Video extensions and platforms
    if (lowerUrl.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i) ||
        lowerUrl.includes('youtube.com') || lowerUrl.includes('vimeo.com')) {
      return 'video';
    }
    
    // Audio extensions
    if (lowerUrl.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)) {
      return 'audio';
    }
    
    // Image extensions
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
      return 'image';
    }
    
    // Document extensions
    if (lowerUrl.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i)) {
      return 'document';
    }
    
    return 'link';
  }

  private isVideoEmbed(src: string): boolean {
    const videoEmbedPatterns = [
      /youtube\.com\/embed/,
      /vimeo\.com\/video/,
      /dailymotion\.com\/embed/,
      /wistia\.com\/embed/
    ];
    
    return videoEmbedPatterns.some(pattern => pattern.test(src));
  }

  private async extractYouTubeMetadata(url: string): Promise<any> {
    try {
      // Extract video ID from YouTube URL
      const videoId = this.extractYouTubeVideoId(url);
      if (!videoId) return null;

      // In production, use YouTube Data API
      return {
        platform: 'YouTube',
        videoId,
        url,
        title: 'YouTube Video',
        description: '',
        duration: 0
      };
    } catch (error) {
      return null;
    }
  }

  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
