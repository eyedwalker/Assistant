/**
 * ConversationEngine - VBD Engine Layer
 * 
 * Core conversational AI algorithms - stable, reusable components
 * Contains pure business logic with no external dependencies
 */

export interface ConversationContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  documents?: string[];
  preferences?: {
    responseLength: 'brief' | 'detailed';
    includeReferences: boolean;
    language: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sources?: string[];
    confidence?: number;
    processingTime?: number;
  };
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ResponseGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  includeContext?: boolean;
  contextWindow?: number;
  useRAG?: boolean;
}

export class ConversationEngine {
  /**
   * Core algorithm for building conversation context
   * Pure function - no side effects, no external dependencies
   */
  static buildConversationContext(
    messages: Message[],
    documents: string[] = [],
    options: { contextWindow?: number; maxContextLength?: number } = {}
  ): string {
    const contextWindow = options.contextWindow || 10;
    const maxContextLength = options.maxContextLength || 4000;

    // Get recent messages within context window
    const recentMessages = messages
      .slice(-contextWindow)
      .filter(msg => msg.content.trim().length > 0);

    // Build context string
    let context = '';
    
    // Add document context if available
    if (documents.length > 0) {
      context += '=== RELEVANT KNOWLEDGE BASE CONTENT ===\n';
      documents.forEach((doc, index) => {
        // Include more content from each document (up to 1000 chars each)
        const docContent = doc.substring(0, 1000);
        context += `\n[Document ${index + 1}]\n${docContent}\n`;
      });
      context += '\n=== END OF KNOWLEDGE BASE ===\n\n';
    }

    // Add conversation history
    context += 'Conversation history:\n';
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      context += `${role}: ${msg.content}\n`;
    });

    // Truncate if too long
    if (context.length > maxContextLength) {
      context = context.substring(0, maxContextLength) + '...[truncated]';
    }

    return context;
  }

  /**
   * Core algorithm for message validation and preprocessing
   */
  static validateAndPreprocessMessage(content: string): {
    isValid: boolean;
    processedContent: string;
    issues: string[];
  } {
    const issues: string[] = [];
    let processedContent = content;

    // Basic validation
    if (!content || content.trim().length === 0) {
      issues.push('Message is empty');
      return { isValid: false, processedContent: '', issues };
    }

    if (content.length > 10000) {
      issues.push('Message is too long (maximum 10,000 characters)');
    }

    // Preprocessing
    processedContent = content
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\.\,\!\?\-\:\;\(\)\[\]]/g, ''); // Remove special characters

    // Security checks
    if (this.containsSuspiciousContent(processedContent)) {
      issues.push('Message contains potentially suspicious content');
    }

    // PHI detection (basic patterns)
    if (this.containsPotentialPHI(processedContent)) {
      issues.push('Message may contain PHI - please review');
    }

    return {
      isValid: issues.length === 0,
      processedContent,
      issues
    };
  }

  /**
   * Core algorithm for generating message ID
   */
  static generateMessageId(userId: string, timestamp: Date = new Date()): string {
    const timeStr = timestamp.getTime().toString();
    const userHash = this.simpleHash(userId);
    const random = Math.random().toString(36).substr(2, 6);
    
    return `msg_${timeStr}_${userHash}_${random}`;
  }

  /**
   * Core algorithm for session management
   */
  static createSession(userId: string, tenantId: string): ConversationSession {
    const sessionId = this.generateSessionId(userId);
    const now = new Date();

    return {
      sessionId,
      userId,
      tenantId,
      messages: [],
      context: {
        userId,
        tenantId,
        sessionId,
        preferences: {
          responseLength: 'detailed',
          includeReferences: true,
          language: 'en'
        }
      },
      createdAt: now,
      updatedAt: now,
      isActive: true
    };
  }

  /**
   * Core algorithm for adding message to session
   */
  static addMessageToSession(
    session: ConversationSession,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Message['metadata']
  ): ConversationSession {
    const message: Message = {
      id: this.generateMessageId(session.userId),
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    return {
      ...session,
      messages: [...session.messages, message],
      updatedAt: new Date()
    };
  }

  /**
   * Core algorithm for session cleanup and optimization
   */
  static optimizeSession(session: ConversationSession, maxMessages: number = 50): ConversationSession {
    if (session.messages.length <= maxMessages) {
      return session;
    }

    // Keep first message (usually contains important context) and recent messages
    const firstMessage = session.messages[0];
    const recentMessages = session.messages.slice(-(maxMessages - 1));

    return {
      ...session,
      messages: [firstMessage, ...recentMessages],
      updatedAt: new Date()
    };
  }

  /**
   * Core algorithm for extracting keywords from conversation
   */
  static extractConversationKeywords(messages: Message[]): string[] {
    const allContent = messages
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();

    // Simple keyword extraction (could be enhanced with NLP)
    const words = allContent
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Count frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Return top keywords
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Core algorithm for conversation sentiment analysis
   */
  static analyzeConversationSentiment(messages: Message[]): {
    overall: 'positive' | 'negative' | 'neutral';
    userSentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  } {
    const userMessages = messages.filter(msg => msg.role === 'user');
    
    // Simple sentiment analysis (could be enhanced with ML)
    const positiveWords = ['good', 'great', 'excellent', 'helpful', 'thanks', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'useless', 'wrong', 'error'];

    let positiveCount = 0;
    let negativeCount = 0;
    let totalWords = 0;

    userMessages.forEach(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      totalWords += words.length;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
      });
    });

    const sentimentScore = (positiveCount - negativeCount) / Math.max(totalWords, 1);
    const confidence = Math.min((positiveCount + negativeCount) / Math.max(totalWords, 1), 1);

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (sentimentScore > 0.01) sentiment = 'positive';
    else if (sentimentScore < -0.01) sentiment = 'negative';

    return {
      overall: sentiment,
      userSentiment: sentiment,
      confidence
    };
  }

  /**
   * Core algorithm for conversation summarization
   */
  static summarizeConversation(messages: Message[], maxLength: number = 200): string {
    if (messages.length === 0) return 'No conversation to summarize';

    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    const topics = this.extractConversationKeywords(messages);
    const sentiment = this.analyzeConversationSentiment(messages);

    let summary = `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} assistant responses. `;
    
    if (topics.length > 0) {
      summary += `Main topics: ${topics.slice(0, 3).join(', ')}. `;
    }
    
    summary += `Overall sentiment: ${sentiment.overall}.`;

    // Truncate if needed
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  // PRIVATE HELPER METHODS

  /**
   * Generate session ID
   */
  private static generateSessionId(userId: string): string {
    const timestamp = Date.now().toString();
    const userHash = this.simpleHash(userId);
    const random = Math.random().toString(36).substr(2, 8);
    
    return `session_${timestamp}_${userHash}_${random}`;
  }

  /**
   * Simple hash function
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check for suspicious content
   */
  private static containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for potential PHI
   */
  private static containsPotentialPHI(content: string): boolean {
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Date
      /\bMR\d+\b/i, // Medical record number
    ];

    return phiPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ];

    return stopWords.includes(word.toLowerCase());
  }
}
