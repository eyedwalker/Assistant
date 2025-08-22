import { NextRequest, NextResponse } from 'next/server';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { RAGManager } from '@/lib/managers/RAGManager';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('🔷 Testing Bedrock + RAG Integration...');
    console.log('Query:', message);
    
    // Initialize RAG Manager (will use Local Vector Store if no OpenSearch)
    const ragManager = new RAGManager();
    console.log('📚 Vector Store Type:', ragManager.getStoreType());
    
    // Search for relevant content
    const relevantContent = await ragManager.searchRelevantContent(
      message, 
      'demo-tenant', 
      'PUBLIC'
    );
    
    console.log(`🔍 Found ${relevantContent.length} relevant documents`);
    
    // Format RAG context
    const ragContext = ragManager.formatRAGContext(relevantContent);
    
    // Initialize Bedrock
    const bedrockAccessor = new BedrockAccessor({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      temperature: 0.7,
      maxTokens: 2000
    });

    // Generate response with RAG context
    const response = await bedrockAccessor.generateChatResponse(
      message,
      ragContext || 'You are an AI assistant for eyecare professionals specializing in Eyefinity systems.',
      'demo-user',
      'demo-tenant'
    );

    return NextResponse.json({
      success: true,
      message: response.message,
      confidence: response.confidence,
      sources: relevantContent.map(content => ({
        title: content.metadata.title,
        source: content.metadata.source,
        relevance: `${Math.round(content.score * 100)}%`,
        contentType: content.metadata.contentType
      })),
      ragDetails: {
        searchQuery: message,
        documentsFound: relevantContent.length,
        vectorStoreType: ragManager.getStoreType(),
        contextLength: ragContext.length
      },
      configuration: {
        region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        useBedrock: process.env.USE_BEDROCK === 'true'
      }
    });

  } catch (error: any) {
    console.error('❌ Bedrock + RAG Error:', error);
    
    return NextResponse.json({
      error: 'Failed to generate RAG-enhanced response',
      details: error.message,
      errorName: error.name
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-bedrock-rag',
    method: 'POST',
    description: 'Test AWS Bedrock with RAG (Retrieval Augmented Generation) functionality',
    exampleRequest: {
      message: 'How do I care for contact lenses?'
    },
    features: [
      'Searches for relevant content using vector similarity',
      'Augments AI response with retrieved context',
      'Supports both OpenSearch and Local Vector Store',
      'Returns source citations and relevance scores'
    ]
  });
}
