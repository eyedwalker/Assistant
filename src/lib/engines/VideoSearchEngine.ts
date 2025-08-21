/**
 * Video Search Engine - Finds relevant videos based on context
 */
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { Db } from 'mongodb';

export interface VideoSearchResult {
  vimeoId: string;
  name: string;
  link: string;
  thumbnail: string;
  duration: number;
  category: string;
  aiSummary: string;
  relevanceScore: number;
  keyInsights?: string[];
  transcript?: string;
}

export class VideoSearchEngine {
  constructor(private mongoAccessor: MongoDBAccessor) {}

  /**
   * Search for videos relevant to the user's query and page context
   */
  async searchVideos(
    query: string,
    pageContext?: any,
    limit: number = 3
  ): Promise<VideoSearchResult[]> {
    try {
      await this.mongoAccessor.connect();
      const db = this.mongoAccessor['db'] as Db;
      if (!db) throw new Error('Database not connected');
      const collection = db.collection('documents');
      
      // Build search criteria based on query and context
      const searchCriteria = this.buildSearchCriteria(query, pageContext);
      searchCriteria.contentType = 'video'; // Only search video documents
      
      // Find matching videos
      const videos = await collection.find(searchCriteria)
        .sort({ productConfidence: -1, createdAt: -1 })
        .limit(limit)
        .toArray();
      
      // Calculate relevance scores and format results
      return videos.map((video: any) => ({
        id: video._id,
        vimeoId: video.vimeoId,
        name: video.title,
        link: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        category: video.vspProduct,
        aiSummary: video.aiAnalysis,
        relevanceScore: this.calculateRelevance(video, query, pageContext),
        keyInsights: video.productFeatures,
        transcript: video.transcript
      })).sort((a: VideoSearchResult, b: VideoSearchResult) => b.relevanceScore - a.relevanceScore);
      
    } catch (error) {
      console.error('Video search error:', error);
      return [];
    }
  }

  /**
   * Find videos by specific category
   */
  async findVideosByCategory(category: string, limit: number = 5): Promise<VideoSearchResult[]> {
    try {
      await this.mongoAccessor.connect();
      const db = this.mongoAccessor['db'] as Db;
      if (!db) throw new Error('Database not connected');
      const collection = db.collection('documents');
      
      const videos = await collection.find({ 
        contentType: 'video',
        vspProduct: category,
        processingStatus: 'completed' 
      })
        .sort({ productConfidence: -1, createdAt: -1 })
        .limit(limit)
        .toArray();
      
      return videos.map(video => ({
        vimeoId: video.vimeoId,
        name: video.title,
        link: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        category: video.vspProduct,
        aiSummary: video.aiAnalysis,
        relevanceScore: 1.0,
        keyInsights: video.productFeatures
      }));
      
    } catch (error) {
      console.error('Category search error:', error);
      return [];
    }
  }

  /**
   * Build search criteria based on query and context
   */
  private buildSearchCriteria(query: string, pageContext?: any): any {
    const keywords = this.extractKeywords(query);
    const contextKeywords = this.extractContextKeywords(pageContext);
    const allKeywords = [...keywords, ...contextKeywords];
    
    // Create regex patterns for flexible matching
    const patterns = allKeywords.map(keyword => ({
      $regex: keyword,
      $options: 'i'
    }));
    
    // Search across multiple fields
    const searchConditions = [];
    
    if (patterns.length > 0) {
      searchConditions.push({
        $or: [
          { name: { $in: patterns } },
          { aiSummary: { $in: patterns } },
          { topics: { $elemMatch: { $in: patterns } } },
          { keyInsights: { $elemMatch: { $in: patterns } } },
          { tags: { $elemMatch: { $in: patterns } } },
          { transcript: { $in: patterns } }
        ]
      });
    }
    
    // Add category filtering based on page context
    if (pageContext?.category) {
      searchConditions.push({ category: pageContext.category });
    }
    
    // Only return completed video documents
    searchConditions.push({ processingStatus: 'completed' });
    
    return searchConditions.length > 0 
      ? { $and: searchConditions }
      : { processingStatus: 'completed', contentType: 'video' };
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'how', 'what', 'where', 'when', 'why', 'who'];
    
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    // Add specific eyecare-related keyword mapping
    const keywordMap: Record<string, string[]> = {
      'contact': ['contact lens', 'contacts', 'lens'],
      'billing': ['billing', 'claims', 'insurance'],
      'patient': ['patient', 'management', 'care'],
      'eyefinity': ['eyefinity', 'ehr', 'practice management'],
      'exam': ['examination', 'exam', 'testing']
    };
    
    const expandedKeywords: string[] = [];
    words.forEach(word => {
      expandedKeywords.push(word);
      if (keywordMap[word]) {
        expandedKeywords.push(...keywordMap[word]);
      }
    });
    
    return [...new Set(expandedKeywords)];
  }

  /**
   * Extract keywords from page context
   */
  private extractContextKeywords(pageContext?: any): string[] {
    if (!pageContext) return [];
    
    const keywords: string[] = [];
    
    // Extract from page title
    if (pageContext.pageTitle) {
      keywords.push(...this.extractKeywords(pageContext.pageTitle));
    }
    
    // Extract from page type
    if (pageContext.pageType) {
      keywords.push(pageContext.pageType.toLowerCase());
    }
    
    // Extract from selected text
    if (pageContext.selectedText) {
      keywords.push(...this.extractKeywords(pageContext.selectedText));
    }
    
    return keywords;
  }

  /**
   * Calculate relevance score for a video
   */
  private calculateRelevance(video: any, query: string, pageContext?: any): number {
    let score = 0;
    const queryKeywords = this.extractKeywords(query);
    const contextKeywords = this.extractContextKeywords(pageContext);
    const allKeywords = [...queryKeywords, ...contextKeywords];
    
    // Check title matches
    allKeywords.forEach(keyword => {
      if (video.name?.toLowerCase().includes(keyword)) {
        score += 3;
      }
    });
    
    // Check summary matches
    allKeywords.forEach(keyword => {
      if (video.aiSummary?.toLowerCase().includes(keyword)) {
        score += 2;
      }
    });
    
    // Check topics and insights
    allKeywords.forEach(keyword => {
      if (video.topics?.some((t: string) => t.toLowerCase().includes(keyword))) {
        score += 2;
      }
      if (video.keyInsights?.some((i: string) => i.toLowerCase().includes(keyword))) {
        score += 1.5;
      }
    });
    
    // Check transcript
    allKeywords.forEach(keyword => {
      if (video.transcript?.toLowerCase().includes(keyword)) {
        score += 1;
      }
    });
    
    // Boost score for category match
    if (pageContext?.category && video.category === pageContext.category) {
      score += 5;
    }
    
    // Consider confidence score
    score *= (video.confidence || 0.5);
    
    // Normalize to 0-1 range
    return Math.min(score / 20, 1);
  }

  /**
   * Get video recommendations based on viewing history
   */
  async getRecommendations(userId: string, limit: number = 3): Promise<VideoSearchResult[]> {
    try {
      await this.mongoAccessor.connect();
      const db = this.mongoAccessor['db'] as Db;
      if (!db) throw new Error('Database not connected');
      
      // Get user's viewing history (would be implemented with user tracking)
      // For now, return popular videos
      const videos = await db.collection('documents')
        .find({ 
          contentType: 'video',
          processingStatus: 'completed',
          productConfidence: { $gte: 0.7 }
        })
        .sort({ productConfidence: -1, createdAt: -1 })
        .limit(limit)
        .toArray();
      
      return videos.map(video => ({
        vimeoId: video.vimeoId,
        name: video.title,
        link: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        category: video.vspProduct,
        aiSummary: video.aiAnalysis,
        relevanceScore: video.productConfidence || 0.5,
        keyInsights: video.productFeatures
      }));
      
    } catch (error) {
      console.error('Recommendations error:', error);
      return [];
    }
  }
}
