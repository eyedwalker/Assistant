/**
 * Simplified ConversationManager for deployment readiness
 * Focus on core chat functionality without complex method dependencies
 */

import { AnthropicAccessor } from '../accessors/AnthropicAccessor';
import { BedrockAccessor } from '../accessors/BedrockAccessor';
import { MongoDBAccessor } from '../accessors/MongoDBAccessor';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatResponse {
  message: string;
  sources?: any[];
  sessionId: string;
}

export class ConversationManager {
  private anthropicAccessor: AnthropicAccessor;
  private bedrockAccessor: BedrockAccessor | null = null;
  private mongoAccessor: MongoDBAccessor;

  constructor(mongoAccessor: MongoDBAccessor, anthropicAccessor: AnthropicAccessor, bedrockAccessor?: BedrockAccessor) {
    this.mongoAccessor = mongoAccessor;
    this.anthropicAccessor = anthropicAccessor;
    if (bedrockAccessor) {
      this.bedrockAccessor = bedrockAccessor;
    }
  }

  /**
   * Simple chat response generation
   */
  async generateResponse(
    message: string,
    userId: string,
    tenantId: string,
    sessionId?: string
  ): Promise<ChatResponse> {
    try {
      // Use Bedrock if available, otherwise fall back to Anthropic
      const aiAccessor = this.bedrockAccessor || this.anthropicAccessor;
      const response = await aiAccessor.generateChatResponse(message, '');
      
      const responseMessage = typeof response === 'string' ? response : response.message;

      // Create session if it doesn't exist
      const finalSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Try to save to database (optional for deployment)
      try {
        await this.saveMessage(finalSessionId, userId, tenantId, 'user', message);
        await this.saveMessage(finalSessionId, userId, tenantId, 'assistant', responseMessage);
      } catch (error) {
        console.warn('Failed to save conversation to database:', error);
      }

      return {
        message: responseMessage,
        sessionId: finalSessionId,
        sources: []
      };
    } catch (error) {
      console.error('❌ Failed to generate response:', error);
      return {
        message: "I'm sorry, I encountered an error. Please try again.",
        sessionId: sessionId || `error-session-${Date.now()}`,
        sources: []
      };
    }
  }

  /**
   * Save a message to the database
   */
  private async saveMessage(
    sessionId: string,
    userId: string,
    tenantId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    try {
      await this.mongoAccessor.create('messages', {
        sessionId,
        userId,
        tenantId,
        role,
        content,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('Failed to save message:', error);
      // Don't throw - this is non-critical for basic functionality
    }
  }

  /**
   * Get conversation history (simplified)
   */
  async getConversationHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const messages = await this.mongoAccessor.find('messages', { sessionId });
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }
}
