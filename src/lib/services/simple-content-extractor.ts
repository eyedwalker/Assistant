/**
 * Simple Content Extractor
 * Reliable URL content extraction without browser dependencies
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ExtractionResult } from '@/types';

interface ExtractionOptions {
  timeout?: number;
  userAgent?: string;
  maxRedirects?: number;
}

class SimpleContentExtractor {
  private readonly defaultTimeout = 30000;
  private readonly defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async extractContent(url: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🌐 Extracting content from:', url);
      
      // Make HTTP request
      const response = await axios.get(url, {
        timeout: options.timeout || this.defaultTimeout,
        headers: {
          'User-Agent': options.userAgent || this.defaultUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: options.maxRedirects || 5,
        validateStatus: (status) => status < 400,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Allow self-signed certificates
        })
      });

      console.log('✅ HTTP request successful, status:', response.status);

      // Parse HTML with Cheerio
      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Untitled Document';

      // Extract main content
      const content = this.extractMainContent($);
      
      // Extract links
      const links = this.extractLinks($, url);

      const result: ExtractionResult = {
        success: true,
        content,
        title,
        links,
        extractionMethod: 'simple_http',
        processingTime: Date.now() - startTime,
        metadata: {
          statusCode: response.status,
          contentType: response.headers['content-type'] || 'unknown',
          contentLength: response.data.length,
          url: url
        }
      };

      console.log('✅ Content extracted successfully:', {
        title,
        contentLength: content.length,
        linksCount: links.length
      });

      return result;

    } catch (error) {
      console.error('❌ Content extraction failed:', error);
      
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: 'failed',
        processingTime: Date.now() - startTime
      };
    }
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement').remove();
    
    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '#content',
      '#main',
      '.container'
    ];

    let content = '';
    
    // Try each selector until we find substantial content
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > content.length) {
          content = text;
        }
      }
    }

    // If no main content found, extract from body
    if (content.length < 100) {
      content = $('body').text().trim();
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim();

    return content;
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          if (absoluteUrl.startsWith('http') && !links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });

    return links.slice(0, 20); // Limit to first 20 links
  }
}

// Export singleton instance
const simpleContentExtractor = new SimpleContentExtractor();
export default simpleContentExtractor;
