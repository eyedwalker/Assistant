/**
 * Production Chat API using existing Knowledge Base with security and access control
 * Primary chat endpoint for the AI Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ProductionConversationManager } from '@/lib/managers/ProductionConversationManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';

export async function POST(request: NextRequest) {
  let mongoAccessor: MongoDBAccessor | null = null;
  
  try {
    // Parse request
    const body = await request.json();
    const { message, userId, tenantId, accessLevel = 'COMPANY', sessionId } = body;

    if (!message || !userId) {
      return NextResponse.json({
        error: 'Missing required fields: message and userId'
      }, { status: 400 });
    }

    // Check authentication in production
    const session = await getServerSession(authOptions);
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!session && !isDevelopment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize services
    mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    const bedrockAccessor = new BedrockAccessor();
    const conversationManager = new ProductionConversationManager(
      mongoAccessor,
      bedrockAccessor
    );

    // Set up conversation context
    const context = {
      userId: userId || 'anonymous',
      tenantId: tenantId || 'vsp-encompass',
      accessLevel: accessLevel as 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE',
      sessionId: sessionId
    };

    console.log(`💬 Processing chat request for user: ${context.userId}, tenant: ${context.tenantId}`);

    // Initialize user session if first time
    const sessionInfo = await conversationManager.initializeUserSession(context);
    if (!sessionInfo.success) {
      throw new Error('Failed to initialize user session');
    }

    // Get conversation history for context
    const conversationHistory = await conversationManager.getConversationHistory(context, 10);

    // Generate response using Knowledge Base + fallback
    const response = await conversationManager.generateResponse(
      message,
      context,
      conversationHistory
    );

    // Return enhanced response
    return NextResponse.json({
      success: true,
      message: response.message,
      sources: response.sources,
      sessionId: response.sessionId || sessionInfo.sessionId,
      metadata: {
        ...response.metadata,
        usedKnowledgeBase: response.usedKnowledgeBase,
        userPermissions: sessionInfo.userPermissions,
        availableContent: sessionInfo.availableContent,
        conversationLength: conversationHistory.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Production chat failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'I apologize, but I encountered an error. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });

  } finally {
    if (mongoAccessor) {
      await mongoAccessor.disconnect();
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tenantId = searchParams.get('tenantId') || 'vsp-encompass';
    const accessLevel = searchParams.get('accessLevel') || 'COMPANY';

    if (!userId) {
      return NextResponse.json({
        error: 'Missing userId parameter'
      }, { status: 400 });
    }

    // Initialize services
    const mongoAccessor = new MongoDBAccessor(
      process.env.MONGODB_URI!,
      process.env.MONGODB_DB_NAME!
    );
    await mongoAccessor.connect();

    const bedrockAccessor = new BedrockAccessor();
    const conversationManager = new ProductionConversationManager(
      mongoAccessor,
      bedrockAccessor
    );

    const context = {
      userId,
      tenantId,
      accessLevel: accessLevel as 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE'
    };

    // Get conversation history
    const history = await conversationManager.getConversationHistory(context, 50);
    
    // Initialize session to get user info
    const sessionInfo = await conversationManager.initializeUserSession(context);

    await mongoAccessor.disconnect();

    return NextResponse.json({
      success: true,
      userId,
      tenantId,
      accessLevel,
      conversationHistory: history,
      userPermissions: sessionInfo.userPermissions,
      availableContent: sessionInfo.availableContent,
      sessionId: sessionInfo.sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get conversation history:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
