/**
 * ConversationManager - VBD Manager Layer with AWS Integration
 * 
 * Orchestrates conversational AI workflow and applies business rules
 * Handles volatile, domain-specific logic for eyecare professionals
 * Now supports hybrid AWS/local processing
 */

import { ConversationEngine, ConversationSession, Message, ConversationContext } from '../engines/ConversationEngine';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';
import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { BedrockAccessor } from '../accessors/BedrockAccessor';
import { MongoVectorAccessor } from '../accessors/MongoVectorAccessor';
import { AWSBridgeAccessor } from '../accessors/AWSBridgeAccessor';
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
  videos?: any[];
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
  private awsBridgeAccessor: AWSBridgeAccessor;
  private embeddingService: EmbeddingService;
  private aiAccessor: AnthropicAccessor | BedrockAccessor;
  private useAWSServices: boolean = false;

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
    
    // Initialize both vector search options
    this.mongoVectorAccessor = new MongoVectorAccessor();
    this.awsBridgeAccessor = new AWSBridgeAccessor();
    this.embeddingService = new EmbeddingService();
    
    // Initialize search systems - try AWS first, fallback to MongoDB
    this.initializeSearchSystems().catch(err => 
      console.error('Search system initialization failed, using basic search:', err)
    );
  }

  /**
   * Initialize search systems - try AWS first, fallback to MongoDB
   */
  private async initializeSearchSystems(): Promise<void> {
    try {
      console.log('🔧 Initializing search systems...');
      
      // Try AWS services first
      const awsInitialized = await this.awsBridgeAccessor.initializeAWS();
      if (awsInitialized) {
        this.useAWSServices = true;
        console.log('✅ AWS services initialized - using OpenSearch for vector similarity');
        return;
      }
      
      // Fallback to MongoDB Vector Search
      console.log('🔄 AWS not available, initializing MongoDB Vector Search...');
      await this.mongoVectorAccessor.connect();
      await this.mongoVectorAccessor.initializeIndex();
      console.log('✅ MongoDB Vector Search initialized');
      
    } catch (error) {
      console.error('❌ Search system initialization failed:', error);
      // Continue without advanced vector search
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

      // Step 6: Generate AI response using AWS or local processing
      const aiResponse = await this.generateAIResponse(validation.processedContent, context, session, request);

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
        videos: enhancedResponse.videos || [],
        followUpQuestions: enhancedResponse.followUpQuestions,
        processingTime,
        metadata: {
          phiDetected: validation.issues.some(issue => issue.includes('PHI')),
          sentiment: ConversationEngine.analyzeConversationSentiment(session.messages).overall,
          keywords: ConversationEngine.extractConversationKeywords([userMessage])
        }
      };

    } catch (error) {
      console.error('❌ Chat processing error:', error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        message: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.",
        sessionId: request.sessionId || 'error-session',
        messageId: 'error-message',
        confidence: 0,
        sources: [],
        videos: [],
        followUpQuestions: [],
        processingTime,
        metadata: { phiDetected: false }
      };
    }
  }

  /**
   * Get session summaries for a user
   */
  async getSessionSummaries(userId: string, tenantId: string, accessLevel: string): Promise<SessionSummary[]> {
    try {
      const retentionDays = this.getRetentionDays(tenantId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const sessions = await this.mongoAccessor.getUserConversationSessions(userId, cutoffDate);

      return sessions.map(session => {
        const sanitized = this.sanitizeSessionForUser(session);
        return ConversationEngine.generateSessionSummary(sanitized);
      });
    } catch (error) {
      console.error('❌ Failed to get session summaries:', error);
      return [];
    }
  }

  /**
   * Validate chat access permissions
   */
  private async validateChatAccess(request: ChatRequest): Promise<void> {
    const tenant = await this.mongoAccessor.getTenantById(request.tenantId);
    if (!tenant) {
      throw new Error('Invalid tenant');
    }

    // Business rule: Check user permissions
    const user = await this.mongoAccessor.getUserById(request.userId);
    if (!user || !this.hasChatPermission(user.role, request.accessLevel)) {
      throw new Error('Insufficient permissions for this access level');
    }

    // Business rule: Check tenant usage limits
    const usage = await this.mongoAccessor.getTenantUsage(request.tenantId);
    if (usage && usage.chatMessagesThisMonth >= tenant.maxChatMessages) {
      throw new Error('Monthly chat limit exceeded');
    }
  }

  /**
   * Get or create conversation session
   */
  private async getOrCreateSession(request: ChatRequest): Promise<ConversationSession> {
    if (request.sessionId) {
      const existing = await this.mongoAccessor.getConversationSession(request.sessionId);
      if (existing) {
        return existing;
      }
    }

    // Create new session
    return await this.mongoAccessor.createConversationSession({
      userId: request.userId,
      tenantId: request.tenantId,
      accessLevel: request.accessLevel,
      messages: []
    });
  }

  /**
   * Validate message limits per session
   */
  private validateMessageLimits(session: ConversationSession, accessLevel: string): void {
    const maxMessages = this.getMaxMessagesPerSession(accessLevel);
    if (session.messages.length >= maxMessages) {
      throw new Error(`Session message limit (${maxMessages}) exceeded`);
    }
  }

  /**
   * Build AI response context from session and request
   */
  private async buildResponseContext(session: ConversationSession, request: ChatRequest): Promise<ConversationContext> {
    const contextWindow = this.getContextWindow(request.accessLevel);
    const maxContextLength = this.getMaxContextLength(request.accessLevel);

    return ConversationEngine.buildContext({
      messages: session.messages.slice(-contextWindow),
      accessLevel: session.accessLevel,
      tenantId: session.tenantId,
      maxContextLength,
      documentContext: request.context?.documentIds ? 
        await this.getDocumentContext(request.context.documentIds, session.tenantId) : [],
      pageContext: request.context?.pageContext
    });
  }

  /**
   * Generate AI response using AWS or local services
   */
  private async generateAIResponse(
    message: string, 
    context: ConversationContext, 
    session: ConversationSession,
    request: ChatRequest
  ): Promise<any> {
    try {
      // Use AWS services if available for enhanced RAG
      if (this.useAWSServices) {
        console.log('🚀 Using AWS services for AI response');
        const awsResult = await this.awsBridgeAccessor.queryRAG(
          message, 
          request.userId, 
          request.tenantId, 
          { 
            accessLevel: request.accessLevel,
            pageContext: request.context?.pageContext 
          }
        );
        
        if (awsResult.success) {
          return {
            message: awsResult.message,
            confidence: 0.8,
            sources: awsResult.sources,
            videos: awsResult.videos,
            followUpQuestions: []
          };
        }
      }

      // Fallback to local processing with RAG
      console.log('🔄 Using local AI processing with RAG');
      const ragContent = await this.retrieveRelevantContent(
        message, 
        request.userId, 
        request.tenantId, 
        request.accessLevel
      );

      // Generate response using ConversationEngine
      const messages = session.messages.map(msg => ({ role: msg.role, content: msg.content }));
      const aiResponse = await ConversationEngine.generateResponse(
        message,
        context,
        ragContent.join('\n\n'),
        this.aiAccessor
      );

      return {
        message: aiResponse.message,
        confidence: aiResponse.confidence,
        sources: ragContent.slice(0, 3).map(content => {
          const title = content.split(':')[0] || 'Document';
          return { title: title.trim(), type: 'document' };
        }),
        videos: this.extractVideoRecommendations(ragContent),
        followUpQuestions: aiResponse.followUpQuestions || []
      };

    } catch (error) {
      console.error('❌ Failed to generate AI response:', error);
      return {
        message: "I'm here to help with your eyecare questions. Could you please rephrase your question?",
        confidence: 0.5,
        sources: [],
        videos: [],
        followUpQuestions: []
      };
    }
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
      aiResponse.sources = aiResponse.sources || [];
      aiResponse.sources.push('AI Assistant');
    }

    return aiResponse;
  }

  /**
   * Get document context for RAG
   */
  private async getDocumentContext(documentIds: string[], tenantId: string): Promise<string[]> {
    console.log('🔍 Getting document context for RAG from contents collection...');
    
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
   * Retrieve relevant content for RAG using AWS or MongoDB
   */
  private async retrieveRelevantContent(
    message: string, 
    userId: string, 
    tenantId: string, 
    accessLevel: string
  ): Promise<string[]> {
    try {
      console.log('🔍 Retrieving relevant content for RAG...');

      // Use AWS services if available
      if (this.useAWSServices) {
        console.log('🚀 Using AWS OpenSearch for RAG...');
        const awsResult = await this.awsBridgeAccessor.queryRAG(message, userId, tenantId, { accessLevel });
        
        if (awsResult.success && awsResult.sources.length > 0) {
          return awsResult.sources.map(source => 
            `${source.title}: ${source.content || 'AWS content'}`.substring(0, 300)
          );
        }
      }

      // Fallback to MongoDB search
      console.log('🔄 Using MongoDB for RAG fallback...');
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
        
    } catch (error) {
      console.error('❌ RAG retrieval failed:', error);
      return [];
    }
  }

  /**
   * Extract video recommendations from content
   */
  private extractVideoRecommendations(ragContent: string[]): any[] {
    return ragContent
      .filter(content => content.toLowerCase().includes('video') || content.toLowerCase().includes('training'))
      .slice(0, 3)
      .map((content, index) => {
        const title = content.split(':')[0] || `Training Video ${index + 1}`;
        return {
          title: title.trim(),
          link: '#', // Would be extracted from actual content
          duration: '5 min',
          relevance: '75%'
        };
      });
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

  /**
   * Get system status including AWS availability
   */
  async getSystemStatus(): Promise<{
    aws: boolean;
    openSearch: boolean;
    bedrock: boolean;
    mode: 'aws' | 'local' | 'hybrid';
  }> {
    return await this.awsBridgeAccessor.getSystemStatus();
  }
}

export default ConversationManager;
