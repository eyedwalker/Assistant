/**
 * Test endpoint for production Knowledge Base integration
 * Verifies connection, uploads content, and tests RAG queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductionKnowledgeBaseAccessor } from '@/lib/accessors/ProductionKnowledgeBaseAccessor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || 'How do I fit contact lenses?';
    const accessLevel = (searchParams.get('accessLevel') || 'COMPANY') as 'PUBLIC' | 'ACCOUNT' | 'COMPANY' | 'OFFICE';

    console.log(`🧪 Testing Knowledge Base with query: "${query}"`);
    
    const kbAccessor = new ProductionKnowledgeBaseAccessor();
    
    // Test 1: Knowledge Base status
    console.log('📊 Checking Knowledge Base status...');
    const status = await kbAccessor.getKnowledgeBaseStatus();
    
    // Test 2: RAG Query
    console.log('🔍 Testing RAG query...');
    const queryResult = await kbAccessor.queryWithRAG(
      query,
      accessLevel,
      'vsp-encompass',
      'test-user'
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        knowledgeBaseStatus: {
          passed: status.healthy,
          details: status
        },
        ragQuery: {
          passed: queryResult.success,
          query: query,
          answer: queryResult.answer,
          sources: queryResult.sources,
          metadata: queryResult.metadata
        }
      },
      configuration: {
        knowledgeBaseId: 'L3AVNMAT2F',
        region: 'us-west-2',
        s3Bucket: 'encompass-knowledgebase',
        accessLevel: accessLevel
      }
    });

  } catch (error) {
    console.error('❌ Knowledge Base test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Knowledge Base test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const kbAccessor = new ProductionKnowledgeBaseAccessor();

    switch (action) {
      case 'upload-content':
        console.log('📤 Testing content upload...');
        const uploadResult = await kbAccessor.uploadEyecareContent();
        return NextResponse.json({
          success: uploadResult.success,
          action: 'upload-content',
          uploaded: uploadResult.uploaded,
          errors: uploadResult.errors,
          timestamp: new Date().toISOString()
        });

      case 'query':
        console.log(`🔍 Testing custom query: "${params.query}"`);
        const queryResult = await kbAccessor.queryWithRAG(
          params.query || 'What is VSP?',
          params.accessLevel || 'COMPANY',
          params.tenantId || 'vsp-encompass',
          params.userId || 'test-user'
        );
        
        return NextResponse.json({
          success: queryResult.success,
          action: 'query',
          query: params.query,
          answer: queryResult.answer,
          sources: queryResult.sources,
          metadata: queryResult.metadata,
          timestamp: new Date().toISOString()
        });

      case 'status':
        console.log('📊 Getting Knowledge Base status...');
        const status = await kbAccessor.getKnowledgeBaseStatus();
        return NextResponse.json({
          success: status.healthy,
          action: 'status',
          status: status,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: upload-content, query, status'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Knowledge Base test action failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Test action failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
