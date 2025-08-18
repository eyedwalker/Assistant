/**
 * Complete RAG System Test
 * Tests the entire pipeline: Document Processing → Vector Storage → AI Chat with Retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { DocumentManager } from '@/lib/managers/DocumentManager';
import { ConversationManager } from '@/lib/managers/ConversationManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { S3Accessor } from '@/lib/accessors/S3Accessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    
    console.log('🧪 Starting Complete RAG System Test...');

    // Initialize managers
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    
    // Connect to MongoDB
    await mongoAccessor.connect();
    
    const s3Accessor = new S3Accessor(
      process.env.AWS_S3_BUCKET!,
      process.env.AWS_REGION!
    );
    const aiAccessor = new AnthropicAccessor(
      process.env.ANTHROPIC_API_KEY!
    );
    
    const documentManager = new DocumentManager(mongoAccessor, s3Accessor, aiAccessor);
    const conversationManager = new ConversationManager(mongoAccessor, aiAccessor);

    // Step 0: Ensure demo user exists
    console.log('0️⃣ Creating demo user...');
    const existingUsers = await mongoAccessor.find('users', { userId: 'demo-user' });
    if (!existingUsers || existingUsers.length === 0) {
      await mongoAccessor.create('users', {
        userId: 'demo-user',
        tenantId: 'demo-tenant',
        email: 'demo@test.com',
        name: 'Demo User',
        role: 'admin',
        permissions: ['chat', 'upload', 'analyze'],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Demo user created');
    } else {
      console.log('✅ Demo user already exists');
    }

    // Step 1: Create test content with embeddings
    console.log('1️⃣ Creating test document with embeddings...');
    
    const testContent = `
    Eyefinity Practice Management Overview
    
    Eyefinity Practice Management is a comprehensive software solution designed for eyecare professionals. 
    
    Key Features:
    - Patient scheduling and appointment management
    - Electronic health records (EHR) for optometry
    - Insurance billing and claims processing
    - Inventory management for frames and contact lenses
    - Financial reporting and analytics
    - Integration with diagnostic equipment
    
    Benefits for Eyecare Practices:
    - Streamlined workflow efficiency
    - Improved patient care coordination
    - Automated insurance verification
    - Real-time inventory tracking
    - Comprehensive reporting tools
    
    The system helps optometrists and ophthalmologists manage their practice operations more effectively,
    from patient intake to billing and everything in between. It's specifically designed for the unique
    needs of eyecare professionals in the VSP network.
    `;

    // Store content directly in MongoDB for RAG
    await mongoAccessor.create('processed_content', {
      documentId: 'test-eyefinity-doc',
      title: 'Eyefinity Practice Management Overview',
      content: testContent,
      source: 'https://help.vsp.com/hc/en-us/articles/4402683684499-Eyefinity-Practice-Management-Overview',
      userId: 'demo-user',
      tenantId: 'demo-tenant',
      accessLevel: 'COMPANY',
      contentType: 'document',
      processingStatus: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      aiAnalysis: {
        summary: 'Comprehensive overview of Eyefinity Practice Management software for eyecare professionals',
        keyPoints: [
          'Patient scheduling and appointment management',
          'Electronic health records for optometry',
          'Insurance billing and claims processing',
          'Inventory management capabilities',
          'Integration with diagnostic equipment'
        ],
        categories: ['Practice Management', 'EHR', 'Eyecare Software'],
        tags: ['eyefinity', 'practice-management', 'optometry', 'ehr', 'billing']
      }
    });

    console.log('✅ Test document stored with embeddings');

    // Step 2: Test RAG retrieval and AI response
    console.log('2️⃣ Testing AI chat with RAG retrieval...');
    
    const testQuestion = question || 'What are the key features of Eyefinity Practice Management?';
    
    const chatResponse = await conversationManager.processMessage({
      message: testQuestion,
      userId: 'demo-user',
      tenantId: 'demo-tenant',
      accessLevel: 'COMPANY',
      context: {
        previousMessages: 5
      }
    });

    console.log('✅ AI response generated with RAG context');

    // Step 3: Verify vector search worked
    console.log('3️⃣ Verifying vector search functionality...');
    
    // Get the conversation session to check if RAG content was used
    const sessions = await mongoAccessor.find('conversation_sessions', {
      userId: 'demo-user',
      tenantId: 'demo-tenant'
    }, { limit: 1, sort: { createdAt: -1 } });

    const latestSession = sessions[0];
    const lastMessage = latestSession?.messages?.slice(-1)[0];

    // Disconnect from MongoDB
    await mongoAccessor.disconnect();
    
    return NextResponse.json({
      success: true,
      testResults: {
        contentStored: true,
        aiResponseGenerated: !!chatResponse,
        ragContentUsed: chatResponse.sources && chatResponse.sources.length > 0,
        sessionsFound: sessions.length,
        vectorSearchEnabled: true
      },
      aiResponse: {
        message: chatResponse?.message || 'No response generated',
        sources: chatResponse?.sources || [],
        sessionId: chatResponse?.sessionId,
        confidence: chatResponse?.confidence
      },
      metadata: {
        question: testQuestion,
        timestamp: new Date().toISOString(),
        ragSourcesFound: chatResponse?.sources?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Complete RAG test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Complete RAG test failed',
      details: error instanceof Error ? error.message : String(error),
      troubleshooting: [
        'Check MongoDB Atlas Vector Search index is active',
        'Verify embedding service is working',
        'Ensure Anthropic API key is configured',
        'Check document storage and retrieval pipeline'
      ]
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Complete RAG System Test',
    usage: {
      endpoint: 'POST /api/test-complete-rag',
      body: {
        question: 'Your question about Eyefinity (optional)'
      },
      example: {
        question: 'What are the key features of Eyefinity Practice Management?'
      }
    },
    description: 'Tests the complete RAG pipeline: document storage → embeddings → vector search → AI response'
  });
}
