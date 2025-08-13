/**
 * Test endpoint to verify Anthropic API integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnthropicAccessor } from '@/lib/accessors/AnthropicAccessor';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Anthropic API integration...');
    console.log('Environment check:', {
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...'
    });

    // Test 1: Initialize AnthropicAccessor
    const anthropicAccessor = new AnthropicAccessor();
    console.log('✅ AnthropicAccessor initialized successfully');

    // Test 2: Test connection
    const connectionTest = await anthropicAccessor.testConnection();
    console.log('Connection test result:', connectionTest);

    // Test 3: Direct Anthropic client test
    let directResult = null;
    try {
      console.log('🧪 Testing direct Anthropic client...');
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const directClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!
      });
      
      const directResponse = await directClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        system: 'You are a helpful AI assistant.',
        messages: [{ role: 'user', content: 'Hello, can you help me?' }]
      });
      directResult = directResponse.content[0];
      console.log('✅ Direct client response:', directResult);
    } catch (error) {
      console.error('❌ Direct client failed:', error);
      directResult = { error: error instanceof Error ? error.message : String(error) };
    }

    // Test 4: Generate a simple chat response
    let chatResult = null;
    try {
      console.log('🧪 Testing generateChatResponse...');
      chatResult = await anthropicAccessor.generateChatResponse(
        'Hello, can you help me?',
        'You are a helpful AI assistant for eyecare professionals.',
        []
      );
      console.log('Chat response:', chatResult);
    } catch (error) {
      console.error('❌ generateChatResponse failed:', error);
      chatResult = { error: error instanceof Error ? error.message : String(error) };
    }

    return NextResponse.json({
      success: true,
      tests: {
        initialization: true,
        connection: connectionTest,
        directClient: directResult,
        chatResponse: chatResult
      },
      environment: {
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Anthropic test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      environment: {
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
