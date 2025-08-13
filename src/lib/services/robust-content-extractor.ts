import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ExtractionResult } from '@/types';

interface ExtractionOptions {
  enableJavaScript?: boolean;
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  enableScreenshots?: boolean;
  waitForSelector?: string;
  customHeaders?: Record<string, string>;
}

class RobustContentExtractor {
  private browser: Browser | null = null;
  private readonly defaultTimeout = 30000;
  private readonly defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor() {
    // Initialize browser on first use
    this.initializeBrowser();
  }

  private async initializeBrowser(): Promise<void> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-web-security',
            '--allow-running-insecure-content'
          ],
        });
      }
    } catch (error) {
      console.error('Failed to initialize browser:', error);
    }
  }

  /**
   * Main extraction method that tries multiple strategies
   */
  async extractContent(url: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    console.log(`Starting content extraction for: ${url}`);

    // Validate URL
    if (!this.isValidUrl(url)) {
      return {
        success: false,
        content: '',
        error: 'Invalid URL format',
        extractionMethod: 'validation',
        processingTime: Date.now() - startTime
      };
    }

    const strategies = [
      () => this.tryHttpFirst(url, options),
      () => this.tryNodeHttps(url, options),
      () => this.tryAxiosSSL(url, options),
      () => this.tryHeadlessBrowser(url, options),
      () => this.tryFallbackExtraction(url, options)
    ];

    let lastError = '';

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying extraction strategy ${i + 1}/${strategies.length}`);
        const result = await strategies[i]();
        
        if (result.success && result.content.length > 50) {
          console.log(`Strategy ${i + 1} succeeded with ${result.content.length} characters`);
          result.processingTime = Date.now() - startTime;
          return result;
        }
        
        lastError = result.error || 'Strategy returned insufficient content';
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.log(`Strategy ${i + 1} failed: ${lastError}`);
      }
    }

    return {
      success: false,
      content: '',
      error: `All extraction strategies failed. Last error: ${lastError}`,
      extractionMethod: 'all_failed',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Strategy 1: Simple HTTP request with relaxed SSL
   */
  private async tryHttpFirst(url: string, options: ExtractionOptions): Promise<ExtractionResult> {
    try {
      // Try HTTP version first if HTTPS fails
      const httpUrl = url.replace('https://', 'http://');
      
      const response = await axios.get(httpUrl, {
        timeout: options.timeout || this.defaultTimeout,
        headers: {
          'User-Agent': options.userAgent || this.defaultUserAgent,
          ...options.customHeaders
        },
        maxRedirects: options.maxRedirects || 5,
        validateStatus: (status) => status < 400,
      });

      const content = this.extractTextFromHtml(response.data);
      const title = this.extractTitle(response.data);
      const links = this.extractLinks(response.data, url);

      return {
        success: true,
        content,
        title,
        links,
        extractionMethod: 'http_first',
        processingTime: 0,
        metadata: {
          statusCode: response.status,
          contentType: response.headers['content-type'],
          contentLength: response.data.length
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'HTTP request failed',
        extractionMethod: 'http_first',
        processingTime: 0
      };
    }
  }

  /**
   * Strategy 2: Node.js HTTPS with custom SSL configuration
   */
  private async tryNodeHttps(url: string, options: ExtractionOptions): Promise<ExtractionResult> {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent || this.defaultUserAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ...options.customHeaders
          },
          // Relaxed SSL options
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method',
          ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
        };

        const client = isHttps ? https : http;
        
        const req = client.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const content = this.extractTextFromHtml(data);
              const title = this.extractTitle(data);
              const links = this.extractLinks(data, url);

              resolve({
                success: true,
                content,
                title,
                links,
                extractionMethod: 'node_https',
                processingTime: 0,
                metadata: {
                  statusCode: res.statusCode,
                  contentType: res.headers['content-type'],
                  contentLength: data.length
                }
              });
            } catch (error) {
              resolve({
                success: false,
                content: '',
                error: error instanceof Error ? error.message : 'Content parsing failed',
                extractionMethod: 'node_https',
                processingTime: 0
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            content: '',
            error: error.message,
            extractionMethod: 'node_https',
            processingTime: 0
          });
        });

        req.setTimeout(options.timeout || this.defaultTimeout, () => {
          req.destroy();
          resolve({
            success: false,
            content: '',
            error: 'Request timeout',
            extractionMethod: 'node_https',
            processingTime: 0
          });
        });

        req.end();
      } catch (error) {
        resolve({
          success: false,
          content: '',
          error: error instanceof Error ? error.message : 'Request setup failed',
          extractionMethod: 'node_https',
          processingTime: 0
        });
      }
    });
  }

  /**
   * Strategy 3: Axios with relaxed SSL agent
   */
  private async tryAxiosSSL(url: string, options: ExtractionOptions): Promise<ExtractionResult> {
    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method',
        ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
      });

      const config: AxiosRequestConfig = {
        timeout: options.timeout || this.defaultTimeout,
        httpsAgent,
        headers: {
          'User-Agent': options.userAgent || this.defaultUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          ...options.customHeaders
        },
        maxRedirects: options.maxRedirects || 5,
        validateStatus: (status) => status < 400,
      };

      const response = await axios.get(url, config);
      
      const content = this.extractTextFromHtml(response.data);
      const title = this.extractTitle(response.data);
      const links = this.extractLinks(response.data, url);

      return {
        success: true,
        content,
        title,
        links,
        extractionMethod: 'axios_ssl',
        processingTime: 0,
        metadata: {
          statusCode: response.status,
          contentType: response.headers['content-type'],
          contentLength: response.data.length
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Axios SSL request failed',
        extractionMethod: 'axios_ssl',
        processingTime: 0
      };
    }
  }

  /**
   * Strategy 4: Headless browser for JavaScript-heavy sites
   */
  private async tryHeadlessBrowser(url: string, options: ExtractionOptions): Promise<ExtractionResult> {
    let page: Page | null = null;
    
    try {
      await this.initializeBrowser();
      
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      page = await this.browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent(options.userAgent || this.defaultUserAgent);
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Set extra headers if provided
      if (options.customHeaders) {
        await page.setExtraHTTPHeaders(options.customHeaders);
      }

      // Navigate to page with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || this.defaultTimeout
      });

      // Wait for specific selector if provided
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      } else {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      }

      // Extract content
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer, aside');
        scripts.forEach(el => el.remove());
        
        // Get main content
        const main = document.querySelector('main, article, .content, #content, .main');
        if (main) {
          return main.textContent?.trim() || '';
        }
        
        return document.body.textContent?.trim() || '';
      });

      const title = await page.title();
      
      // Get all links
      const links = await page.evaluate(() => {
        const linkElements = document.querySelectorAll('a[href]');
        return Array.from(linkElements).map(link => (link as HTMLAnchorElement).href);
      });

      let screenshots: string[] = [];
      if (options.enableScreenshots) {
        const screenshot = await page.screenshot({ 
          fullPage: true, 
          type: 'png' 
        });
        screenshots = [screenshot.toString('base64')];
      }

      return {
        success: true,
        content: content || '',
        title,
        links,
        screenshots,
        extractionMethod: 'headless_browser',
        processingTime: 0,
        metadata: {
          url: page.url(),
          viewport: await page.viewportSize()
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Browser extraction failed',
        extractionMethod: 'headless_browser',
        processingTime: 0
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Strategy 5: Fallback extraction with minimal requirements
   */
  private async tryFallbackExtraction(url: string, options: ExtractionOptions): Promise<ExtractionResult> {
    try {
      // Very basic fetch with minimal configuration
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': options.userAgent || this.defaultUserAgent,
        },
        // @ts-ignore - Node.js specific options
        agent: false,
        timeout: options.timeout || this.defaultTimeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const content = this.extractTextFromHtml(html);
      const title = this.extractTitle(html);
      const links = this.extractLinks(html, url);

      return {
        success: true,
        content,
        title,
        links,
        extractionMethod: 'fallback_fetch',
        processingTime: 0,
        metadata: {
          statusCode: response.status,
          contentType: response.headers.get('content-type'),
          contentLength: html.length
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Fallback extraction failed',
        extractionMethod: 'fallback_fetch',
        processingTime: 0
      };
    }
  }

  /**
   * Extract clean text from HTML
   */
  private extractTextFromHtml(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .nav, .navigation, .sidebar, .ads, .advertisement').remove();
      
      // Try to find main content area
      const mainSelectors = ['main', 'article', '.content', '#content', '.main-content', '.post-content', '.entry-content'];
      let content = '';
      
      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 100) {
            break;
          }
        }
      }
      
      // Fallback to body if no main content found
      if (!content || content.length < 100) {
        content = $('body').text().trim();
      }
      
      // Clean up whitespace
      return content.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Failed to extract text from HTML:', error);
      return '';
    }
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Try multiple title sources
      const titleSources = [
        $('title').text(),
        $('meta[property="og:title"]').attr('content'),
        $('meta[name="twitter:title"]').attr('content'),
        $('h1').first().text()
      ];
      
      for (const title of titleSources) {
        if (title && title.trim().length > 0) {
          return title.trim();
        }
      }
      
      return 'Untitled Document';
    } catch (error) {
      return 'Untitled Document';
    }
  }

  /**
   * Extract links from HTML
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    try {
      const $ = cheerio.load(html);
      const links: string[] = [];
      const baseUrlObj = new URL(baseUrl);
      
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).toString();
            // Only include links from the same domain
            const linkUrl = new URL(absoluteUrl);
            if (linkUrl.hostname === baseUrlObj.hostname) {
              links.push(absoluteUrl);
            }
          } catch (error) {
            // Skip invalid URLs
          }
        }
      });
      
      return [...new Set(links)]; // Remove duplicates
    } catch (error) {
      return [];
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract content from multiple URLs with crawling
   */
  async extractFromMultipleUrls(
    urls: string[], 
    options: ExtractionOptions & { maxDepth?: number } = {}
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    const visited = new Set<string>();
    const queue = urls.map(url => ({ url, depth: 0 }));
    const maxDepth = options.maxDepth || 1;

    while (queue.length > 0 && results.length < 100) { // Limit total results
      const { url, depth } = queue.shift()!;
      
      if (visited.has(url) || depth > maxDepth) {
        continue;
      }
      
      visited.add(url);
      
      try {
        const result = await this.extractContent(url, options);
        results.push(result);
        
        // Add linked pages to queue if within depth limit
        if (result.success && result.links && depth < maxDepth) {
          for (const link of result.links.slice(0, 10)) { // Limit links per page
            if (!visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to extract from ${url}:`, error);
      }
    }

    return results;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton instance
export const contentExtractor = new RobustContentExtractor();
export default contentExtractor;
