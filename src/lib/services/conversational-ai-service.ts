import Anthropic from '@anthropic-ai/sdk';
import { 
  ChatMessage, 
  ChatContext, 
  DocumentReference, 
  SearchResult,
  AccessLevel,
  VectorEmbedding 
} from '@/types';
import mongoService from './mongodb-service';
import s3Service from './s3-service';

interface ConversationResponse {
  message: string;
  sources: DocumentReference[];
  confidence: number;
  conversationId: string;
}

interface RAGContext {
  relevantDocuments: DocumentReference[];
  contextText: string;
  totalRelevance: number;
}

class ConversationalAIService {
  private anthropic: Anthropic;
  private readonly maxContextLength = 8000;
  private readonly maxSources = 5;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Process a chat message with RAG (Retrieval-Augmented Generation)
   */
  async processMessage(
    message: string,
    context: ChatContext
  ): Promise<ConversationResponse> {
    try {
      // Step 1: Retrieve relevant documents
      const ragContext = await this.retrieveRelevantContext(
        message, 
        context.accessLevel, 
        context.accessId
      );

      // Step 2: Get conversation history
      const conversationHistory = await this.getConversationHistory(
        context.conversationId,
        5 // Last 5 messages
      );

      // Step 3: Generate response using Claude with RAG context
      const response = await this.generateResponse(
        message,
        ragContext,
        conversationHistory,
        context
      );

      // Step 4: Save the conversation
      await this.saveConversation(message, response, context);

      return {
        message: response.content,
        sources: ragContext.relevantDocuments,
        confidence: response.confidence,
        conversationId: context.conversationId
      };

    } catch (error) {
      console.error('Conversational AI processing failed:', error);
      
      // Fallback response
      return {
        message: "I apologize, but I'm experiencing technical difficulties. Please try again later.",
        sources: [],
        confidence: 0,
        conversationId: context.conversationId
      };
    }
  }

  /**
   * Retrieve relevant documents and context using semantic search
   */
  private async retrieveRelevantContext(
    query: string,
    userAccessLevel: AccessLevel,
    userAccessId: string
  ): Promise<RAGContext> {
    try {
      // Search for relevant documents
      const searchResults = await mongoService.searchDocuments(
        query,
        userAccessLevel,
        userAccessId,
        {},
        this.maxSources
      );

      const relevantDocuments: DocumentReference[] = [];
      let contextText = '';
      let totalRelevance = 0;

      for (const doc of searchResults) {
        try {
          // Get document content from S3
          const content = await s3Service.getFileAsText(doc.s3Key);
          
          // Calculate relevance score (simplified)
          const relevanceScore = this.calculateRelevanceScore(query, content, doc);
          
          if (relevanceScore > 0.3) { // Threshold for relevance
            const excerpt = this.extractRelevantExcerpt(query, content);
            
            relevantDocuments.push({
              documentId: doc.id,
              documentName: doc.name,
              relevanceScore,
              excerpt,
              url: doc.url,
              accessLevel: doc.accessLevel
            });

            // Add to context text
            contextText += `\n\n--- Document: ${doc.name} ---\n${excerpt}`;
            totalRelevance += relevanceScore;
          }
        } catch (error) {
          console.error(`Failed to process document ${doc.id}:`, error);
        }
      }

      // Truncate context if too long
      if (contextText.length > this.maxContextLength) {
        contextText = contextText.substring(0, this.maxContextLength) + '...';
      }

      return {
        relevantDocuments: relevantDocuments.slice(0, this.maxSources),
        contextText,
        totalRelevance
      };

    } catch (error) {
      console.error('Context retrieval failed:', error);
      return {
        relevantDocuments: [],
        contextText: '',
        totalRelevance: 0
      };
    }
  }

  /**
   * Calculate relevance score between query and document
   */
  private calculateRelevanceScore(
    query: string,
    content: string,
    document: any
  ): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    let totalTerms = queryTerms.length;

    // Term frequency scoring
    queryTerms.forEach(term => {
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(matches / 10, 1); // Normalize
    });

    // Boost score for AI analysis keywords
    if (document.ai_analysis?.keywords) {
      const keywordMatches = document.ai_analysis.keywords.filter((keyword: string) =>
        queryTerms.some(term => keyword.toLowerCase().includes(term))
      ).length;
      score += keywordMatches * 0.2;
    }

    // Boost score for quality
    if (document.ai_analysis?.quality === 'excellent') {
      score += 0.1;
    } else if (document.ai_analysis?.quality === 'good') {
      score += 0.05;
    }

    return Math.min(score / totalTerms, 1);
  }

  /**
   * Extract relevant excerpt from document content
   */
  private extractRelevantExcerpt(query: string, content: string, maxLength = 500): string {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    // Score sentences by relevance
    const scoredSentences = sentences.map(sentence => {
      const sentenceLower = sentence.toLowerCase();
      let score = 0;
      
      queryTerms.forEach(term => {
        if (sentenceLower.includes(term)) {
          score += 1;
        }
      });
      
      return { sentence: sentence.trim(), score };
    });

    // Get top relevant sentences
    const relevantSentences = scoredSentences
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.sentence);

    let excerpt = relevantSentences.join('. ');
    
    // Truncate if too long
    if (excerpt.length > maxLength) {
      excerpt = excerpt.substring(0, maxLength) + '...';
    }

    return excerpt || content.substring(0, maxLength) + '...';
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(
    conversationId: string,
    limit: number
  ): Promise<ChatMessage[]> {
    try {
      return await mongoService.getChatMessages(conversationId, limit);
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * Generate response using Claude with RAG context
   */
  private async generateResponse(
    userMessage: string,
    ragContext: RAGContext,
    conversationHistory: ChatMessage[],
    context: ChatContext
  ): Promise<{ content: string; confidence: number }> {
    try {
      const systemPrompt = this.buildSystemPrompt(ragContext, context);
      const conversationPrompt = this.buildConversationPrompt(
        userMessage,
        conversationHistory,
        ragContext
      );

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: conversationPrompt
          }
        ]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'I apologize, but I could not generate a response.';

      // Calculate confidence based on context relevance
      const confidence = Math.min(
        0.5 + (ragContext.totalRelevance * 0.5),
        0.95
      );

      return { content, confidence };

    } catch (error) {
      console.error('Response generation failed:', error);
      return {
        content: 'I apologize, but I encountered an error while processing your request.',
        confidence: 0
      };
    }
  }

  /**
   * Build system prompt for Claude
   */
  private buildSystemPrompt(ragContext: RAGContext, context: ChatContext): string {
    return `You are an AI assistant specialized in eyecare and optometry, designed to help eyecare professionals with training, documentation, and operational support within the Eyefinity Encompass ecosystem.

CONTEXT INFORMATION:
${ragContext.contextText}

GUIDELINES:
1. Provide accurate, helpful responses based on the provided context documents
2. Always cite your sources when referencing specific information
3. Focus on eyecare, optometry, and vision-related topics
4. If you don't have relevant information in the context, say so clearly
5. Maintain a professional, helpful tone appropriate for healthcare professionals
6. Prioritize patient safety and clinical accuracy in all responses
7. When discussing procedures or treatments, emphasize the importance of following proper protocols

ACCESS LEVEL: ${context.accessLevel}
USER CONTEXT: ${context.accessId}

Remember to be concise but thorough, and always prioritize accuracy over completeness.`;
  }

  /**
   * Build conversation prompt
   */
  private buildConversationPrompt(
    userMessage: string,
    conversationHistory: ChatMessage[],
    ragContext: RAGContext
  ): string {
    let prompt = '';

    // Add conversation history
    if (conversationHistory.length > 0) {
      prompt += 'CONVERSATION HISTORY:\n';
      conversationHistory.reverse().forEach(msg => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        prompt += `${role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add current user message
    prompt += `CURRENT QUESTION: ${userMessage}\n\n`;

    // Add source information
    if (ragContext.relevantDocuments.length > 0) {
      prompt += 'AVAILABLE SOURCES:\n';
      ragContext.relevantDocuments.forEach((doc, index) => {
        prompt += `[${index + 1}] ${doc.documentName} (Relevance: ${(doc.relevanceScore * 100).toFixed(1)}%)\n`;
      });
      prompt += '\n';
    }

    prompt += 'Please provide a helpful response based on the context provided. If you reference specific information, please cite the relevant source(s).';

    return prompt;
  }

  /**
   * Save conversation to database
   */
  private async saveConversation(
    userMessage: string,
    response: { content: string; confidence: number },
    context: ChatContext
  ): Promise<void> {
    try {
      // Save user message
      await mongoService.addChatMessage({
        role: 'user',
        content: userMessage,
        conversationId: context.conversationId,
        sources: [],
        timestamp: new Date(),
        metadata: {
          accessLevel: context.accessLevel,
          accessId: context.accessId
        }
      });

      // Save assistant response
      await mongoService.addChatMessage({
        role: 'assistant',
        content: response.content,
        conversationId: context.conversationId,
        confidence: response.confidence,
        sources: context.relevantDocuments || [],
        timestamp: new Date(),
        metadata: {
          accessLevel: context.accessLevel,
          accessId: context.accessId
        }
      });

    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  /**
   * Create new conversation
   */
  async createConversation(
    userId: string,
    title: string,
    accessLevel: AccessLevel,
    accessId: string
  ): Promise<string> {
    try {
      return await mongoService.createConversation({
        userId,
        title,
        accessLevel,
        accessId,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        messageCount: 0
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Get conversation list for user
   */
  async getUserConversations(
    userId: string,
    accessLevel: AccessLevel,
    accessId: string,
    page = 1,
    limit = 20
  ) {
    try {
      return await mongoService.getUserConversations(
        userId,
        accessLevel,
        accessId,
        page,
        limit
      );
    } catch (error) {
      console.error('Failed to get user conversations:', error);
      return { conversations: [], total: 0 };
    }
  }

  /**
   * Suggest follow-up questions based on context
   */
  async suggestFollowUpQuestions(
    conversationId: string,
    ragContext: RAGContext
  ): Promise<string[]> {
    try {
      if (ragContext.relevantDocuments.length === 0) {
        return [];
      }

      const prompt = `Based on the following context about eyecare and optometry, suggest 3 relevant follow-up questions that a healthcare professional might ask:

CONTEXT:
${ragContext.contextText.substring(0, 1000)}

Generate 3 concise, specific questions that would help the user explore this topic further. Focus on practical, actionable questions.

Format as a simple list:
1. [Question 1]
2. [Question 2]  
3. [Question 3]`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      // Parse questions from response
      const questions = content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);

      return questions.slice(0, 3);

    } catch (error) {
      console.error('Failed to generate follow-up questions:', error);
      return [];
    }
  }

  /**
   * Health check for conversational AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      return true;
    } catch (error) {
      console.error('Conversational AI health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const conversationalAI = new ConversationalAIService();
export default conversationalAI;
