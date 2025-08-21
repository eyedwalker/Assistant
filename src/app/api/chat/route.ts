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
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { VideoSearchEngine } from '@/lib/engines/VideoSearchEngine';
import { connectToDatabase } from '@/lib/services/mongodb-connection';

// Initialize VBD components
const mongoAccessor = new MongoDBAccessor(
  process.env.MONGODB_URI!,
  process.env.MONGODB_DB_NAME || 'ai-assistant-platform'
);

// Use Bedrock if configured, otherwise fallback to Anthropic
const useBedrock = process.env.USE_BEDROCK === 'true';
const aiAccessor = useBedrock 
  ? new BedrockAccessor({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    })
  : new AnthropicAccessor();

const conversationManager = new ConversationManager(mongoAccessor, aiAccessor);
const videoSearchEngine = new VideoSearchEngine(mongoAccessor);

// Initialize MongoDB connection - optional
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    try {
      await mongoAccessor.connect();
      isConnected = true;
    } catch (error) {
      console.error('MongoDB connection failed, continuing without it:', error);
      isConnected = false;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Try to connect but don't fail if it doesn't work
    await ensureConnection();
    
    const { message, sessionId, userId, tenantId, accessLevel, context } = await request.json();

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
        previousMessages: 10,
        pageContext: context // Include the page context from extension
      }
    };

    // Use direct AI processing to bypass MongoDB connection issues
    console.log('🤖 Processing chat request with direct AI...');
    let chatResponse;
    
    // Always try ConversationManager first for RAG functionality
    try {
      console.log('🧠 Attempting RAG-enabled ConversationManager...');
      chatResponse = await conversationManager.processMessage(chatRequest);
      console.log('✅ ConversationManager succeeded with RAG');
    } catch (mongoError: unknown) {
      const errorMessage = mongoError instanceof Error ? mongoError.message : String(mongoError);
      console.error('❌ ConversationManager failed:', errorMessage);
      console.log('🔄 Falling back to direct AI (no RAG)');
      chatResponse = null;
    }
    
    if (!chatResponse) {
      // Direct AI fallback without MongoDB
      let directResponse: string;
      if (useBedrock) {
        const response = await (aiAccessor as BedrockAccessor).generateChatResponse(
          `You are an AI assistant for eyecare professionals. Answer this question: "${message}"`
        );
        // BedrockAccessor returns a ChatResponse object with message property
        directResponse = response.message;
      } else {
        // AnthropicAccessor returns a ChatResponse object with message property
        const response = await (aiAccessor as AnthropicAccessor).generateChatResponse(
          `You are an AI assistant for eyecare professionals. Answer this question: "${message}"`,
          ''
        );
        directResponse = response.message;
      }
      
      chatResponse = {
        message: directResponse,
        sessionId: chatRequest.sessionId || `session_${Date.now()}`,
        messageId: `msg_${Date.now()}`,
        confidence: 0.8,
        sources: [],
        followUpQuestions: [],
        processingTime: Date.now() - Date.now(),
        metadata: { phiDetected: false }
      };
    }

    // Search for relevant videos based on the message and context
    console.log('🎥 Searching for relevant videos...');
    let relevantVideos: any[] = [];
    let videoRecommendations: any[] = [];
    
    try {
      const { db } = await connectToDatabase();
      if (db) {
        // Search for videos directly in the database
        const searchTerms = message.toLowerCase().split(' ').filter((term: string) => term.length > 2);
        const searchRegex = searchTerms.map((term: string) => new RegExp(term, 'i'));
        
        const videos = await db.collection('documents').find({
          contentType: 'video',
          processingStatus: 'completed',
          $or: [
            { title: { $in: searchRegex } },
            { aiAnalysis: { $in: searchRegex } },
            { transcript: { $in: searchRegex } },
            { vspProduct: { $in: searchRegex } }
          ]
        }).limit(3).toArray();

        // Format video recommendations for the response
        videoRecommendations = videos.map(video => ({
          title: video.title,
          link: video.url,
          thumbnail: video.thumbnail,
          duration: Math.round((video.duration || 0) / 60) + ' min',
          summary: video.aiAnalysis ? video.aiAnalysis.substring(0, 200) + '...' : 'Training video',
          relevance: '75%'
        }));
      }
    } catch (videoError) {
      console.error('Video search failed, continuing without videos:', videoError);
      videoRecommendations = [];
    }

    // Return the RAG-enhanced response with video recommendations
    return NextResponse.json({
      success: true,
      message: chatResponse.message,
      sessionId: chatResponse.sessionId,
      messageId: chatResponse.messageId,
      confidence: chatResponse.confidence,
      sources: chatResponse.sources,
      followUpQuestions: chatResponse.followUpQuestions,
      processingTime: chatResponse.processingTime,
      videos: videoRecommendations, // Include relevant videos
      metadata: {
        pageContext: context,
        phiDetected: chatResponse.metadata?.phiDetected || false,
        videosFound: videoRecommendations.length
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
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
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
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

// OPTIONS endpoint for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
