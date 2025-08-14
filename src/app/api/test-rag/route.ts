/**
 * Test RAG (Retrieval-Augmented Generation) functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/managers/ConversationManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';

export async function POST(request: NextRequest) {
  try {
    const { message, userId = 'demo-user', tenantId = 'demo-tenant', accessLevel = 'ACCOUNT' } = await request.json();

    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }

    console.log('🧪 Testing RAG functionality...');
    console.log('Query:', message);
    console.log('User:', userId, 'Tenant:', tenantId, 'Access:', accessLevel);

    // Initialize managers
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
    );
    const anthropicAccessor = new AnthropicAccessor();
    const conversationManager = new ConversationManager(mongoAccessor, anthropicAccessor);

    // Test RAG chat processing
    const chatRequest = {
      message,
      userId,
      tenantId,
      accessLevel: accessLevel as 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE'
    };

    const startTime = Date.now();
    const response = await conversationManager.processMessage(chatRequest);
    const processingTime = Date.now() - startTime;

    console.log('✅ RAG response generated successfully');
    console.log('Response:', response.message.substring(0, 200) + '...');
    console.log('Sources:', response.sources?.length || 0);
    console.log('Processing time:', processingTime + 'ms');

    return NextResponse.json({
      success: true,
      query: message,
      response: {
        message: response.message,
        sessionId: response.sessionId,
        messageId: response.messageId,
        confidence: response.confidence,
        sources: response.sources,
        followUpQuestions: response.followUpQuestions,
        processingTime: response.processingTime,
        metadata: response.metadata
      },
      ragTest: {
        queryProcessingTime: processingTime,
        sourcesFound: response.sources?.length || 0,
        hasRelevantContent: (response.sources?.length || 0) > 0,
        ragEnabled: true
      }
    });

  } catch (error) {
    console.error('❌ RAG test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ragTest: {
        queryProcessingTime: 0,
        sourcesFound: 0,
        hasRelevantContent: false,
        ragEnabled: false,
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/test-rag',
    description: 'Test RAG (Retrieval-Augmented Generation) functionality',
    usage: {
      method: 'POST',
      body: {
        message: 'Your question about processed content',
        userId: 'demo-user (optional)',
        tenantId: 'demo-tenant (optional)', 
        accessLevel: 'ACCOUNT (optional)'
      }
    },
    examples: [
      {
        message: 'What content processing stages are available?',
        description: 'Test if AI knows about document processing workflow'
      },
      {
        message: 'How does content categorization work?',
        description: 'Test if AI can explain content management features'
      },
      {
        message: 'What happens when a document fails to process?',
        description: 'Test if AI understands error handling procedures'
      }
    ]
  });
}
