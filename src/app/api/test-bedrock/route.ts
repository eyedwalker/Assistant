import { NextRequest, NextResponse } from 'next/server';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';
import { MongoDBAccessor } from '@/lib/accessors/MongoDBAccessor';
import { ConversationManager } from '@/lib/managers/ConversationManager';

export async function POST(request: NextRequest) {
  try {
    const { message, useStreamingDemo = false } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Demo 1: Direct BedrockAccessor usage
    console.log('🔷 Testing Direct Bedrock Access...');
    console.log('AWS Region:', process.env.AWS_BEDROCK_REGION || 'us-west-2');
    console.log('Model ID:', process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0');
    console.log('Has AWS Credentials:', !!process.env.AWS_ACCESS_KEY_ID);
    console.log('Has Session Token:', !!process.env.AWS_SESSION_TOKEN);
    
    const bedrockAccessor = new BedrockAccessor({
      region: process.env.AWS_BEDROCK_REGION || 'us-west-2',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      guardrailId: process.env.BEDROCK_GUARDRAIL_ID,
      temperature: 0.7,
      maxTokens: 2000
    });

    // Test basic chat response
    const directResponse = await bedrockAccessor.generateChatResponse(
      message,
      'You are helping with eyecare and contact lens questions.',
      'demo-user',
      'demo-tenant'
    );

    // Demo 2: ConversationManager with Bedrock
    console.log('🔷 Testing Bedrock via ConversationManager...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'ai-assistant';
    
    const mongoAccessor = new MongoDBAccessor(mongoUri, dbName);
    await mongoAccessor.connect();

    // ConversationManager will automatically use Bedrock if USE_BEDROCK=true
    const conversationManager = new ConversationManager(
      mongoAccessor,
      new AnthropicAccessor(),
      new BedrockAccessor()
    );

    // Create a chat request
    const chatResponse = await conversationManager.generateResponse(
      message,
      'demo-user',
      'demo-tenant',
      'demo-session-' + Date.now()
    );

    await mongoAccessor.disconnect();

    // Demo 3: Streaming response (if requested)
    let streamingDemo = null;
    if (useStreamingDemo) {
      console.log('🔷 Testing Streaming Response...');
      const chunks: string[] = [];
      
      await bedrockAccessor.generateStreamingResponse(
        message,
        'Context for streaming response',
        (chunk) => chunks.push(chunk),
        'demo-user',
        'demo-tenant'
      );
      
      streamingDemo = {
        totalChunks: chunks.length,
        fullResponse: chunks.join('')
      };
    }

    // Demo 4: Available models
    const availableModels = await bedrockAccessor.listAvailableModels();

    return NextResponse.json({
      success: true,
      demos: {
        directBedrock: {
          message: directResponse.message,
          confidence: directResponse.confidence,
          metadata: directResponse.metadata
        },
        viaConversationManager: {
          message: chatResponse.message,
          sessionId: chatResponse.sessionId,
          processingTime: 0,
          metadata: { simplified: true }
        },
        streaming: streamingDemo,
        availableModels
      },
      configuration: {
        region: process.env.AWS_BEDROCK_REGION || 'us-west-2',
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
        guardrailConfigured: !!process.env.BEDROCK_GUARDRAIL_ID,
        useBedrock: process.env.USE_BEDROCK === 'true'
      }
    });

  } catch (error: any) {
    console.error('❌ Bedrock API Error:', error);
    console.error('Error Details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.Code,
      statusCode: error.$metadata?.httpStatusCode
    });
    
    // Provide helpful error information
    const errorInfo: any = {
      error: 'Failed to generate response from Bedrock',
      type: 'general',
      details: error.message,
      errorName: error.name,
      troubleshooting: {
        authentication: null,
        guardrail: null
      }
    };

    // Check for specific error types
    if (error.name === 'UnauthorizedException' || error.message?.includes('UnauthorizedException')) {
      errorInfo.type = 'authentication';
      errorInfo.troubleshooting.authentication = [
        'Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set',
        'Check that your AWS credentials have permission to invoke Bedrock models',
        'Verify the correct AWS_BEDROCK_REGION is set'
      ];
    } else if (error.name === 'GuardrailBlockedException' || error.message?.includes('guardrail')) {
      errorInfo.type = 'guardrail';
      errorInfo.troubleshooting.guardrail = [
        'The request was blocked by AWS Bedrock Guardrails',
        'Review your guardrail configuration in the AWS Console',
        'Consider removing BEDROCK_GUARDRAIL_ID from environment variables to test without guardrails'
      ];
    } else if (error.message?.includes('ValidationException')) {
      errorInfo.type = 'validation';
      errorInfo.troubleshooting.validation = [
        'The model ID may be incorrect or not available in your region',
        'Check that the model is enabled in your AWS Bedrock console',
        'Verify the model ID format is correct'
      ];
    }

    return NextResponse.json(errorInfo, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-bedrock',
    method: 'POST',
    description: 'Test AWS Bedrock integration with multiple demos',
    requiredEnvVars: [
      'AWS_ACCESS_KEY_ID (or IAM role)',
      'AWS_SECRET_ACCESS_KEY (or IAM role)',
      'AWS_BEDROCK_REGION (optional, defaults to us-west-2)',
      'BEDROCK_MODEL_ID (optional, defaults to Claude 3 Sonnet)',
      'BEDROCK_GUARDRAIL_ID (optional, for content filtering)',
      'USE_BEDROCK (set to "true" to use Bedrock in ConversationManager)'
    ],
    exampleRequest: {
      message: 'What are the best practices for contact lens care?',
      useStreamingDemo: false
    },
    availableModels: [
      'anthropic.claude-3-opus-20240229-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-instant-v1'
    ]
  });
}
