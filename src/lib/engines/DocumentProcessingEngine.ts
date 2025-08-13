/**
 * DocumentProcessingEngine - VBD Engine Layer
 * 
 * Core document processing algorithms - stable, reusable components
 * Contains pure business logic with no external dependencies
 */

export interface ProcessingResult {
  success: boolean;
  content?: string;
  metadata?: {
    title?: string;
    wordCount?: number;
    language?: string;
    extractedAt: Date;
  };
  error?: string;
}

export interface ProcessingOptions {
  maxLength?: number;
  includeMetadata?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export class DocumentProcessingEngine {
  /**
   * Core content extraction algorithm
   * Pure function - no side effects, no external dependencies
   */
  static extractContent(rawContent: string, options: ProcessingOptions = {}): ProcessingResult {
    try {
      if (!rawContent || rawContent.trim().length === 0) {
        return {
          success: false,
          error: 'Empty content provided'
        };
      }

      // Core extraction logic
      const cleanedContent = this.cleanContent(rawContent);
      const truncatedContent = this.truncateContent(cleanedContent, options.maxLength);
      
      const result: ProcessingResult = {
        success: true,
        content: truncatedContent
      };

      // Add metadata if requested
      if (options.includeMetadata) {
        result.metadata = this.extractMetadata(cleanedContent);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Core content cleaning algorithm
   */
  private static cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\.\,\!\?\-\:\;]/g, '') // Remove special characters
      .trim();
  }

  /**
   * Core content truncation algorithm
   */
  private static truncateContent(content: string, maxLength?: number): string {
    if (!maxLength || content.length <= maxLength) {
      return content;
    }

    // Truncate at word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  /**
   * Core metadata extraction algorithm
   */
  private static extractMetadata(content: string) {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    
    return {
      wordCount: words.length,
      language: this.detectLanguage(content),
      extractedAt: new Date()
    };
  }

  /**
   * Core language detection algorithm (simplified)
   */
  private static detectLanguage(content: string): string {
    // Simplified language detection - could be enhanced with ML
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = content.toLowerCase().split(/\s+/);
    const englishMatches = words.filter(word => englishWords.includes(word)).length;
    
    return englishMatches > words.length * 0.1 ? 'en' : 'unknown';
  }

  /**
   * Core content validation algorithm
   */
  static validateContent(content: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!content || content.trim().length === 0) {
      issues.push('Content is empty');
    }

    if (content.length < 10) {
      issues.push('Content is too short (minimum 10 characters)');
    }

    if (content.length > 1000000) {
      issues.push('Content is too long (maximum 1MB)');
    }

    // Check for potential security issues
    if (this.containsSuspiciousContent(content)) {
      issues.push('Content contains potentially suspicious elements');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Core security validation algorithm
   */
  private static containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Core content chunking algorithm for AI processing
   */
  static chunkContent(content: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    if (content.length <= chunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunk = content.substring(start, end);

      // Try to break at sentence boundary
      if (end < content.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + chunkSize * 0.5) {
          chunk = content.substring(start, breakPoint + 1);
          start = breakPoint + 1 - overlap;
        } else {
          start = end - overlap;
        }
      } else {
        start = end;
      }

      chunks.push(chunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }
}
