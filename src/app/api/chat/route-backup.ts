import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import conversationalAI from '@/lib/services/conversational-ai-service';
import { ChatContext, AccessLevel } from '@/types';
import { z } from 'zod';

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  context: z.object({
    accessLevel: z.nativeEnum(AccessLevel).optional(),
    accessId: z.string().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = chatRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { message, conversationId, context } = validationResult.data;

    // Create or use existing conversation
    let finalConversationId = conversationId;
    if (!finalConversationId) {
      finalConversationId = await conversationalAI.createConversation(
        session.user.id,
        message.substring(0, 50) + '...', // Use first part of message as title
        context?.accessLevel || session.user.accessLevel,
        context?.accessId || session.user.accessId
      );
    }

    // Build chat context
    const chatContext: ChatContext = {
      conversationId: finalConversationId,
      userId: session.user.id,
      accessLevel: context?.accessLevel || session.user.accessLevel,
      accessId: context?.accessId || session.user.accessId,
      previousMessages: []
    };

    // Process the message
    const response = await conversationalAI.processMessage(message, chatContext);

    // Generate follow-up questions
    const followUpQuestions = await conversationalAI.suggestFollowUpQuestions(
      finalConversationId,
      { 
        relevantDocuments: response.sources, 
        contextText: '', 
        totalRelevance: response.confidence 
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        message: response.message,
        sources: response.sources,
        confidence: response.confidence,
        conversationId: response.conversationId,
        followUpQuestions,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat message';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Get conversation history
export async function GET(request: NextRequest) {
  try {
    await ensureConnection();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (conversationId) {
      // Get specific conversation messages
      const messages = await conversationManager.getConversationHistory(
        session.user.id,
        session.user.tenantId,
        conversationId,
        limit
      );
      
      return NextResponse.json({
        success: true,
        data: {
          messages,
          conversationId
        }
      });
    } else {
      // Get user's conversations
      const { conversations, total } = await conversationManager.getUserConversations(
        session.user.id,
        session.user.accessLevel,
        session.user.accessId,
        page,
        limit
      );

      return NextResponse.json({
        success: true,
        data: conversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

  } catch (error) {
    console.error('Get chat API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
