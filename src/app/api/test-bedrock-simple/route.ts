import { NextRequest, NextResponse } from 'next/server';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('🔷 Testing Direct Bedrock Access...');
    console.log('AWS Region:', process.env.AWS_BEDROCK_REGION || 'us-east-1');
    console.log('Model ID:', process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0');
    console.log('Has AWS Credentials:', !!process.env.AWS_ACCESS_KEY_ID);
    console.log('Has Session Token:', !!process.env.AWS_SESSION_TOKEN);
    
    const bedrockAccessor = new BedrockAccessor({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      temperature: 0.7,
      maxTokens: 2000
    });

    // Test basic chat response
    const response = await bedrockAccessor.generateChatResponse(
      message,
      'You are helping with eyecare and contact lens questions.',
      'demo-user',
      'demo-tenant'
    );

    return NextResponse.json({
      success: true,
      message: response.message,
      confidence: response.confidence,
      metadata: response.metadata,
      configuration: {
        region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        useBedrock: process.env.USE_BEDROCK === 'true'
      }
    });

  } catch (error: any) {
    console.error('❌ Bedrock API Error:', error);
    
    return NextResponse.json({
      error: 'Failed to generate response from Bedrock',
      details: error.message,
      errorName: error.name
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-bedrock-simple',
    method: 'POST',
    description: 'Simple AWS Bedrock test without ConversationManager dependencies',
    exampleRequest: {
      message: 'Hello, test Bedrock connection'
    }
  });
}
