/**
 * VBD Chat API Route - Using Volatility-Based Decomposition Architecture
 * 
 * This route demonstrates the complete VBD pattern:
 * - ConversationManager (Manager Layer): Business rules and orchestration
 * - ConversationEngine (Engine Layer): Core algorithms
 * - MongoDBAccessor, AnthropicAccessor (Accessor Layer): Data/API interfaces
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/managers/ConversationManager';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';

// Initialize VBD components
const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);
const anthropicAccessor = new AnthropicAccessor();
const conversationManager = new ConversationManager(mongoAccessor, anthropicAccessor);

// Initialize MongoDB connection
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    await mongoAccessor.connect();
    isConnected = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureConnection();
    
    const { message, sessionId, userId, tenantId, accessLevel } = await request.json();

    // Validate required fields
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Use default values for demo purposes if not provided
    const chatRequest = {
      message,
      userId: userId || 'demo-user-001',
      tenantId: tenantId || 'demo-tenant-001',
      sessionId,
      accessLevel: accessLevel || 'ACCOUNT' as const,
      context: {
        previousMessages: 10
      }
    };

    // Process message using VBD ConversationManager
    const response = await conversationManager.processMessage(chatRequest);

    return NextResponse.json({
      success: true,
      message: response.message,
      sessionId: response.sessionId,
      messageId: response.messageId,
      confidence: response.confidence,
      sources: response.sources,
      followUpQuestions: response.followUpQuestions,
      processingTime: response.processingTime,
      metadata: response.metadata,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('VBD Chat API error:', error);
    
    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat message';
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint for conversation history using VBD architecture
export async function GET(request: NextRequest) {
  try {
    await ensureConnection();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user-001';
    const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const sessions = await conversationManager.getConversationHistory(
      userId,
      tenantId,
      sessionId || undefined,
      limit
    );

    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('VBD Chat history API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve conversation history',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint to end a conversation session
export async function DELETE(request: NextRequest) {
  try {
    await ensureConnection();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId') || 'demo-user-001';
    const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const success = await conversationManager.endSession(sessionId, userId, tenantId);

    if (!success) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('VBD End session API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to end session',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
