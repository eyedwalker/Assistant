/**
 * ConversationManager - VBD Manager Layer
 * 
 * Orchestrates conversational AI workflow and applies business rules
 * Handles volatile, domain-specific logic for eyecare professionals
 */

import { ConversationEngine, ConversationSession, Message, ConversationContext } from '../engines/ConversationEngine';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { BedrockAccessor } from '../accessors/BedrockAccessor';
import { MongoVectorAccessor } from '../accessors/MongoVectorAccessor';
import EmbeddingService from '../services/embedding-service';
import { connectToDatabase } from '../services/mongodb-connection';

export interface ChatRequest {
  message: string;
  userId: string;
  tenantId: string;
  sessionId?: string;
  accessLevel: string;
  context?: {
    documentIds?: string[];
    previousMessages?: number;
    pageContext?: any;
  };
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  messageId: string;
  confidence: number;
  sources?: string[];
  followUpQuestions?: string[];
  processingTime: number;
  metadata?: {
    phiDetected?: boolean;
    sentiment?: string;
    keywords?: string[];
  };
}

export interface SessionSummary {
  sessionId: string;
  messageCount: number;
  duration: number;
  topics: string[];
  sentiment: string;
  lastActivity: Date;
}

export class ConversationManager {
  private mongoVectorAccessor: MongoVectorAccessor;
  private embeddingService: EmbeddingService;
  private aiAccessor: AnthropicAccessor | BedrockAccessor;

  constructor(
    private mongoAccessor: MongoDBAccessor,
    aiAccessor?: AnthropicAccessor | BedrockAccessor
  ) {
    // Use Bedrock if configured, otherwise fall back to Anthropic
    if (process.env.USE_BEDROCK === 'true') {
      this.aiAccessor = new BedrockAccessor();
    } else if (aiAccessor) {
      this.aiAccessor = aiAccessor;
    } else {
      this.aiAccessor = new AnthropicAccessor();
    }
    this.mongoVectorAccessor = new MongoVectorAccessor();
    this.embeddingService = new EmbeddingService();
    
    // FIXED: Initialize MongoDB connection for vector search - fire and forget, don't block constructor
    this.initializeVectorSearch().catch(err => 
      console.error('Vector search initialization failed, continuing without it:', err)
    );
  }

  /**
   * Initialize MongoDB Vector Search connection - FIXED: Ensure database connection
   */
  private async initializeVectorSearch(): Promise<void> {
    try {
      console.log('🔧 Initializing MongoDB Vector Search connection...');
      
      // FIXED: Connect to MongoDB first before initializing index
      await this.mongoVectorAccessor.connect();
      await this.mongoVectorAccessor.initializeIndex();
      
      console.log('✅ MongoDB Vector Search connection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MongoDB Vector Search:', error);
      // Don't throw error, allow ConversationManager to continue without vector search
    }
  }

  /**
   * Process chat message with full business logic orchestration
   */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Validate access and apply business rules
      await this.validateChatAccess(request);

      // Step 2: Validate and preprocess message using engine
      const validation = ConversationEngine.validateAndPreprocessMessage(request.message);
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.issues.join(', ')}`);
      }

      // Step 3: Get or create session
      const session = await this.getOrCreateSession(request);

      // Step 4: Apply business rules for message limits
      this.validateMessageLimits(session, request.accessLevel);

      // Step 5: Build context for AI response
      const context = await this.buildResponseContext(session, request);

      // Step 6: Generate AI response
      const aiResponse = await this.generateAIResponse(validation.processedContent, context, session);

      // Step 7: Create and store messages
      const userMessage = await this.storeUserMessage(session, validation.processedContent);
      const assistantMessage = await this.storeAssistantMessage(session, aiResponse);

      // Step 8: Update session and apply retention policies
      await this.updateSession(session, request.accessLevel);

      // Step 9: Apply business rules for response enhancement
      const enhancedResponse = await this.enhanceResponse(aiResponse, request);

      const processingTime = Date.now() - startTime;

      return {
        message: enhancedResponse.message,
        sessionId: session.sessionId,
        messageId: assistantMessage.id,
        confidence: enhancedResponse.confidence,
        sources: enhancedResponse.sources,
        followUpQuestions: enhancedResponse.followUpQuestions,
        processingTime,
        metadata: {
          phiDetected: validation.issues.some(issue => issue.includes('PHI')),
          sentiment: ConversationEngine.analyzeConversationSentiment(session.messages).overall,
          keywords: ConversationEngine.extractConversationKeywords([userMessage])
        }
      };

    } catch (error) {
      throw new Error(`Chat processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation history with business rules applied
   */
  async getConversationHistory(
    userId: string,
    tenantId: string,
    sessionId?: string,
    limit: number = 50
  ): Promise<ConversationSession[]> {
    // Business rule: Users can only access their own conversations
    const sessions = await this.mongoAccessor.findConversationSessions(userId, tenantId, sessionId);
    
    // Business rule: Apply data retention policies
    const retentionDays = this.getRetentionDays(tenantId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return sessions
      .filter(session => session.createdAt >= cutoffDate)
      .slice(0, limit)
      .map(session => this.sanitizeSessionForUser(session));
  }

  /**
   * Get session summary with analytics
   */
  async getSessionSummary(sessionId: string, userId: string, tenantId: string): Promise<SessionSummary | null> {
    const session = await this.mongoAccessor.findConversationSession(sessionId);
    
    if (!session || session.userId !== userId || session.tenantId !== tenantId) {
      return null;
    }

    const duration = session.updatedAt.getTime() - session.createdAt.getTime();
    const topics = ConversationEngine.extractConversationKeywords(session.messages);
    const sentiment = ConversationEngine.analyzeConversationSentiment(session.messages);

    return {
      sessionId: session.sessionId,
      messageCount: session.messages.length,
      duration: Math.round(duration / 1000), // Convert to seconds
      topics: topics.slice(0, 5),
      sentiment: sentiment.overall,
      lastActivity: session.updatedAt
    };
  }

  /**
   * End conversation session
   */
  async endSession(sessionId: string, userId: string, tenantId: string): Promise<boolean> {
    const session = await this.mongoAccessor.findConversationSession(sessionId);
    
    if (!session || session.userId !== userId || session.tenantId !== tenantId) {
      return false;
    }

    // Generate final summary
    const summary = ConversationEngine.summarizeConversation(session.messages);
    
    // Update session as inactive with summary
    await this.mongoAccessor.updateConversationSession(sessionId, {
      isActive: false,
      summary,
      endedAt: new Date()
    });

    return true;
  }

  /**
   * Business rule: Validate user access permissions for chat
   */
  private async validateChatAccess(request: ChatRequest): Promise<void> {
    // Search by either userId or email to handle both cases
    const users = await this.mongoAccessor.find('users', { 
      $or: [
        { userId: request.userId },
        { email: `${request.userId}@demo.com` }
      ]
    });
    let user = users[0];
    
    // Auto-create demo users if they don't exist (including test users)
    if (!user && (request.userId.startsWith('demo-') || request.userId.startsWith('test-'))) {
      const demoUser = {
        userId: request.userId,
        name: `Demo User ${request.userId.split('-').pop()}`,
        email: `${request.userId}@demo.com`,
        role: 'user',
        tenantId: request.tenantId,
        accessLevel: request.accessLevel,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      try {
        await this.mongoAccessor.create('users', demoUser);
        user = demoUser;
        console.log(`Auto-created demo user for chat: ${request.userId}`);
      } catch (error: any) {
        console.error('Failed to create demo user for chat:', error);
        // If it's a duplicate key error, the user already exists, so find it
        if (error.code === 11000) {
          const foundUsers = await this.mongoAccessor.find('users', { 
            $or: [
              { userId: request.userId },
              { email: `${request.userId}@demo.com` }
            ]
          });
          user = foundUsers[0];
          if (user) {
            console.log(`Found existing demo user: ${request.userId}`);
          }
        }
      }
    }
    
    if (!user) {
      throw new Error('User not found and could not be created');
    }

    // Allow demo/test users to have flexible tenant access
    const isDemoUser = request.userId.startsWith('demo-') || request.userId.startsWith('test-');
    if (!isDemoUser && user.tenantId !== request.tenantId) {
      throw new Error('Tenant mismatch');
    }

    // Business rule: Check if user has chat permissions
    if (!this.hasChatPermission(user.role, request.accessLevel)) {
      throw new Error('Insufficient permissions for chat access');
    }

    // Business rule: Check tenant chat limits (simplified for demo)
    // TODO: Implement proper tenant limits tracking
    const tenantDocs = await this.mongoAccessor.find('tenants', { tenantId: request.tenantId });
    const tenant = tenantDocs[0];
    
    // For now, skip limit checking for demo purposes
    if (tenant && tenant.maxChatMessages) {
      const sessionsThisMonth = await this.mongoAccessor.count('conversation_sessions', {
        tenantId: request.tenantId,
        createdAt: { $gte: new Date(new Date().setDate(1)) }
      });
      
      if (sessionsThisMonth >= tenant.maxChatMessages) {
        throw new Error('Tenant chat message limit exceeded');
      }
    }
  }

  /**
   * Business rule: Validate message limits based on access level
   */
  private validateMessageLimits(session: ConversationSession, accessLevel: string): void {
    const messageLimits = {
      PUBLIC: 10,
      ACCOUNT: 50,
      COMPANY: 200,
      OFFICE: 1000
    };

    const limit = messageLimits[accessLevel as keyof typeof messageLimits];
    
    if (session.messages.length >= limit) {
      throw new Error(`Message limit exceeded for ${accessLevel} access level`);
    }
  }

  /**
   * Get or create conversation session
   */
  private async getOrCreateSession(request: ChatRequest): Promise<ConversationSession> {
    if (request.sessionId) {
      const existingSession = await this.mongoAccessor.findConversationSession(request.sessionId);
      
      if (existingSession && existingSession.userId === request.userId && existingSession.isActive) {
        return existingSession;
      }
    }

    // Create new session
    const newSession = ConversationEngine.createSession(request.userId, request.tenantId);
    await this.mongoAccessor.createConversationSession(newSession);
    
    return newSession;
  }

  /**
   * Build context for AI response
   */
  private async buildResponseContext(session: ConversationSession, request: ChatRequest): Promise<string> {
    let contextDocuments: string[] = [];

    // Business rule: Include document context for higher access levels
    if (['COMPANY', 'OFFICE'].includes(request.accessLevel) && request.context?.documentIds) {
      contextDocuments = await this.getDocumentContext(request.context.documentIds, request.tenantId);
    }

    // RAG: Retrieve relevant processed content based on user's message
    const relevantContent = await this.retrieveRelevantContent(request.message, request.userId, request.tenantId, request.accessLevel);
    if (relevantContent.length > 0) {
      contextDocuments.push(...relevantContent);
    }

    // Build conversation context using engine
    return ConversationEngine.buildConversationContext(
      session.messages,
      contextDocuments,
      {
        contextWindow: this.getContextWindow(request.accessLevel),
        maxContextLength: this.getMaxContextLength(request.accessLevel)
      }
    );
  }

  /**
   * Generate AI response using accessor
   */
  private async generateAIResponse(message: string, context: string, session: ConversationSession) {
    const conversationHistory = session.messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    return await this.aiAccessor.generateChatResponse(message, context, conversationHistory);
  }

  /**
   * Store user message
   */
  private async storeUserMessage(session: ConversationSession, content: string): Promise<Message> {
    const message: Message = {
      id: ConversationEngine.generateMessageId(session.userId),
      role: 'user',
      content,
      timestamp: new Date()
    };

    await this.mongoAccessor.addMessageToSession(session.sessionId, message);
    return message;
  }

  /**
   * Store assistant message
   */
  private async storeAssistantMessage(session: ConversationSession, aiResponse: any): Promise<Message> {
    const message: Message = {
      id: ConversationEngine.generateMessageId(session.userId),
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date(),
      metadata: {
        confidence: aiResponse.confidence,
        sources: aiResponse.sources,
        processingTime: Date.now()
      }
    };

    await this.mongoAccessor.addMessageToSession(session.sessionId, message);
    return message;
  }

  /**
   * Update session with business rules
   */
  private async updateSession(session: ConversationSession, accessLevel: string): Promise<void> {
    // Business rule: Optimize session if it gets too long
    const maxMessages = this.getMaxMessagesPerSession(accessLevel);
    const optimizedSession = ConversationEngine.optimizeSession(session, maxMessages);

    await this.mongoAccessor.updateConversationSession(session.sessionId, {
      messages: optimizedSession.messages,
      updatedAt: new Date()
    });

    // Business rule: Update tenant usage
    await this.mongoAccessor.updateTenantUsage(session.tenantId, {
      chatMessagesThisMonth: 1 // Increment by 1
    });
  }

  /**
   * Enhance response with business-specific features
   */
  private async enhanceResponse(aiResponse: any, request: ChatRequest) {
    // Business rule: Add eyecare-specific enhancements for higher access levels
    if (['COMPANY', 'OFFICE'].includes(request.accessLevel)) {
      // Add source information for enhanced responses
      aiResponse.sources = aiResponse.sources || [];
      aiResponse.sources.push('AI Assistant');
    }

    // Add RAG sources for all access levels (not just COMPANY/OFFICE)
    if (request.accessLevel !== 'PUBLIC') {
      const ragSources = await this.retrieveRelevantContent(request.message, request.userId, request.tenantId, request.accessLevel);
      if (ragSources.length > 0) {
        aiResponse.sources = aiResponse.sources || [];
        // Add document titles as sources
        ragSources.forEach((content, index) => {
          const title = content.split(':')[0] || `Document ${index + 1}`;
          aiResponse.sources.push({
            title: title.trim(),
            type: 'document',
            relevance: 'high'
          });
        });
      }
    }

    return aiResponse;
  }

  /**
   * Get document context for RAG - FIXED: Use contents collection instead of S3-referenced documents
   */
  private async getDocumentContext(documentIds: string[], tenantId: string): Promise<string[]> {
    console.log('🔍 Getting document context for RAG from contents collection (not S3)...');
    
    // FIXED: Query contents collection instead of documents collection to avoid S3 conflicts
    const contents = await this.mongoAccessor.find('contents', {
      documentId: { $in: documentIds },
      tenantId: tenantId
    });
    
    console.log(`📊 Found ${contents.length} content documents for RAG context`);
    
    return contents.map(content => {
      const title = content.title || content.metadata?.title || 'Untitled Document';
      const text = content.content?.substring(0, 500) || 'No content available';
      return `${title}: ${text}`;
    });
  }

  /**
   * Retrieve relevant content for RAG using direct MongoDB connection (bypass failing MongoDBAccessor)
   */
  private async retrieveRelevantContent(message: string, userId: string, tenantId: string, accessLevel: string): Promise<string[]> {
    try {
      console.log('🔍 Retrieving relevant content for RAG...');

      // Use working mongodb-connection.ts instead of failing MongoDBAccessor
      try {
        console.log('🚀 Using direct MongoDB connection for RAG...');
        const { db } = await connectToDatabase();
        
        if (!db) {
          console.warn('❌ MongoDB connection failed, no RAG content');
          return [];
        }
        
        // Simple text search in documents collection
        const searchTerms = message.toLowerCase().split(' ').filter((term: string) => term.length > 2);
        const searchRegex = searchTerms.map((term: string) => new RegExp(term, 'i'));
        
        const documents = await db.collection('documents').find({
          $or: [
            { title: { $in: searchRegex } },
            { extractedText: { $in: searchRegex } },
            { aiAnalysis: { $in: searchRegex } },
            { content: { $in: searchRegex } }
          ],
          processingStatus: 'completed'
        }).limit(5).toArray();
        
        console.log(`📊 Found ${documents.length} relevant documents for RAG`);
        
        const relevantContent = documents.map(doc => {
          const title = doc.title || 'Untitled Document';
          const content = doc.extractedText || doc.aiAnalysis || doc.content || '';
          return `${title}: ${content.substring(0, 300)}...`;
        });
        
        return relevantContent;
        
      } catch (mongoError) {
        console.error('❌ MongoDB RAG search failed:', mongoError);
        return [];
      }

      // Fallback to MongoDB text search - Search BOTH processed_content AND documents collections
      console.log('🔍 Using MongoDB text search as fallback...');
      
      const searchTerm = message.toLowerCase();
      let relevantDocs: any[] = [];
      
      // Search documents collection (where videos are stored)
      try {
        const videoResults = await this.mongoAccessor.find('documents', {
          contentType: 'video',
          accessLevel: { $in: this.getAccessibleLevels(accessLevel) },
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { extractedText: { $regex: searchTerm, $options: 'i' } },
            { aiAnalysis: { $regex: searchTerm, $options: 'i' } }
          ]
        }, { limit: 3 });
        
        relevantDocs.push(...videoResults);
        console.log(`📹 Found ${videoResults.length} video matches`);
      } catch (error) {
        console.log('No video search results');
      }
      
      // Search processed_content collection (other content)
      try {
        const contentResults = await this.mongoAccessor.find('processed_content', {
          accessLevel: { $in: this.getAccessibleLevels(accessLevel) },
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { content: { $regex: searchTerm, $options: 'i' } }
          ]
        }, { limit: 2 });
        
        relevantDocs.push(...contentResults);
        console.log(`📄 Found ${contentResults.length} document matches`);
      } catch (error) {
        console.log('No document search results');
      }

      console.log(`📊 Total search matches: ${relevantDocs.length}`);
      
      if (relevantDocs.length > 0) {
        console.log('📝 First result title:', relevantDocs[0].title);
        console.log('📝 First result type:', relevantDocs[0].contentType || 'document');
      }

      return relevantDocs.map((doc: any) => {
        let result = `**${doc.title}**`;
        
        // Add video URL if it's a video
        if (doc.contentType === 'video' && doc.url) {
          result += `\n🎬 **Watch Video**: ${doc.url}`;
        }
        
        result += `\nSummary: ${doc.summary || doc.aiAnalysis || 'Training content about eyecare procedures'}`;
        
        // Add content preview
        const content = doc.extractedText || doc.content || '';
        if (content) {
          result += `\nContent: ${content.substring(0, 400)}...`;
        }
        
        return result + '\n';
      });

    } catch (error) {
      console.error('❌ Failed to retrieve relevant content:', error);
      return [];
    }
  }

  /**
   * Get accessible access levels based on current access level
   */
  private getAccessibleLevels(accessLevel: string): string[] {
    switch (accessLevel) {
      case 'PUBLIC':
        return ['PUBLIC'];
      case 'ACCOUNT':
        return ['PUBLIC', 'ACCOUNT'];
      case 'COMPANY':
        return ['PUBLIC', 'ACCOUNT', 'COMPANY'];
      case 'OFFICE':
        return ['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE'];
      default:
        return ['PUBLIC'];
    }
  }

  /**
   * Business rule: Get context window based on access level
   */
  private getContextWindow(accessLevel: string): number {
    const windows = {
      PUBLIC: 5,
      ACCOUNT: 10,
      COMPANY: 20,
      OFFICE: 30
    };
    return windows[accessLevel as keyof typeof windows] || 5;
  }

  /**
   * Business rule: Get max context length based on access level
   */
  private getMaxContextLength(accessLevel: string): number {
    const lengths = {
      PUBLIC: 2000,
      ACCOUNT: 4000,
      COMPANY: 8000,
      OFFICE: 16000
    };
    return lengths[accessLevel as keyof typeof lengths] || 2000;
  }

  /**
   * Business rule: Get max messages per session
   */
  private getMaxMessagesPerSession(accessLevel: string): number {
    const limits = {
      PUBLIC: 20,
      ACCOUNT: 50,
      COMPANY: 100,
      OFFICE: 200
    };
    return limits[accessLevel as keyof typeof limits] || 20;
  }

  /**
   * Business rule: Get data retention days
   */
  private getRetentionDays(tenantId: string): number {
    // Could be made configurable per tenant
    return 90; // 90 days default
  }

  /**
   * Business rule: Check chat permissions
   */
  private hasChatPermission(userRole: string, accessLevel: string): boolean {
    const permissions = {
      admin: ['PUBLIC', 'ACCOUNT', 'COMPANY', 'OFFICE'],
      manager: ['PUBLIC', 'ACCOUNT', 'COMPANY'],
      user: ['PUBLIC', 'ACCOUNT'],
      viewer: ['PUBLIC']
    };

    return permissions[userRole as keyof typeof permissions]?.includes(accessLevel) || false;
  }

  /**
   * Sanitize session data for user response
   */
  private sanitizeSessionForUser(session: ConversationSession): ConversationSession {
    // Remove sensitive metadata
    return {
      ...session,
      messages: session.messages.map(msg => ({
        ...msg,
        metadata: msg.metadata ? {
          confidence: msg.metadata.confidence,
          sources: msg.metadata.sources
          // Remove internal processing data
        } : undefined
      }))
    };
  }
}
